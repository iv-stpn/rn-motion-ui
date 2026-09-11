// biome-ignore-all lint/style/noExcessiveLinesPerFile: dock shell, morph transition, and trigger/pane layouts collocated by design
// biome-ignore-all lint/style/useExportsLast: the public icon/item/props types head the module so the sub-components below read against them
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { DownFill as ChevronDown } from 'rn-motion-ui-icons/icons/down-fill';
import { UpFill as ChevronUp } from 'rn-motion-ui-icons/icons/up-fill';
import { useIsRTL } from '../../../hooks/use-direction';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { springLayout } from '../../../lib/ease';
import { clampSurfaceLevel, elevated as elevatedSurface, type SurfaceElevation } from '../../../lib/elevated';
import { INTERACTIVE_HEIGHT } from '../../../lib/radius';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { TIMING_INSTANT } from '../../../theme/motion';
import { Surface } from '../../display/Surface/surface';
import { ThemedIcon } from '../../icon/themed-icon';
import { SWITCHER_SCALE, type SwitcherScale } from '../../menus/MorphingSwitcher/morphing-switcher-scale';
import { SwitcherMotionRow } from '../../menus/MorphingSwitcher/switcher-motion';
import { CLOSE_LEAD, CONTENT_FADE, useSwitcherMotion } from '../../menus/MorphingSwitcher/use-switcher-motion';
import { useBlurTargetRef } from '../../menus/Overlay/blur-context';
import { OutsidePressBackdrop, type OutsidePressFrame } from '../../menus/Overlay/outside-press-backdrop';
import type { OverlayType } from '../../menus/Overlay/overlay-type';
import { TeleportedOverlay } from '../../menus/Overlay/teleported-overlay';
import { getWebDocument, isWebNode, type WebPointerEvent } from '../../menus/Overlay/web-document';
import { MenuItem } from '../../rows/menu-item';
import { DOCK_GAP, DOCK_ICON_SCALE, dockMetrics, dockRowSize } from '../Dock/dock-metrics';
import { DockContent, DockFrame, DockHighlight } from '../Dock/dock-motion';
import { DOCK_SPRING, dockSizeMotion } from '../Dock/dock-transition';

/** Minimum clearance kept between the open pane and the viewport edge when deciding whether to flip up. */
const VIEWPORT_PADDING = 8;
/** `p-1` inset between the shell edge and its content, so the dock icons and open rows never run flush to the rim. */
const PANE_INSET = 4;
/** How far the lower chevron overlaps the upper one (fraction of its size). */
const CARET_OVERLAP = 0.3;

/** Rungs the shell floats above its resting `elevation` while open. */
const OPEN_ELEVATION_LIFT = 2;
/** Collapsed-dock ↔ open-pane size morph — a lightly under-damped spring. Native (Fabric) drives the size
 *  through a layout transition; web animates it through Moti instead. */
const IS_WEB = Platform.OS === 'web';
const MORPH_SPRING = { type: 'spring' as const, stiffness: 440, damping: 26, mass: 0.5 };
const MORPH_LAYOUT = springLayout(MORPH_SPRING);
/** The close's size morph shares the swell-and-hold beat: it waits {@link CLOSE_LEAD}
 *  before the shell starts down, so the Fabric layout transition and the Moti radius
 *  /translateY spring (which already carries that delay) descend on the same frame.
 *  Without it the shell's height collapsed immediately on native and clipped the
 *  staggered rows before their exit could play. */
const MORPH_LAYOUT_CLOSING = springLayout(MORPH_SPRING).delay(CLOSE_LEAD);

/** Icon renderer — compatible with this project's icon set signature. */
export type MorphingDockSwitchIcon = (props: IconProps) => ReactNode;

/** One destination in the dock's switcher. The dock shows its icon; the open
 *  switcher shows icon + label. */
export type MorphingDockSwitchItem = {
  value: string;
  label: string;
  /** Leading icon rendered in the dock and in the open row. */
  icon?: MorphingDockSwitchIcon;
};

/** Dock/switcher size — stands on the shared interactive ramp (24 / 32 / 40px). */
export type MorphingDockSwitchSize = 'sm' | 'md' | 'lg';

export type MorphingDockSwitchProps = {
  /** The full list of destinations, in display order. */
  items: readonly MorphingDockSwitchItem[];
  /**
   * How many leading items to pin in the collapsed dock bar as icon-only
   * buttons; the rest only appear in the open switcher. Defaults to
   * `items.length` — every item is docked. @default items.length
   */
  dockCount?: number;
  /**
   * When true, the collapsed dock renders a tiny, thin caption beneath each
   * pinned item's icon (a mobile-dock style). The open switcher always shows
   * labels. @default false
   */
  showLabels?: boolean;
  /** Controlled current value. When omitted the component manages its own state. */
  value?: string;
  /** Uncontrolled initial value. Defaults to the first item's value. */
  defaultValue?: string;
  /** Called with the selected item's value. */
  onValueChange?: (value: string) => void;
  /** Controlled open state. */
  open?: boolean;
  /** Uncontrolled initial open state. */
  defaultOpen?: boolean;
  /** Called whenever the dock opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Fires once the dock has finished opening — the moment its pane has unfolded
   * far enough to be considered "presented". The dock renders inline (no
   * `Modal`), so this rides the `open` flip rather than iOS `Modal.onShow`.
   */
  onShow?: () => void;
  /** Dock/switcher size — the shared interactive ramp, so it lines up with a
   *  Button, IconButton or Dock of the same size. @default 'lg' */
  size?: MorphingDockSwitchSize;
  /** Expanded pane width in px. Defaults to 260. */
  expandedWidth?: number;
  /**
   * Swap the shell's ladder shadow for the input field's large, diffuse halo
   * (`shadow-floating`). @default false
   */
  floating?: boolean;
  /**
   * Float level for the shell — picks the `shadow-elevated-N` recipe (drop +
   * dark rim) the resting dock sits at. Opening lifts it
   * {@link OPEN_ELEVATION_LIFT} rungs higher. `0` rests flat (no shadow or
   * border) and still lifts on open. @default 0
   */
  elevation?: SurfaceElevation;
  /**
   * Backdrop blur radius in px/dp. `0` keeps the shell a solid surface; any
   * positive value frosts it — a `glass` tint over a backdrop blur (with the
   * specular edge light when `rim` is set). @default 0
   */
  blurRadius?: number;
  /** Opacity of the frosted tint (0–1); only thins the fill when `blurRadius` is set. @default 1 */
  opacity?: number;
  /** Draw the glass edge light — the `Rim` specular ring around the shell. @default false */
  rim?: boolean;
  /** Rim width in px/dp. @default 1 */
  rimWidth?: number;
  /** Peak alpha (0–1) of the rim's specular highlight — lower is subtler. @default 0.5 */
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  /** testID for the double-caret button. */
  triggerTestID?: string;
  /**
   * When true (default), pressing/clicking outside the dock closes it.
   * Works on every platform: web listens on the document, native gets a
   * full-window transparent backdrop measured from the dock's position.
   * @default true
   */
  closeOnOutsidePress?: boolean;
  /**
   * The scrim behind the pane: `"blur"`, `"opacity"`, or `"none"`. Defaults to
   * `"none"` — like the other morphing menus, it morphs in place with no scrim.
   */
  overlay?: OverlayType;
};

/**
 * A dock bar whose trailing double-caret button unfolds it into a switcher.
 *
 * Collapsed it is a horizontal dock — the first {@link MorphingDockSwitchProps.dockCount}
 * items rendered as icon-only buttons (the active one highlighted), with a
 * stacked up/down caret button on the right. Tapping the caret springs the shell
 * open into a vertical list in the original destination order. The selected row
 * starts highlighted, with the same icon and label layout as every other row. Picking a row
 * promotes it to active and folds the dock back; picking a docked icon does the
 * same without opening the switcher.
 *
 * The closed footprint is computed from the shared item geometry and stays in
 * flow while open, so the pane overlays page content without reflowing its host.
 *
 * The pane opens downward by default; when that would run it off the bottom of
 * the viewport (and there is more room above), it opens upward instead — the
 * dock's bottom edge stays anchored while the ordered list unfolds above it.
 */

type DockCaretsProps = { size: number };

/** The trailing carets — a stacked up/down pair, the dock's "show all" affordance. */
function DockCarets({ size }: DockCaretsProps) {
  // Each chevron lives in a 24×24 viewBox with dead space top and bottom, so a
  // stacked pair spreads apart; overlap the lower one to read as one tight glyph.
  const overlap = Math.round(size * CARET_OVERLAP);
  return (
    <View className="flex-col items-center">
      <ThemedIcon icon={ChevronUp} token="muted-foreground" size={size} />
      <ThemedIcon icon={ChevronDown} token="muted-foreground" size={size} style={{ marginTop: -overlap }} />
    </View>
  );
}

type DockBarProps = {
  dockItems: readonly MorphingDockSwitchItem[];
  activeValue: string | undefined;
  itemPx: number;
  iconSize: number;
  caretSize: number;
  showLabels: boolean;
  reduce: boolean;
  open: boolean;
  onSelect: (item: MorphingDockSwitchItem) => void;
  onToggle: () => void;
  accessibilityLabel?: string;
  testID: string;
  triggerTestID: string;
};

type DockDestinationProps = Pick<DockBarProps, 'itemPx' | 'iconSize' | 'showLabels' | 'reduce' | 'onSelect' | 'testID'> & {
  item: MorphingDockSwitchItem;
  active: boolean;
};

function DockDestination({ item, active, itemPx, iconSize, showLabels, reduce, onSelect, testID }: DockDestinationProps) {
  const handlePress = useCallback(() => onSelect(item), [onSelect, item]);
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      aria-selected={active}
      accessibilityLabel={item.label}
      testID={testID}
      className="relative flex-1 items-center justify-center rounded-full"
    >
      <DockContent itemPx={itemPx} labelled={showLabels} active={active} reduce={reduce} label={item.label}>
        {item.icon ? <ThemedIcon icon={item.icon} token="foreground" size={iconSize} /> : null}
      </DockContent>
    </Pressable>
  );
}

/** Analytic targets keep the shell, content and shared pill on the same clock. */
function DockBar({
  dockItems,
  activeValue,
  itemPx,
  iconSize,
  caretSize,
  showLabels,
  reduce,
  open,
  onSelect,
  onToggle,
  accessibilityLabel,
  testID,
  triggerTestID,
}: DockBarProps) {
  const rtl = useIsRTL();
  const box = dockMetrics(itemPx, showLabels);
  const row = dockRowSize(itemPx, showLabels, dockItems.length + 1);
  const selected = dockItems.findIndex((item) => item.value === activeValue);
  const rectAt = (index: number) => ({
    x: (rtl ? dockItems.length - index : index) * (box.width + DOCK_GAP),
    y: 0,
    width: box.width,
    height: box.height,
  });
  const motion = dockSizeMotion(row.width, row.height, reduce);
  return (
    <MotiView {...motion} style={[{ position: 'relative' }, motion.style]}>
      <DockHighlight rect={selected < 0 ? undefined : rectAt(selected)} reduce={reduce} testID={`${testID}-highlight`} />
      {dockItems.map((item, index) => (
        <DockFrame key={item.value} rect={rectAt(index)} reduce={reduce}>
          <DockDestination
            item={item}
            active={item.value === activeValue}
            itemPx={itemPx}
            iconSize={iconSize}
            showLabels={showLabels}
            reduce={reduce}
            onSelect={onSelect}
            testID={`${testID}-item-${item.value}`}
          />
        </DockFrame>
      ))}
      <DockFrame rect={rectAt(dockItems.length)} reduce={reduce}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          aria-expanded={open}
          accessibilityLabel={accessibilityLabel ?? 'Open dock'}
          testID={triggerTestID}
          className="flex-1 items-center justify-center rounded-full"
        >
          <MotiView animate={{ scale: showLabels ? DOCK_ICON_SCALE : 1 }} transition={reduce ? TIMING_INSTANT : DOCK_SPRING}>
            <DockCarets size={caretSize} />
          </MotiView>
        </Pressable>
      </DockFrame>
    </MotiView>
  );
}

type DockRowProps = {
  item: MorphingDockSwitchItem;
  onSelect: (item: MorphingDockSwitchItem) => void;
  scale: SwitcherScale;
  selected: boolean;
  highlighted: boolean;
  reduce: boolean;
  testID?: string;
  onInteract: () => void;
};

/** All destinations share one row layout. Only the active fill differs. */
function DockRow({ item, onSelect, scale, selected, highlighted, reduce, testID, onInteract }: DockRowProps) {
  const handlePress = useCallback(() => onSelect(item), [onSelect, item]);
  return (
    <MenuItem
      size={scale.menuItemSize}
      icon={item.icon}
      label={item.label}
      labelWeight="medium"
      active={highlighted}
      reduce={reduce}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      aria-selected={selected}
      onPress={handlePress}
      onHoverIn={onInteract}
      onPressIn={onInteract}
      onFocus={onInteract}
      className={cn(scale.rowClassName, scale.gapClassName, 'rounded-full')}
      testID={testID}
    />
  );
}

/** Whether the pane should open above the dock. */
function opensUpward(paneHeight: number, y: number, h: number, windowHeight: number): boolean {
  const spaceBelow = windowHeight - y - h - VIEWPORT_PADDING;
  const spaceAbove = y - VIEWPORT_PADDING;
  return paneHeight > spaceBelow && spaceAbove > spaceBelow;
}

/** One equally sized row per destination, plus the shell inset. */
function computePaneHeight(scale: SwitcherScale, itemCount: number): number {
  return itemCount * scale.height + PANE_INSET * 2;
}

/** The shell's surface class: resting `shadow-elevated-N`, lifted
 *  {@link OPEN_ELEVATION_LIFT} rungs while open (or the floating halo instead). */
function dockSurfaceClass(elevation: SurfaceElevation, open: boolean, floating: boolean): string {
  return elevatedSurface(elevation, open ? clampSurfaceLevel(elevation + OPEN_ELEVATION_LIFT) : elevation, floating);
}

/** Everything the shell's geometry depends on, passed as one bag so the helper
 *  stays under the parameter cap. */
type DockShellGeometry = {
  open: boolean;
  openAbove: boolean;
  scale: SwitcherScale;
  paneHeight: number;
  closedHeight: number;
  openWidth: number;
  closedWidth: number;
};

/**
 * The shell's morph transition. Closing holds the descent for {@link CLOSE_LEAD} so
 * the pane swells to its peak and sits there before it starts down. The content, the
 * row cascade and the geometry all leave on that same frame — the beat delays the
 * whole close, it never staggers its parts.
 *
 * The hold is keyed to a close being *in flight*, not to the resting closed state.
 * The shell's geometry also changes while it sits closed — a `showLabels` toggle
 * resizes the whole bar — and a delay parked on the closed state put that resize
 * `CLOSE_LEAD` behind the row it belongs to, so the bar grew a beat after its own
 * content and clipped it.
 */
function dockMorphTransition(closing: boolean, reduce: boolean) {
  if (reduce) return TIMING_INSTANT;
  return closing ? { ...MORPH_SPRING, delay: CLOSE_LEAD } : MORPH_SPRING;
}

/**
 * The shell's Fabric layout transition. Web animates size through Moti (no layout
 * transition) and reduced motion snaps, so both yield `undefined`. Otherwise the
 * close uses the {@link CLOSE_LEAD}-delayed builder so the height/width descent
 * keeps the same beat as the Moti radius/translateY spring — see
 * {@link MORPH_LAYOUT_CLOSING}.
 */
function dockMorphLayout(closing: boolean, reduce: boolean) {
  if (reduce || IS_WEB) return;
  return closing ? MORPH_LAYOUT_CLOSING : MORPH_LAYOUT;
}

/**
 * The shell's animated geometry. Web animates `height`/`width` through Moti (the
 * original smooth morph); Fabric keeps a static size and drives the change via
 * the `layout` transition (layout props don't round-trip Yoga there). The radius
 * and upward-open `translateY` spring on `MORPH_SPRING` either way.
 *
 * The pane stays a plain column — its content is packed against the pane's TOP
 * edge, so it rides that edge as the pane grows and shrinks. Opening upward
 * anchors the pane's bottom to the dock's bottom edge, which makes the top edge
 * the one that travels: the rows descend with it on close and slide back out of
 * the dock on open. Reversing the column instead would pin them to the fixed
 * bottom edge, leaving the pane to collapse around a list that never moved.
 */
function dockShellGeometry({ open, openAbove, scale, paneHeight, closedHeight, openWidth, closedWidth }: DockShellGeometry) {
  const radius = open ? scale.paneRadius : closedHeight / 2;
  // Opening upward anchors the pane's bottom to the dock's bottom edge: shift
  // the shell up by its growth so it extends above instead of below.
  const translateY = open && openAbove ? closedHeight - paneHeight : 0;
  const animate = IS_WEB
    ? {
        width: open ? openWidth : closedWidth,
        height: open ? paneHeight : closedHeight,
        borderRadius: radius,
        translateY,
      }
    : { borderRadius: radius, translateY };
  const style: StyleProp<ViewStyle> = IS_WEB
    ? [open ? { zIndex: 40 } : undefined]
    : [
        {
          width: open ? openWidth : closedWidth,
          height: open ? paneHeight : closedHeight,
        },
        open ? { zIndex: 40 } : undefined,
      ];
  return { animate, style };
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the shell wires dock measurement, outside-press handling, and the morph pane around shared refs/state — splitting would prop-drill the shared values across function boundaries
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the glass/solid shell branch doubles the surface host the morph subtree renders through — flattening it would duplicate the dock + row subtree
export function MorphingDockSwitch({
  items,
  dockCount,
  showLabels = false,
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  onShow,
  size = 'lg',
  expandedWidth = 260,
  floating = false,
  elevation = 0,
  blurRadius = 0,
  opacity = 1,
  rim = false,
  rimWidth,
  intensity,
  style,
  accessibilityLabel,
  testID = 'morphing-dock-switch',
  triggerTestID = 'morphing-dock-switch-trigger',
  closeOnOutsidePress = true,
  overlay = 'none',
}: MorphingDockSwitchProps) {
  const reduce = useReducedMotion();
  const scale = SWITCHER_SCALE[size];
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const rootRef = useRef<View>(null);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const { expanded, closing, scaleStyle } = useSwitcherMotion(open, reduce);
  const [internalValue, setInternalValue] = useState<string | undefined>(defaultValue ?? items[0]?.value);
  const value = valueProp ?? internalValue;

  // On Android the blur must render OUTSIDE the `BlurTarget` it frosts (see
  // `OverlayHost`), so a frosted dock teleports its backdrop + shell there. The
  // morph still runs; the shell just lives in the overlay host instead of inline.
  // Whenever a host exists, render through it for EVERY `overlay` — `overlay`
  // still decides the scrim, teleporting only relocates the backdrop + shell.
  const blurTargetRef = useBlurTargetRef();
  const teleported = Platform.OS === 'android' && blurTargetRef !== null;

  /** True while the pane opens upward — the list sits above the dock instead of below. */
  const [openAbove, setOpenAbove] = useState(false);
  /** Opening highlights the selection until the user interacts with the list. */
  const [anyRowFocused, setAnyRowFocused] = useState(false);
  /** The outside-press backdrop's window-covering frame. Null while closed. */
  const [backdropFrame, setBackdropFrame] = useState<OutsidePressFrame | null>(null);

  /** The inline root's window frame — measured on every root layout so the
   *  teleported shell sits exactly where the inline one would. */
  const [rootFrame, setRootFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const measureSeq = useRef(0);
  const measureRoot = useCallback(() => {
    measureSeq.current += 1;
    const seq = measureSeq.current;
    if (!teleported) {
      setRootFrame(null);
      return;
    }
    rootRef.current?.measureInWindow((x, y, width, height) => {
      if (seq !== measureSeq.current) return;
      setRootFrame({ x, y, width, height });
    });
  }, [teleported]);

  // biome-ignore lint/plugin: measuring the root is a native measure side effect, not derived state — the teleported overlay must follow the window
  useEffect(() => {
    measureRoot();
  }, [measureRoot]);

  // biome-ignore lint/plugin: deferred re-measure after the native layout settles — a DOM/native measure side effect, not derived render state
  useEffect(() => {
    if (!teleported) return;
    const timer = setTimeout(measureRoot, 150);
    return () => clearTimeout(timer);
  }, [measureRoot, teleported]);

  const dockedCount = Math.min(Math.max(dockCount ?? items.length, 0), items.length);
  const dockItems = items.slice(0, dockedCount);

  const itemPx = INTERACTIVE_HEIGHT[size] - 4;
  const iconSize = Math.round(itemPx * 0.5);
  // The caret chevrons grow with the labelled pill, matching the item icons'
  // label-mode scale so the trigger reads as part of the same enlarged bar.
  const caretSize = scale.stackedCaretSize;

  const paneHeight = computePaneHeight(scale, items.length);
  const closedRow = dockRowSize(itemPx, showLabels, dockItems.length + 1);
  const closedWidth = closedRow.width + PANE_INSET * 2;
  const closedHeight = closedRow.height + PANE_INSET * 2;
  const rootMotion = dockSizeMotion(closedWidth, closedHeight, reduce);
  const openWidth = Math.max(expandedWidth, closedWidth);

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const handleOpen = useCallback(() => {
    rootRef.current?.measureInWindow((_x, y, _w, h) => {
      setOpenAbove(opensUpward(paneHeight, y, h, windowHeight));
      setOpen(true);
    });
  }, [setOpen, windowHeight, paneHeight]);

  const handleToggle = useCallback(() => {
    if (open) setOpen(false);
    else handleOpen();
  }, [open, setOpen, handleOpen]);

  const handleClose = useCallback(() => setOpen(false), [setOpen]);

  // biome-ignore lint/plugin: measuring the root on open/rotate is a DOM/native measure side effect, not derived state — the backdrop frame must follow the window
  useEffect(() => {
    if (!(open && (overlay !== 'none' || closeOnOutsidePress))) {
      setBackdropFrame(null);
      return;
    }
    rootRef.current?.measureInWindow((x, y) => {
      setBackdropFrame({ top: -y, left: -x, width: windowWidth, height: windowHeight });
    });
  }, [open, overlay, closeOnOutsidePress, windowWidth, windowHeight]);

  // biome-ignore lint/plugin: fires in response to the open flip — a presentational side effect, not derived render state
  useEffect(() => {
    if (open) onShow?.();
  }, [open, onShow]);

  // biome-ignore lint/plugin: presentational side effect driven by the open flip — resets focus tracking so the active row re-highlights on next open
  useEffect(() => {
    if (open) setAnyRowFocused(false);
  }, [open]);

  // biome-ignore lint/plugin: document-level pointerdown can't be expressed as an RN handler or derived state
  useEffect(() => {
    if (!(open && closeOnOutsidePress)) return;
    const doc = getWebDocument();
    if (!doc) return;

    const onPointerDown = (event: WebPointerEvent) => {
      const node = rootRef.current;
      const target = event.target;
      if (isWebNode(node) && node.contains(target)) return;
      setOpen(false);
    };

    doc.addEventListener('pointerdown', onPointerDown);
    return () => doc.removeEventListener('pointerdown', onPointerDown);
  }, [open, closeOnOutsidePress, setOpen]);

  const handleRowFocus = useCallback(() => setAnyRowFocused(true), []);

  const handleDockSelect = useCallback(
    (item: MorphingDockSwitchItem) => {
      if (valueProp === undefined) setInternalValue(item.value);
      onValueChange?.(item.value);
    },
    [valueProp, onValueChange],
  );

  const handleSelect = useCallback(
    (item: MorphingDockSwitchItem) => {
      if (item.value !== value) {
        if (valueProp === undefined) setInternalValue(item.value);
        onValueChange?.(item.value);
      }
      setOpen(false);
    },
    [value, valueProp, onValueChange, setOpen],
  );

  // On web `height`/`width` morph through Moti on `MORPH_SPRING`; on Fabric they
  // ride `MORPH_LAYOUT` (a layout transition). The radius and upward-open
  // `translateY` spring on `MORPH_SPRING` either way.
  //
  // The geometry follows `open`, never the retained `expanded`: the pane has to
  // start collapsing on the same frame the content does, so the rows inside it
  // are carried down by the very edge they are fading against. Waiting out the
  // retention first is what left the list dissolving in place while an emptied
  // pane collapsed a beat later, the two reading as separate motions.
  const morphTransition = dockMorphTransition(closing, reduce);
  const shell = dockShellGeometry({ open, openAbove, scale, paneHeight, closedHeight, openWidth, closedWidth });

  const rootWindow = rootFrame ? { x: rootFrame.x, y: rootFrame.y } : null;
  const wrapperWidth = rootFrame?.width ?? 0;
  const wrapperHeight = rootFrame?.height ?? 0;

  const backdrop =
    open && (overlay !== 'none' || closeOnOutsidePress) && backdropFrame !== null ? (
      <OutsidePressBackdrop
        key="morphing-dock-switch-backdrop"
        frame={backdropFrame}
        onPressIn={closeOnOutsidePress ? handleClose : undefined}
        overlay={overlay}
        blurInline={!teleported}
        testID={`${testID}-backdrop`}
      />
    ) : null;

  const glass = blurRadius > 0;

  const shellContent = expanded ? (
    // The content thins out over the collapse so the rows dissolve *as* they fall
    // instead of staying solid for most of the drop and blinking out in the last
    // few frames. It holds through the opening beat — the shell's swell and the
    // staggered row exit — and spends the fade on the tail, which is why it runs on
    // `CONTENT_FADE` rather than the shell's own spring. It follows `open`
    // declaratively: driving it from an effect instead would leave the wrapper
    // mounted with a stale 0 on the opening frame and flash the content invisible.
    <MotiView
      pointerEvents={closing ? 'none' : 'auto'}
      animate={{ opacity: open ? 1 : 0 }}
      transition={reduce ? TIMING_INSTANT : CONTENT_FADE}
      testID={`${testID}-content`}
    >
      {items.map((item, index) => (
        <SwitcherMotionRow
          key={item.value}
          index={index}
          count={items.length}
          closing={closing}
          openAbove={openAbove}
          exitOrder="bottom"
          reduce={reduce}
          testID={`${testID}-row-${item.value}`}
        >
          <DockRow
            item={item}
            onSelect={handleSelect}
            scale={scale}
            selected={item.value === value}
            highlighted={item.value === value && !anyRowFocused}
            reduce={reduce}
            testID={item.value === value ? `${testID}-header` : `${testID}-item-${item.value}`}
            onInteract={handleRowFocus}
          />
        </SwitcherMotionRow>
      ))}
    </MotiView>
  ) : (
    <DockBar
      dockItems={dockItems}
      activeValue={value}
      itemPx={itemPx}
      iconSize={iconSize}
      caretSize={caretSize}
      showLabels={showLabels}
      reduce={reduce}
      open={open}
      onSelect={handleDockSelect}
      onToggle={handleToggle}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      triggerTestID={triggerTestID}
    />
  );

  const shellView = glass ? (
    <Surface
      as={MotiView}
      testID={`${testID}-shell`}
      animate={shell.animate}
      transition={morphTransition}
      layout={dockMorphLayout(closing, reduce)}
      elevation={open ? clampSurfaceLevel(elevation + OPEN_ELEVATION_LIFT) : elevation}
      floating={floating}
      blurRadius={blurRadius}
      opacity={opacity}
      rim={rim}
      rimWidth={rimWidth}
      intensity={intensity}
      borderRadius={open ? scale.paneRadius : closedHeight / 2}
      className="absolute top-0 left-0 overflow-hidden p-1"
      style={shell.style}
    >
      {shellContent}
    </Surface>
  ) : (
    <MotiView
      testID={`${testID}-shell`}
      animate={shell.animate}
      transition={morphTransition}
      layout={dockMorphLayout(closing, reduce)}
      className={cn('absolute top-0 left-0 overflow-hidden p-1', dockSurfaceClass(elevation, open, floating))}
      style={shell.style}
    >
      {shellContent}
    </MotiView>
  );

  return (
    <MotiView
      {...rootMotion}
      // The root's own size never changes while opening/closing, so its `layout`
      // transition is dead — but a nested `layout` on this ancestor would shadow
      // the shell's size morph on Fabric. Drop it; the shell owns the morph.
      layout={undefined}
      ref={rootRef}
      collapsable={false}
      testID={testID}
      onLayout={measureRoot}
      className="self-center"
      style={[rootMotion.style, { zIndex: expanded ? 40 : 0 }, style]}
    >
      {teleported ? (
        <TeleportedOverlay teleported={teleported} rootWindow={rootWindow} width={wrapperWidth} height={wrapperHeight}>
          <AnimatePresence>{backdrop}</AnimatePresence>
          <Animated.View testID={`${testID}-motion`} style={[StyleSheet.absoluteFill, scaleStyle]}>
            {shellView}
          </Animated.View>
        </TeleportedOverlay>
      ) : (
        <>
          <AnimatePresence>{backdrop}</AnimatePresence>
          <Animated.View testID={`${testID}-motion`} style={[StyleSheet.absoluteFill, scaleStyle]}>
            {shellView}
          </Animated.View>
        </>
      )}
    </MotiView>
  );
}
