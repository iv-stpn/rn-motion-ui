// biome-ignore-all lint/style/noExcessiveLinesPerFile: switcher shell, morph transition, and trigger/pane layouts collocated by design
// biome-ignore-all lint/style/useExportsLast: the public icon/item/variant/props types head the module so the sub-components below read against them
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { DownLine as ChevronDown } from 'rn-motion-ui-icons/icons/down-line';
import { UpLine as ChevronUp } from 'rn-motion-ui-icons/icons/up-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { springLayout } from '../../../lib/ease';
import { clampSurfaceLevel, elevated as elevatedSurface, type SurfaceElevation } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { TIMING_INSTANT } from '../../../theme/motion';
import { Surface } from '../../display/Surface/surface';
import { ThemedIcon } from '../../icon/themed-icon';
import { MenuItem } from '../../rows/menu-item';
import { Text } from '../../typography/Text/text';
import { useBlurTargetRef } from '../Overlay/blur-context';
import { OutsidePressBackdrop, type OutsidePressFrame } from '../Overlay/outside-press-backdrop';
import type { OverlayType } from '../Overlay/overlay-type';
import { TeleportedOverlay } from '../Overlay/teleported-overlay';
import { getWebDocument, isWebNode, type WebPointerEvent } from '../Overlay/web-document';
import { type MorphingSwitcherSize, SWITCHER_SCALE, type SwitcherScale } from './morphing-switcher-scale';
import { SwitcherMotionRow } from './switcher-motion';
import { CLOSE_LEAD, useSwitcherMotion } from './use-switcher-motion';

// The switcher's size type is public API — re-exported beside the import that
// resolves it so every consumer keeps importing it from `./morphing-switcher`.
export type { MorphingSwitcherSize } from './morphing-switcher-scale';

/** Minimum clearance kept between the open pane and the viewport edge when deciding whether to flip up. */
const VIEWPORT_PADDING = 8;
/** `p-1` inset between the shell edge and its content, so the trigger and hover pills never run flush to the pane rim. */
const PANE_INSET = 4;
/** Fraction of a caret's size to overlap the stacked pair's lower chevron — each
 *  chevron lives in a 24×24 viewBox with dead space top and bottom, so a stacked
 *  pair spreads apart; overlapping the lower one reads as one tight glyph. */
const CARET_OVERLAP = 0.3;
/** Rungs the shell floats above its resting `elevation` while open. */
const OPEN_ELEVATION_LIFT = 2;
/** Collapsed-trigger ↔ open-pane size morph — lightly under-damped.
 *  The size stays in lockstep
 *  with the `translateY` upward-open shift below. Native (Fabric) drives the
 *  size through this layout transition; web animates it through Moti instead —
 *  see `switcherShellGeometry` below. */
const IS_WEB = Platform.OS === 'web';
const MORPH_SPRING = { type: 'spring' as const, stiffness: 440, damping: 26, mass: 0.5 };
const MORPH_LAYOUT = springLayout(MORPH_SPRING);
/** The close's size morph shares the swell-and-hold beat: it waits {@link CLOSE_LEAD}
 *  before the shell starts down, so the Fabric layout transition and the Moti radius
 *  /translateY spring (which already carries that delay) descend on the same frame. */
const MORPH_LAYOUT_CLOSING = springLayout(MORPH_SPRING).delay(CLOSE_LEAD);

/** The pane's size morph. Opening has nothing to wait for; a close in flight holds the
 *  descent for {@link CLOSE_LEAD} so the shell swells to its peak and sits there before
 *  it starts down, in step with the rows and the content. Keying that hold to the
 *  resting closed state instead would delay *every* closed-state resize by a beat —
 *  see {@link dockMorphTransition} in `MorphingDockSwitch`, where that was visible. */
function closeMorphTransition(closing: boolean) {
  return closing ? { ...MORPH_SPRING, delay: CLOSE_LEAD } : MORPH_SPRING;
}

/**
 * The shell's Fabric layout transition. Web animates size through Moti (no layout
 * transition) and reduced motion snaps, so both yield `undefined`. Otherwise the
 * close uses the {@link CLOSE_LEAD}-delayed builder so the height descent keeps the
 * same beat as the Moti radius/translateY spring — see {@link MORPH_LAYOUT_CLOSING}.
 */
function switcherMorphLayout(closing: boolean, reduce: boolean) {
  if (reduce || IS_WEB) return;
  return closing ? MORPH_LAYOUT_CLOSING : MORPH_LAYOUT;
}

/** Icon renderer — compatible with this project's icon set signature. */
export type MorphingSwitcherIcon = (props: IconProps) => ReactNode;

/** One selectable entry in the switcher's item list. */
export type MorphingSwitcherItem = {
  value: string;
  label: string;
  /** Leading icon rendered in the trigger and in the item row. */
  icon?: MorphingSwitcherIcon;
};

/**
 * Collapsed-trigger layout.
 * - `'select'` — a compact pill that hugs its content (icon + label + one down
 *   caret) and morphs into the full item list on open.
 * - `'switcher'` — a bar with stacked up/down carets on the right; on open the
 *   trigger becomes the active row of the list. It hugs its content unless
 *   {@link MorphingSwitcherProps.fullWidth} stretches it across the parent.
 */
export type MorphingSwitcherVariant = 'select' | 'switcher';

export type MorphingSwitcherProps = {
  /** The selectable items, in display order. */
  items: readonly MorphingSwitcherItem[];
  /** Controlled current value. When omitted the component manages its own state. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  /** Called with the selected item's value. The switcher closes itself on selection. */
  onValueChange?: (value: string) => void;
  /** Label shown in the trigger when `value` matches no item. Defaults to `"Select"`. */
  placeholder?: string;
  /** Icon shown in the trigger when `value` matches no item. */
  placeholderIcon?: MorphingSwitcherIcon;
  /** Expanded pane width in px. Defaults to 240. Ignored when `fullWidth` is set, since the pane then spans its parent. */
  expandedWidth?: number;
  /** Expanded pane height in px. Defaults to a fit for the item list. */
  expandedHeight?: number;
  /** Controlled open state. */
  open?: boolean;
  /** Uncontrolled initial open state. */
  defaultOpen?: boolean;
  /** Called whenever the switcher opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Fires once the switcher has finished opening — the moment its pane has
   * unfolded far enough to be considered "presented". The switcher renders inline
   * (no `Modal`), so this rides the `open` flip rather than iOS `Modal.onShow`.
   * Use it to focus a `TextInput` inside the pane once the pane is on screen.
   */
  onShow?: () => void;
  /** Trailing icon rendered on the open trigger (`select` only). Defaults to an
   *  up-caret (the trigger's down-caret flipped). Pass `null` to omit it. The
   *  open trigger is disabled, so this is a visual hint rather than a control. */
  closeIcon?: ReactNode | null;
  /** Collapsed-trigger layout. Defaults to `"switcher"`. */
  variant?: MorphingSwitcherVariant;
  /**
   * Stretch the trigger (and the open pane) across the parent instead of hugging
   * the trigger's content. Off by default: the collapsed trigger is exactly as
   * wide as its icon, label and carets need. @default false
   */
  fullWidth?: boolean;
  /** Trigger and row height — the shared interactive ramp, so it lines up with
   *  a Button or IconButton of the same size. @default 'md' */
  size?: MorphingSwitcherSize;
  /**
   * Swap the shell's ladder shadow for the input field's large, diffuse halo
   * (`shadow-floating`). It replaces the `shadow-elevated-N` rung rather than
   * adding to it, so the shell keeps its `elevation` tint but trades the
   * layered drop for the halo. @default false
   */
  floating?: boolean;
  /**
   * Float level for the shell — picks the `shadow-elevated-N` recipe (drop +
   * dark rim) the resting trigger sits at. Opening lifts it
   * {@link OPEN_ELEVATION_LIFT} rungs higher, so the pane reads as floating over
   * the page it covers. `0` rests flat (no shadow or border) and still lifts on
   * open. @default 3
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
  /** testID for the trigger. */
  triggerTestID?: string;
  /**
   * When true (default), pressing/clicking outside the switcher closes it.
   * Works on every platform: web listens on the document, native gets a
   * full-window transparent backdrop measured from the trigger's position.
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
 * A pill-shaped switcher that morphs into the full item list on press, like
 * `MorphingFAB` morphs from a circle into a pane.
 *
 * - `variant="select"` — collapsed it is a compact pill (current icon + label +
 *   a down-caret). Tapping springs the shell open into a rounded pane; the same
 *   trigger content stays put and becomes the active header row while the other
 *   items fade in below. The trigger never unmounts, so it morphs into the list
 *   instead of disappearing and reappearing.
 * - `variant="switcher"` (default) — collapsed it is a bar with the current
 *   item's icon + label on the left and stacked up/down carets on the right,
 *   hugging its content unless `fullWidth` stretches it across the parent.
 *   Tapping springs the shell open from the trigger itself; the trigger is the
 *   active row of the list and the current item is omitted from the rows below
 *   so it never appears twice.
 *
 * The trigger is disabled while the pane is open — it represents the already-
 * selected item, so pressing it does nothing; the switcher closes by picking
 * another item or (on web) pressing outside it.
 *
 * The closed trigger is measured once (`onLayout`) so the `select` morph starts
 * from the pill's exact footprint; an offscreen, unnamed measurer keeps that
 * footprint in flow while open, so the pane overlays page content without
 * reflowing the header that hosts it.
 *
 * The pane opens downward by default; when that would run it off the bottom of
 * the viewport (and there is more room above), it opens upward instead — the
 * trigger stays put as the list's bottom row and the items fill in above it.
 */

type TriggerCaretsProps = {
  variant: MorphingSwitcherVariant;
  open: boolean;
  closeIcon: ReactNode | null | undefined;
  scale: SwitcherScale;
};

/** The trailing carets — a down/up caret for `select`, stacked up/down for `switcher`. */
function TriggerCarets({ variant, open, closeIcon, scale }: TriggerCaretsProps) {
  if (variant === 'switcher') {
    // Tuck the lower chevron up into the upper one's viewBox dead space so the
    // pair reads as one tight glyph instead of two floating carets.
    const overlap = Math.round(scale.stackedCaretSize * CARET_OVERLAP);
    return (
      <View className="flex-col items-center">
        <ThemedIcon icon={ChevronUp} token="muted-foreground" size={scale.stackedCaretSize} />
        <ThemedIcon icon={ChevronDown} token="muted-foreground" size={scale.stackedCaretSize} style={{ marginTop: -overlap }} />
      </View>
    );
  }
  if (!open) return <ThemedIcon icon={ChevronDown} token="muted-foreground" size={scale.caretSize} />;
  if (closeIcon === null) return null;
  return closeIcon ?? <ThemedIcon icon={ChevronUp} token="muted-foreground" size={scale.caretSize} />;
}

type SwitcherTriggerProps = {
  icon?: MorphingSwitcherIcon;
  label: string;
  variant: MorphingSwitcherVariant;
  /** Stretch the trigger to the shell's width instead of hugging its content. */
  fullWidth: boolean;
  open: boolean;
  closeIcon: ReactNode | null | undefined;
  scale: SwitcherScale;
  /** Present on the interactive copy; absent on the offscreen measurer. */
  onPress?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * The trigger. It stays mounted for the switcher's whole life, so opening only
 * re-styles it (content-hugging pill → stretched active header row) and flips
 * its caret; nothing disappears or reappears. With `onPress` it is the interactive
 * trigger (named, pressable); without it renders an offscreen measurer — an
 * unnamed, `aria-hidden`, non-interactive copy that reserves the collapsed
 * footprint and reports the exact pill size via `onLayout`.
 *
 * The interactive trigger only LOOKS disabled while the pane is open
 * (`opacity-40` — it is the already-selected item, so it reads inert) but stays
 * pressable: re-tapping it folds the pane back, the standard select/dropdown
 * dismissal. The trigger paints no background of its own — no hover, press, or
 * open fill — so the shell's surface shows through whether the switcher is open
 * or closed.
 */
function SwitcherTrigger({
  icon,
  label,
  variant,
  fullWidth,
  open,
  closeIcon,
  scale,
  onPress,
  onLayout,
  accessibilityLabel,
  testID,
}: SwitcherTriggerProps) {
  const leading = (
    <View className={cn('flex-row items-center', scale.gapClassName)}>
      {icon ? <ThemedIcon icon={icon} token="foreground" size={scale.iconSize} /> : null}
      <Text size={scale.labelSize} weight="medium" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  const className = cn(
    scale.rowClassName,
    scale.gapClassName,
    'relative flex-row items-center overflow-hidden',
    open || fullWidth ? 'justify-between self-stretch' : 'self-start',
  );

  const inner = (
    <>
      {leading}
      <TriggerCarets variant={variant} open={open} closeIcon={closeIcon} scale={scale} />
    </>
  );

  if (!onPress)
    return (
      <View aria-hidden={true} onLayout={onLayout} className={cn('pointer-events-none opacity-0', className)}>
        {inner}
      </View>
    );

  return (
    <Pressable
      onPress={onPress}
      // Only the LOOK is disabled while open (`opacity-40`): the trigger is the
      // already-selected item, so it reads inert, but it must stay pressable —
      // re-tapping it is the dismiss.
      accessibilityRole="button"
      aria-expanded={open}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      className={cn(className, open && 'opacity-40')}
    >
      {inner}
    </Pressable>
  );
}

type MorphingSwitcherRowProps = {
  item: MorphingSwitcherItem;
  /** Stable handler — the row binds its own item so no per-render closure. */
  onSelect: (item: MorphingSwitcherItem) => void;
  scale: SwitcherScale;
  testID?: string;
};

/**
 * One row in the open pane: icon + label. The current item never renders here —
 * the trigger is its row. The scale's row classes pin the row to the trigger's
 * geometry, so the two stacks align and the highlight runs the full pane width.
 */
function MorphingSwitcherRow({ item, onSelect, scale, testID }: MorphingSwitcherRowProps) {
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

/**
 * Whether the pane should open above the trigger. `y`/`h` are the trigger's
 * window-space top and height; the pane opens upward when it does not fit below
 * and there is more room above than below.
 */
function opensUpward(paneHeight: number, y: number, h: number, windowHeight: number): boolean {
  const spaceBelow = windowHeight - y - h - VIEWPORT_PADDING;
  const spaceAbove = y - VIEWPORT_PADDING;
  return paneHeight > spaceBelow && spaceAbove > spaceBelow;
}

/**
 * The pane's open height: one row per item stacked on the trigger's height, plus
 * the shell's `p-1` inset on both ends — overridden by `expandedHeight` when the
 * consumer pins an exact height.
 */
function computePaneHeight(scale: SwitcherScale, itemCount: number, expandedHeight: number | undefined): number {
  return expandedHeight ?? scale.height + itemCount * scale.height + PANE_INSET * 2;
}

/** A measured trigger's bounding box. */
type TriggerSize = { width: number; height: number };

/**
 * Merge a freshly-measured trigger size, returning the previous object unchanged
 * when the dimensions match. `useState` then bails out on identity, so a layout
 * pass that reports the same size does not re-render.
 */
function mergeTriggerSize(prev: TriggerSize | null, size: TriggerSize): TriggerSize {
  if (prev && prev.width === size.width && prev.height === size.height) return prev;
  return size;
}

/**
 * The shell's surface class: the resting `shadow-elevated-N` recipe, lifted
 * {@link OPEN_ELEVATION_LIFT} rungs while open (or the floating halo in its
 * place).
 */
function switcherSurfaceClass(elevation: SurfaceElevation, open: boolean, floating: boolean): string {
  return elevatedSurface(elevation, open ? clampSurfaceLevel(elevation + OPEN_ELEVATION_LIFT) : elevation, floating);
}

/**
 * The pane's horizontal constraint: with `fullWidth` it spans its parent (pinned
 * by `right: 0`), otherwise it settles on the open width (or the trigger
 * footprint when the consumer's `expandedWidth` is narrower).
 */
function switcherPaneSizeStyle(fullWidth: boolean, open: boolean, openWidth: number, closedWidth: number): ViewStyle {
  if (fullWidth) return { right: 0 };
  return { width: open ? openWidth : closedWidth };
}

/**
 * The pane's vertical layout. Upward-open reverses the stack so the trigger
 * lands at the bottom and the list fills in above it; the height morphs between
 * the closed trigger footprint and the open pane. The reversed direction
 * persists past the open flip (`openAbove` stays set), so the closing morph
 * keeps the trigger pinned at the bottom too.
 */
function paneLayoutStyle(openAbove: boolean, open: boolean, paneHeight: number, closedHeight: number): ViewStyle {
  return {
    flexDirection: openAbove ? 'column-reverse' : 'column',
    height: open ? paneHeight : closedHeight,
  };
}

/** Everything the shell's geometry depends on, passed as one bag so the helper
 *  stays under the parameter cap. */
type SwitcherShellGeometry = {
  open: boolean;
  openAbove: boolean;
  fullWidth: boolean;
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
function switcherShellGeometry({
  open,
  openAbove,
  fullWidth,
  scale,
  paneHeight,
  closedHeight,
  openWidth,
  closedWidth,
}: SwitcherShellGeometry) {
  const radius = open ? scale.paneRadius : closedHeight / 2;
  // Opening upward anchors the pane's bottom to the trigger's bottom edge: shift
  // the shell up by its growth so it extends above instead of below. `translateY`
  // shares the morph spring, so the bottom edge never drifts while it unfolds.
  const translateY = open && openAbove ? closedHeight - paneHeight : 0;
  const animate = IS_WEB
    ? {
        height: open ? paneHeight : closedHeight,
        borderRadius: radius,
        translateY,
        ...(fullWidth ? {} : { width: open ? openWidth : closedWidth }),
      }
    : { borderRadius: radius, translateY };
  const style: StyleProp<ViewStyle> = IS_WEB
    ? [
        { flexDirection: openAbove ? 'column-reverse' : 'column' },
        open ? { zIndex: 40 } : undefined,
        fullWidth ? { right: 0 } : undefined,
      ]
    : [
        paneLayoutStyle(openAbove, open, paneHeight, closedHeight),
        open ? { zIndex: 40 } : undefined,
        switcherPaneSizeStyle(fullWidth, open, openWidth, closedWidth),
      ];
  return { animate, style };
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the shell wires trigger measurement, outside-press handling, and the morph pane around shared refs/state — splitting would prop-drill the shared values across function boundaries
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the glass/solid shell branch doubles the surface host the morph subtree renders through — flattening it would duplicate the trigger + row subtree
export function MorphingSwitcher({
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  placeholder = 'Select',
  placeholderIcon,
  expandedWidth = 240,
  expandedHeight,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  onShow,
  closeIcon,
  variant = 'switcher',
  fullWidth = false,
  size = 'md',
  floating = false,
  elevation = 3,
  blurRadius = 0,
  opacity = 1,
  rim = false,
  rimWidth,
  intensity,
  style,
  accessibilityLabel,
  testID = 'morphing-switcher',
  triggerTestID = 'morphing-switcher-trigger',
  closeOnOutsidePress = true,
  overlay = 'none',
}: MorphingSwitcherProps) {
  const reduce = useReducedMotion();
  const scale = SWITCHER_SCALE[size];
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const rootRef = useRef<View>(null);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const { expanded, closing, scaleStyle } = useSwitcherMotion(open, reduce);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = valueProp ?? internalValue;
  // On Android the blur must render OUTSIDE the `BlurTarget` it frosts (see
  // `OverlayHost`), so a frosted switcher teleports its backdrop + shell there —
  // the morph still runs, the shell just lives in the overlay host instead of
  // inline. Whenever a host exists, render through it for EVERY `overlay` —
  // `overlay` still decides the scrim, teleporting only relocates the backdrop +
  // shell into the host (the glass blur works regardless of the scrim). Without
  // a provider (`blurTargetRef` null) the switcher stays inline.
  const blurTargetRef = useBlurTargetRef();
  const teleported = Platform.OS === 'android' && blurTargetRef !== null;
  const [triggerSize, setTriggerSize] = useState<{ width: number; height: number } | null>(null);
  /** True while the pane opens upward — the list sits above the trigger instead of below. */
  const [openAbove, setOpenAbove] = useState(false);
  /**
   * The outside-press backdrop's window-covering frame — negative offsets from
   * the root's window position, so an absolutely-positioned child inside the
   * (small, content-sized) root still covers the whole window and catches
   * outside taps on native (web closes via its document listener instead).
   * Null while closed or before the async native measure lands.
   */
  const [backdropFrame, setBackdropFrame] = useState<OutsidePressFrame | null>(null);

  /**
   * The inline root's window frame — its top-left offset and its (content-sized)
   * footprint, so the teleported shell sits exactly where the inline one would
   * and, for `variant="switcher"`, spans the same full width (`right: 0` reads
   * the wrapper's width). Measured on every root layout (mount, rotation, variant/
   * content changes) via the root's `onLayout` below. Null until measured, so the
   * teleported shell holds off one frame — the same warm-up the backdrop already
   * does.
   */
  const [rootFrame, setRootFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  // Guards the async `measureInWindow` round-trip (same race as the FAB's
  // anchor): the mount-time measure can be dispatched before the root's first
  // native layout and its callback can arrive LAST, pinning the teleported
  // shell at a stale spot. Only the newest measure's callback may write.
  const measureSeq = useRef(0);
  const measureRoot = useCallback(() => {
    const seq = ++measureSeq.current;
    if (!teleported) {
      setRootFrame(null);
      return;
    }
    rootRef.current?.measureInWindow((x, y, width, height) => {
      if (seq !== measureSeq.current) return;
      setRootFrame({ x, y, width, height });
    });
  }, [teleported]);

  // `onLayout` alone misses the teleport toggle — flipping `overlay` to "blur"
  // changes the children, not the root's own layout, so no layout event fires and
  // the shell never measures. Run the measure once per teleport change (mount +
  // toggle); `onLayout` below covers rotation, variant, and content changes.
  // biome-ignore lint/plugin: measuring the root is a native measure side effect, not derived state — the teleported overlay must follow the window
  useEffect(() => {
    measureRoot();
  }, [measureRoot]);

  // Post-mount settle re-measure (same rationale as the MorphingFAB anchor):
  // the first measure can miss a window-space drift caused by an ANCESTOR
  // finishing its layout after mount (centering stage, insets, chrome) — the
  // root's frame in its parent is unchanged under that translation, so no
  // `onLayout` re-fires. Measure again once the initial layout has settled so
  // the teleported trigger/pane opens at the right spot on the first open.
  // biome-ignore lint/plugin: deferred re-measure after the native layout settles — a DOM/native measure side effect, not derived render state
  useEffect(() => {
    if (!teleported) return;
    const timer = setTimeout(measureRoot, 150);
    return () => clearTimeout(timer);
  }, [measureRoot, teleported]);

  const current = items.find((item) => item.value === value);

  // The current item lives in the persistent trigger header, so the rows below
  // never repeat it — for both variants.
  const visibleItems = items.filter((item) => item.value !== value);

  const paneHeight = computePaneHeight(scale, visibleItems.length, expandedHeight);

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const handleOpen = useCallback(() => {
    // Measure the trigger's window position to decide whether the pane fits below
    // it. When it would overflow the viewport — and there is more room above —
    // open upward instead, so the list never runs off the bottom of the screen.
    rootRef.current?.measureInWindow((_x, y, _w, h) => {
      setOpenAbove(opensUpward(paneHeight, y, h, windowHeight));
      setOpen(true);
    });
  }, [setOpen, windowHeight, paneHeight]);

  // The trigger toggles: while open it is the already-selected item, so re-tapping
  // it folds the pane back (the standard select dismissal) instead of doing nothing.
  const handleTriggerPress = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    handleOpen();
  }, [open, setOpen, handleOpen]);

  // Measure the root's window position whenever the pane opens (or the window
  // resizes while open — rotation) so the native outside-press backdrop exactly
  // covers the window. `measureInWindow` is async on native; until the frame
  // lands there is simply no backdrop yet.
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

  const handleClose = useCallback(() => setOpen(false), [setOpen]);

  // The switcher renders inline — no `Modal`/`onShow` — so it fires `onShow` once
  // the pane has opened, giving a consumer the same "now it is safe to focus
  // content" moment a modal-backed menu exposes.
  // biome-ignore lint/plugin: fires in response to the open flip — a presentational side effect, not derived render state
  useEffect(() => {
    if (open) onShow?.();
  }, [open, onShow]);

  // Close on an outside press (web). The switcher is inline — no modal backdrop
  // to catch a stray press — so a document-level `pointerdown` listener detects a
  // press landing anywhere but the switcher and folds it shut. `getWebDocument()`
  // returns undefined off-web, where an inline control has no outside press.
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

  const handleSelect = useCallback(
    (item: MorphingSwitcherItem) => {
      if (valueProp === undefined) setInternalValue(item.value);
      onValueChange?.(item.value);
      setOpen(false);
    },
    [valueProp, onValueChange, setOpen],
  );

  const handleTriggerLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setTriggerSize((prev) => mergeTriggerSize(prev, { width, height }));
  }, []);

  // On web `height`/`width` morph through Moti on `MORPH_SPRING`; on Fabric they
  // ride `MORPH_LAYOUT` (a layout transition — layout props don't round-trip Yoga
  // through `useAnimatedStyle`). The radius and upward-open `translateY` spring on
  // `MORPH_SPRING` either way; matching params keep the bottom edge anchored.
  // Closing holds the descent for `CLOSE_LEAD` so the shell swells and sits at its
  // peak before it starts down — the same beat the rows and the content keep.
  const morphTransition = reduce ? TIMING_INSTANT : closeMorphTransition(closing);

  const triggerIcon = current?.icon ?? placeholderIcon;
  const triggerLabel = current?.label ?? placeholder;

  // The shell IS the trigger's footprint while closed — no inset — so the resting
  // pill stands at exactly the shared interactive height and a switcher lines up
  // with a Button or IconButton of the same size. The `p-1` inset frames the OPEN
  // pane only (see {@link shellInsetClass} below), so it can never inflate the
  // collapsed box: a switcher used to rest 2 × {@link PANE_INSET} taller than the
  // icon button beside it.
  const closedWidth = triggerSize?.width ?? 0;
  const closedHeight = triggerSize?.height ?? scale.height;
  // The open pane frames the trigger with that same inset on both sides, so the
  // pane has to be at least the trigger's footprint PLUS the inset — otherwise a
  // trigger wider than `expandedWidth` would be clipped horizontally on open.
  const paneContentWidth = closedWidth + PANE_INSET * 2;
  // `fullWidth` spans its parent, so its width is not animated — the shell's
  // `right: 0` pins it full-width and only height/radius morph. Otherwise the
  // pane settles on `expandedWidth` (never narrower than the trigger).
  const openWidth = Math.max(expandedWidth, paneContentWidth);

  // The geometry follows `open`, never the retained `expanded`: the pane has to
  // start collapsing on the same frame the close begins, so the outgoing rows
  // fade against an edge that is already moving instead of dissolving first and
  // leaving the pane to collapse a beat later — the two reading as one motion.
  const shell = switcherShellGeometry({
    open,
    openAbove,
    fullWidth,
    scale,
    paneHeight,
    closedHeight,
    openWidth,
    closedWidth,
  });

  // The teleported wrapper sits at the inline root's window offset; the shell
  // inside keeps its own `absolute top-0 left-0` geometry (and `right: 0` full-
  // width stretch for `switcher`) so it reads the wrapper's measured width.
  const rootWindow = rootFrame ? { x: rootFrame.x, y: rootFrame.y } : null;
  const wrapperWidth = rootFrame?.width ?? 0;
  const wrapperHeight = rootFrame?.height ?? 0;

  // Outside-press backdrop (native): covers the whole window so a tap anywhere
  // outside the pane folds it back — the web path is the document listener
  // above. When `overlay` is on it also dims the page. Teleported it passes
  // `blurInline={false}` so the frost actually renders OUT of the BlurTarget.
  // Keyed + wrapped in `AnimatePresence` at the call sites below so closing the
  // switcher runs the backdrop's exit fade (dim + blur out over 200 ms) instead
  // of popping the scrim off in the same frame the pane starts folding — the
  // progressive unblur the pane's enter already has.
  const backdrop =
    open && (overlay !== 'none' || closeOnOutsidePress) && backdropFrame !== null ? (
      <OutsidePressBackdrop
        key="morphing-switcher-backdrop"
        frame={backdropFrame}
        onPress={closeOnOutsidePress ? handleClose : undefined}
        overlay={overlay}
        blurInline={!teleported}
        testID={`${testID}-backdrop`}
      />
    ) : null;

  const glass = blurRadius > 0;

  const shellContent = (
    <>
      {/* The trigger persists — it morphs into the active header row. Re-tapping
          it while open folds the pane back (it only LOOKS disabled). */}
      <SwitcherTrigger
        icon={triggerIcon}
        label={triggerLabel}
        variant={variant}
        fullWidth={fullWidth}
        open={expanded}
        closeIcon={closeIcon}
        scale={scale}
        onPress={handleTriggerPress}
        accessibilityLabel={accessibilityLabel}
        testID={triggerTestID}
      />

      {expanded ? (
        <View pointerEvents={closing ? 'none' : 'auto'}>
          {visibleItems.map((item, index) => (
            <SwitcherMotionRow
              key={item.value}
              index={index}
              count={visibleItems.length}
              closing={closing}
              openAbove={openAbove}
              reduce={reduce}
              testID={`${testID}-row-${item.value}`}
            >
              <MorphingSwitcherRow item={item} onSelect={handleSelect} scale={scale} testID={`${testID}-item-${item.value}`} />
            </SwitcherMotionRow>
          ))}
        </View>
      ) : null}
    </>
  );

  // Keyed by variant and width mode: Moti holds the last value of every key it
  // has animated, so a content-fit pane that later re-renders as `fullWidth`
  // would keep its measured width instead of spanning the parent (and a
  // `select` pane re-rendered as `switcher` would keep its 240px). Remounting
  // drops it. The same key is shared by both hosts (solid `MotiView` and frosted
  // `Surface`), so toggling glass remounts the shell and drops the stale values.
  const shellKey = `${variant}-${fullWidth ? 'full' : 'fit'}`;
  // The pane's `p-1` inset — the frame that keeps the trigger and the hover pills
  // off the pane's rim — applies while OPEN only. Collapsed it would push the
  // shell {@link PANE_INSET} past the trigger on every side, so the resting pill
  // would stand taller than the same-size IconButton it sits beside. The trigger
  // is centred in its row, so the one-frame inset at the start of the open morph
  // never clips its icon or label.
  const shellInsetClass = open ? 'p-1' : 'p-0';
  const shellView = glass ? (
    <Surface
      key={shellKey}
      testID={`${testID}-shell`}
      as={MotiView}
      animate={shell.animate}
      transition={morphTransition}
      layout={switcherMorphLayout(closing, reduce)}
      elevation={open ? clampSurfaceLevel(elevation + OPEN_ELEVATION_LIFT) : elevation}
      floating={floating}
      blurRadius={blurRadius}
      opacity={opacity}
      rim={rim}
      rimWidth={rimWidth}
      intensity={intensity}
      borderRadius={open ? scale.paneRadius : closedHeight / 2}
      className={cn('absolute top-0 left-0 overflow-hidden', shellInsetClass)}
      style={shell.style}
    >
      {shellContent}
    </Surface>
  ) : (
    <MotiView
      key={shellKey}
      testID={`${testID}-shell`}
      animate={shell.animate}
      transition={morphTransition}
      layout={switcherMorphLayout(closing, reduce)}
      className={cn('absolute top-0 left-0 overflow-hidden', shellInsetClass, switcherSurfaceClass(elevation, open, floating))}
      style={shell.style}
    >
      {shellContent}
    </MotiView>
  );

  return (
    <View ref={rootRef} collapsable={false} testID={testID} onLayout={measureRoot} style={[{ zIndex: expanded ? 40 : 0 }, style]}>
      {/* Offscreen measurer holds the collapsed footprint in flow. */}
      <SwitcherTrigger
        icon={triggerIcon}
        label={triggerLabel}
        variant={variant}
        fullWidth={fullWidth}
        open={false}
        closeIcon={closeIcon}
        scale={scale}
        onLayout={handleTriggerLayout}
      />

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
    </View>
  );
}
