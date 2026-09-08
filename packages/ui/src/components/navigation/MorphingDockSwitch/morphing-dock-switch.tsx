// biome-ignore-all lint/style/noExcessiveLinesPerFile: dock shell, morph transition, and trigger/pane layouts collocated by design
// biome-ignore-all lint/style/useExportsLast: the public icon/item/props types head the module so the sub-components below read against them
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { DownLine as ChevronDown } from 'rn-motion-ui-icons/icons/down-line';
import { UpLine as ChevronUp } from 'rn-motion-ui-icons/icons/up-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { EASE_OUT, SPRING_SWAP, springLayout } from '../../../lib/ease';
import { clampSurfaceLevel, elevated as elevatedSurface, type SurfaceElevation } from '../../../lib/elevated';
import { INTERACTIVE_HEIGHT } from '../../../lib/radius';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { TIMING_INSTANT } from '../../../theme/motion';
import { Surface } from '../../display/Surface/surface';
import { ThemedIcon } from '../../icon/themed-icon';
import { SWITCHER_SCALE, type SwitcherScale } from '../../menus/MorphingSwitcher/morphing-switcher-scale';
import { useBlurTargetRef } from '../../menus/Overlay/blur-context';
import { OutsidePressBackdrop, type OutsidePressFrame } from '../../menus/Overlay/outside-press-backdrop';
import type { OverlayType } from '../../menus/Overlay/overlay-type';
import { TeleportedOverlay } from '../../menus/Overlay/teleported-overlay';
import { getWebDocument, isWebNode, type WebPointerEvent } from '../../menus/Overlay/web-document';
import { MenuItem } from '../../rows/menu-item';
import { Text } from '../../typography/Text/text';

/** Minimum clearance kept between the open pane and the viewport edge when deciding whether to flip up. */
const VIEWPORT_PADDING = 8;
/** `p-1` inset between the shell edge and its content, so the dock icons and open rows never run flush to the rim. */
const PANE_INSET = 4;
/** Icon-only pill width factor — narrower than the labelled pill, so an
 *  icon-only item reads as a compact capsule instead of a square. */
const ICON_PILL_ASPECT = 1.2;
/** Labelled pill width factor — wider to fit the icon + caption column. */
const LABEL_PILL_ASPECT = 1.8;
/** The icon renders at its base size and scales up this much in labelled mode. */
const LABEL_ICON_SCALE = 1.25;
/** Rungs the shell floats above its resting `elevation` while open. */
const OPEN_ELEVATION_LIFT = 2;
/** Collapsed-dock ↔ open-pane size morph — a slightly over-damped spring so the
 *  pane unfolds and settles without overshoot. Native (Fabric) drives the size
 *  through a layout transition; web animates it through Moti instead. */
const IS_WEB = Platform.OS === 'web';
const MORPH_SPRING = { type: 'spring' as const, stiffness: 360, damping: 40, mass: 0.6 };
const MORPH_LAYOUT = springLayout(MORPH_SPRING);

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
 * open into a vertical list that morphs in place: the active item becomes the
 * header row (icon + label + the stacked carets), the remaining docked items and
 * any overflow items fill in below with their labels revealed. Picking a row
 * promotes it to active and folds the dock back; picking a docked icon does the
 * same without opening the switcher.
 *
 * The closed dock is measured once (`onLayout`) so the morph starts from its
 * exact footprint; an offscreen, unnamed measurer keeps that footprint in flow
 * while open, so the pane overlays page content without reflowing the header
 * that hosts it.
 *
 * The pane opens downward by default; when that would run it off the bottom of
 * the viewport (and there is more room above), it opens upward instead — the
 * dock stays put as the list's bottom row and the items fill in above it.
 */

type DockCaretsProps = { size: number };

/** The trailing carets — a stacked up/down pair, the dock's "show all" affordance. */
function DockCarets({ size }: DockCaretsProps) {
  return (
    <View className="flex-col items-center">
      <ThemedIcon icon={ChevronUp} token="muted-foreground" size={size} />
      <ThemedIcon icon={ChevronDown} token="muted-foreground" size={size} />
    </View>
  );
}

type DockIconProps = {
  item: MorphingDockSwitchItem;
  active: boolean;
  itemPx: number;
  iconSize: number;
  showLabels: boolean;
  /** Reduced-motion flag — collapses the icon/label scale transitions to instant. */
  reduce: boolean;
  /** Present on the interactive copy; absent on the offscreen measurer. */
  onPress?: () => void;
  testID?: string;
};

/** One dock button — icon only, or icon stacked over a tiny caption when
 *  `showLabels` is on. The active one wears the `bg-surface-selected` pill.
 *  Renders a non-interactive `View` when `onPress` is absent. */
function DockIcon({ item, active, itemPx, iconSize, showLabels, reduce, onPress, testID }: DockIconProps) {
  const scaleTransition = reduce ? TIMING_INSTANT : SPRING_SWAP;
  const content = item.icon ? (
    <MotiView animate={{ scale: showLabels ? LABEL_ICON_SCALE : 1 }} transition={scaleTransition}>
      <ThemedIcon icon={item.icon} token="foreground" size={iconSize} />
    </MotiView>
  ) : null;
  const label = (
    <AnimatePresence>
      {showLabels ? (
        <MotiView
          key="label"
          from={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={scaleTransition}
        >
          <Text className="text-[10px]" numberOfLines={1}>
            {item.label}
          </Text>
        </MotiView>
      ) : null}
    </AnimatePresence>
  );
  const className = cn(
    'flex-col items-center justify-center rounded-full',
    active && 'bg-surface-selected',
    showLabels && 'gap-0.5',
  );
  // A labelled item is wider and stacks the icon over a tiny caption; an
  // icon-only item is a narrower pill.
  const style = showLabels ? { width: itemPx * LABEL_PILL_ASPECT } : { width: itemPx * ICON_PILL_ASPECT, height: itemPx };
  if (!onPress)
    return (
      <View className={className} style={style}>
        {content}
        {label}
      </View>
    );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      aria-selected={active}
      accessibilityLabel={item.label}
      testID={testID}
      className={className}
      style={style}
    >
      {content}
      {label}
    </Pressable>
  );
}

type DockCaretProps = {
  itemPx: number;
  caretSize: number;
  open: boolean;
  /** Present on the interactive copy; absent on the offscreen measurer. */
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

/** The double-caret trigger button at the dock's right end. */
function DockCaret({ itemPx, caretSize, open, onPress, accessibilityLabel, testID }: DockCaretProps) {
  const content = <DockCarets size={caretSize} />;
  const className = 'items-center justify-center rounded-full';
  const style = { width: itemPx * ICON_PILL_ASPECT, height: itemPx };
  if (!onPress)
    return (
      <View className={className} style={style}>
        {content}
      </View>
    );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      aria-expanded={open}
      accessibilityLabel={accessibilityLabel ?? 'Open dock'}
      testID={testID}
      className={className}
      style={style}
    >
      {content}
    </Pressable>
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
  /** When false the bar renders as the offscreen, non-interactive measurer. */
  interactive: boolean;
  onSelect?: (item: MorphingDockSwitchItem) => void;
  onToggle?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  accessibilityLabel?: string;
  testID?: string;
  triggerTestID?: string;
};

/**
 * The collapsed dock: the pinned icon buttons and the trailing caret. Rendered
 * twice — once interactive inside the shell, once unnamed/`aria-hidden` as the
 * offscreen measurer that reserves the collapsed footprint in flow and reports
 * its size via `onLayout`.
 */
function DockBar({
  dockItems,
  activeValue,
  itemPx,
  iconSize,
  caretSize,
  showLabels,
  reduce,
  open,
  interactive,
  onSelect,
  onToggle,
  onLayout,
  accessibilityLabel,
  testID,
  triggerTestID,
}: DockBarProps) {
  const inner = (
    <>
      {dockItems.map((item) => (
        <DockIcon
          key={item.value}
          item={item}
          active={item.value === activeValue}
          itemPx={itemPx}
          iconSize={iconSize}
          showLabels={showLabels}
          reduce={reduce}
          onPress={interactive ? () => onSelect?.(item) : undefined}
          testID={interactive ? `${testID}-item-${item.value}` : undefined}
        />
      ))}
      <DockCaret
        itemPx={itemPx}
        caretSize={caretSize}
        open={open}
        onPress={interactive ? onToggle : undefined}
        accessibilityLabel={accessibilityLabel}
        testID={interactive ? triggerTestID : undefined}
      />
    </>
  );

  if (!interactive)
    return (
      <View aria-hidden={true} onLayout={onLayout} className="pointer-events-none flex-row items-center gap-1.5 opacity-0">
        {inner}
      </View>
    );

  return <View className="flex-row items-center gap-1.5">{inner}</View>;
}

type DockHeaderProps = { item: MorphingDockSwitchItem; scale: SwitcherScale; onPress: () => void; testID?: string };

/**
 * The active item's header row while open — icon + label on the left, the
 * stacked carets on the right. Re-tapping it folds the dock back (the standard
 * switcher dismissal), so it stays pressable while only looking inert.
 */
function DockHeader({ item, scale, onPress, testID }: DockHeaderProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      testID={testID}
      className={cn(scale.rowClassName, scale.gapClassName, 'justify-between self-stretch opacity-40')}
    >
      <View className={cn('flex-row items-center', scale.gapClassName)}>
        {item.icon ? <ThemedIcon icon={item.icon} token="foreground" size={scale.iconSize} /> : null}
        <Text size={scale.labelSize} weight="medium" numberOfLines={1}>
          {item.label}
        </Text>
      </View>
      <DockCarets size={scale.stackedCaretSize} />
    </Pressable>
  );
}

type DockRowProps = {
  item: MorphingDockSwitchItem;
  /** Stable handler — the row binds its own item so no per-render closure. */
  onSelect: (item: MorphingDockSwitchItem) => void;
  scale: SwitcherScale;
  testID?: string;
};

/** One non-active row in the open pane: icon + label. */
function DockRow({ item, onSelect, scale, testID }: DockRowProps) {
  const handlePress = useCallback(() => onSelect(item), [onSelect, item]);
  return (
    <MenuItem
      size={scale.menuItemSize}
      icon={item.icon}
      label={item.label}
      labelWeight="medium"
      onPress={handlePress}
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

/** The pane's open height: one row per non-active item stacked on the header
 *  row's height, plus the shell's `p-1` inset on both ends. */
function computePaneHeight(scale: SwitcherScale, itemCount: number): number {
  return scale.height + itemCount * scale.height + PANE_INSET * 2;
}

/** A measured dock's bounding box. */
type DockSize = { width: number; height: number };

/** Merge a freshly-measured dock size, returning the previous object unchanged
 *  when the dimensions match. */
function mergeDockSize(prev: DockSize | null, size: DockSize): DockSize {
  if (prev && prev.width === size.width && prev.height === size.height) return prev;
  return size;
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
 * The shell's animated geometry. Web animates `height`/`width` through Moti (the
 * original smooth morph); Fabric keeps a static size and drives the change via
 * the `layout` transition (layout props don't round-trip Yoga there). The radius
 * and upward-open `translateY` spring on `MORPH_SPRING` either way.
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
    ? [{ flexDirection: openAbove ? 'column-reverse' : 'column' }, open ? { zIndex: 40 } : undefined]
    : [
        {
          flexDirection: openAbove ? 'column-reverse' : 'column',
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
  const [internalValue, setInternalValue] = useState<string | undefined>(defaultValue ?? items[0]?.value);
  const value = valueProp ?? internalValue;

  // On Android the blur must render OUTSIDE the `BlurTarget` it frosts (see
  // `OverlayHost`), so a frosted dock teleports its backdrop + shell there. The
  // morph still runs; the shell just lives in the overlay host instead of inline.
  // Whenever a host exists, render through it for EVERY `overlay` — `overlay`
  // still decides the scrim, teleporting only relocates the backdrop + shell.
  const blurTargetRef = useBlurTargetRef();
  const teleported = Platform.OS === 'android' && blurTargetRef !== null;

  /** The measured collapsed dock's footprint. */
  const [dockSize, setDockSize] = useState<DockSize | null>(null);
  /** True while the pane opens upward — the list sits above the dock instead of below. */
  const [openAbove, setOpenAbove] = useState(false);
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

  const activeItem = items.find((item) => item.value === value);
  const otherItems = items.filter((item) => item.value !== value);
  const dockedCount = Math.min(Math.max(dockCount ?? items.length, 0), items.length);
  const dockItems = items.slice(0, dockedCount);

  const itemPx = INTERACTIVE_HEIGHT[size] - 4;
  const iconSize = Math.round(itemPx * 0.5);

  const paneHeight = computePaneHeight(scale, otherItems.length);
  const closedWidth = (dockSize?.width ?? 0) + PANE_INSET * 2;
  const closedHeight = (dockSize?.height ?? itemPx) + PANE_INSET * 2;
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

  const handleDockSelect = useCallback(
    (item: MorphingDockSwitchItem) => {
      if (valueProp === undefined) setInternalValue(item.value);
      onValueChange?.(item.value);
    },
    [valueProp, onValueChange],
  );

  const handleSelect = useCallback(
    (item: MorphingDockSwitchItem) => {
      if (valueProp === undefined) setInternalValue(item.value);
      onValueChange?.(item.value);
      setOpen(false);
    },
    [valueProp, onValueChange, setOpen],
  );

  const handleDockLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setDockSize((prev) => mergeDockSize(prev, { width, height }));
  }, []);

  // On web `height`/`width` morph through Moti on `MORPH_SPRING`; on Fabric they
  // ride `MORPH_LAYOUT` (a layout transition). The radius and upward-open
  // `translateY` spring on `MORPH_SPRING` either way.
  const morphTransition = reduce ? TIMING_INSTANT : MORPH_SPRING;

  // The rows follow the shell closely — a long delay left the pane looking empty
  // while it unfolded.
  const paneEnterTransition = reduce ? TIMING_INSTANT : { type: 'timing' as const, duration: 180, delay: 40, easing: EASE_OUT };

  const shell = dockShellGeometry({ open, openAbove, scale, paneHeight, closedHeight, openWidth, closedWidth });

  const rootWindow = rootFrame ? { x: rootFrame.x, y: rootFrame.y } : null;
  const wrapperWidth = rootFrame?.width ?? 0;
  const wrapperHeight = rootFrame?.height ?? 0;

  const backdrop =
    open && (overlay !== 'none' || closeOnOutsidePress) && backdropFrame !== null ? (
      <OutsidePressBackdrop
        key="morphing-dock-switch-backdrop"
        frame={backdropFrame}
        onPress={closeOnOutsidePress ? handleClose : undefined}
        overlay={overlay}
        blurInline={!teleported}
        testID={`${testID}-backdrop`}
      />
    ) : null;

  const glass = blurRadius > 0;

  const shellContent = open ? (
    <>
      {activeItem ? <DockHeader item={activeItem} scale={scale} onPress={handleClose} testID={`${testID}-header`} /> : null}
      <MotiView
        from={reduce ? { opacity: 1 } : { opacity: 0, translateY: 4 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={paneEnterTransition}
      >
        {otherItems.map((item) => (
          <DockRow key={item.value} item={item} onSelect={handleSelect} scale={scale} testID={`${testID}-item-${item.value}`} />
        ))}
      </MotiView>
    </>
  ) : (
    <DockBar
      dockItems={dockItems}
      activeValue={value}
      itemPx={itemPx}
      iconSize={iconSize}
      caretSize={scale.stackedCaretSize}
      showLabels={showLabels}
      reduce={reduce}
      open={open}
      interactive={true}
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
      animate={shell.animate}
      transition={morphTransition}
      layout={reduce || IS_WEB ? undefined : MORPH_LAYOUT}
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
      animate={shell.animate}
      transition={morphTransition}
      layout={reduce || IS_WEB ? undefined : MORPH_LAYOUT}
      className={cn('absolute top-0 left-0 overflow-hidden p-1', dockSurfaceClass(elevation, open, floating))}
      style={shell.style}
    >
      {shellContent}
    </MotiView>
  );

  return (
    <View ref={rootRef} collapsable={false} testID={testID} onLayout={measureRoot} style={[{ zIndex: open ? 40 : 0 }, style]}>
      {/* Offscreen measurer holds the collapsed footprint in flow. */}
      <DockBar
        dockItems={dockItems}
        activeValue={value}
        itemPx={itemPx}
        iconSize={iconSize}
        caretSize={scale.stackedCaretSize}
        showLabels={showLabels}
        reduce={reduce}
        open={open}
        interactive={false}
        onLayout={handleDockLayout}
      />

      {teleported ? (
        <TeleportedOverlay teleported={teleported} rootWindow={rootWindow} width={wrapperWidth} height={wrapperHeight}>
          <AnimatePresence>{backdrop}</AnimatePresence>
          {shellView}
        </TeleportedOverlay>
      ) : (
        <>
          <AnimatePresence>{backdrop}</AnimatePresence>
          {shellView}
        </>
      )}
    </View>
  );
}
