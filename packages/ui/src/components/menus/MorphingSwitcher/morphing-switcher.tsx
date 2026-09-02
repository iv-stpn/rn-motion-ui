// biome-ignore-all lint/style/noExcessiveLinesPerFile: switcher shell, morph transition, and trigger/pane layouts collocated by design
// biome-ignore-all lint/style/useExportsLast: the public icon/item/variant/props types head the module so the sub-components below read against them
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { DownLine as ChevronDown } from 'rn-motion-ui-icons/icons/down-line';
import { UpLine as ChevronUp } from 'rn-motion-ui-icons/icons/up-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { EASE_OUT, SPRING_LAYOUT, springLayout } from '../../../lib/ease';
import { clampSurfaceLevel, elevated as elevatedSurface, type SurfaceElevation } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { TIMING_INSTANT } from '../../../theme/motion';
import { ThemedIcon } from '../../icon/themed-icon';
import { MenuItem, type MenuItemSize } from '../../rows/menu-item';
import { Text } from '../../typography/Text/text';
import { useBlurTargetRef } from '../Overlay/blur-context';
import { OutsidePressBackdrop, type OutsidePressFrame } from '../Overlay/outside-press-backdrop';
import type { OverlayType } from '../Overlay/overlay-type';
import { TeleportedOverlay } from '../Overlay/teleported-overlay';
import { getWebDocument, isWebNode, type WebPointerEvent } from '../Overlay/web-document';

/** Minimum clearance kept between the open pane and the viewport edge when deciding whether to flip up. */
const VIEWPORT_PADDING = 8;
/** `p-1` inset between the shell edge and its content, so the trigger and hover pills never run flush to the pane rim. */
const PANE_INSET = 4;
/** Rungs the shell floats above its resting `elevation` while open. */
const OPEN_ELEVATION_LIFT = 2;
/** Collapsed-trigger ↔ open-pane size morph, on `SPRING_LAYOUT` so the size
 *  stays in lockstep with the `translateY` upward-open shift below. Native
 *  (Fabric) drives the size through this layout transition; web animates it
 *  through Moti instead — see `switcherShellGeometry` below. */
const IS_WEB = Platform.OS === 'web';
const MORPH_LAYOUT = springLayout(SPRING_LAYOUT);

/** Switcher size — the trigger and every row stand at the matching interactive height. */
export type MorphingSwitcherSize = 'sm' | 'md' | 'lg';

/**
 * Everything one size decides. The trigger and the item rows read from the same
 * entry, which is what makes the trigger the active row of the list rather than
 * a differently-sized header: one height, one inset, one gap, one icon, one type
 * size.
 */
type SwitcherScale = {
  /** Trigger and row height in px — the pixel twin of `rowClassName`'s height, for the pane arithmetic. */
  height: number;
  /**
   * The row box. Height comes from the shared `--spacing-interactive-*` ramp, so
   * a switcher lines up with a Button or IconButton of the same size. The
   * horizontal padding is a row's, not a button's (`--spacing-interactive-pad-*`
   * is tuned for a label hugged by a pill, far too wide for a full-width bar).
   * `py-0` drops {@link MenuItem}'s own vertical padding — the fixed height owns it.
   */
  rowClassName: string;
  /** Gap between icon and label, and between the label block and the carets. */
  gapClassName: string;
  /** The size the item rows render their {@link MenuItem} at. */
  menuItemSize: MenuItemSize;
  /** That MenuItem size's leading-icon size — the trigger matches it so the two stacks align. */
  iconSize: number;
  /** {@link Text} size matching the MenuItem label's, for the same reason. */
  labelSize: 'xs' | 'sm';
  /** The single caret of the `select` trigger. */
  caretSize: number;
  /** Each caret of the `switcher` trigger's stacked pair. */
  stackedCaretSize: number;
  /** Corner radius of the open pane — a touch tighter than the collapsed pill's half-height. */
  paneRadius: number;
};

/**
 * `lg` deliberately shares `md`'s icon and label rather than stepping up, the
 * same divergence the button family's `LABEL_TEXT_CLASS` makes: past the `md`
 * box the extra height and padding already carry the size difference, and
 * MenuItem's `lg` ramp (26px icon, 18px label) belongs to a settings list, not
 * to a switcher bar.
 */
const SWITCHER_SCALE: Record<MorphingSwitcherSize, SwitcherScale> = {
  sm: {
    height: 24,
    rowClassName: 'h-interactive-sm px-2 py-0',
    gapClassName: 'gap-1.5',
    menuItemSize: 'sm',
    iconSize: 16,
    labelSize: 'xs',
    caretSize: 12,
    stackedCaretSize: 11,
    paneRadius: 14,
  },
  md: {
    height: 32,
    rowClassName: 'h-interactive-md px-2.5 py-0',
    gapClassName: 'gap-2',
    menuItemSize: 'md',
    iconSize: 21,
    labelSize: 'sm',
    caretSize: 14,
    stackedCaretSize: 13,
    paneRadius: 16,
  },
  lg: {
    height: 40,
    rowClassName: 'h-interactive-lg px-3 py-0',
    gapClassName: 'gap-2',
    menuItemSize: 'md',
    iconSize: 21,
    labelSize: 'sm',
    caretSize: 16,
    stackedCaretSize: 15,
    paneRadius: 20,
  },
};

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
 * - `'switcher'` — a full-width bar (`justify-between`) with stacked up/down
 *   carets on the right; on open the trigger becomes the active row of the list.
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
  /** Expanded pane width in px. Defaults to 240. Ignored by `variant="switcher"`, which spans its parent. */
  expandedWidth?: number;
  /** Expanded pane height in px. Defaults to a fit for the item list. */
  expandedHeight?: number;
  /** Controlled open state. */
  open?: boolean;
  /** Uncontrolled initial open state. */
  defaultOpen?: boolean;
  /** Called whenever the switcher opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Trailing icon rendered on the open trigger (`select` only). Defaults to an
   *  up-caret (the trigger's down-caret flipped). Pass `null` to omit it. The
   *  open trigger is disabled, so this is a visual hint rather than a control. */
  closeIcon?: ReactNode | null;
  /** Collapsed-trigger layout. Defaults to `"switcher"`. */
  variant?: MorphingSwitcherVariant;
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
 * - `variant="switcher"` (default) — collapsed it is a full-width bar with the
 *   current item's icon + label on the left and stacked up/down carets on the
 *   right. Tapping springs the shell open from the trigger itself; the trigger
 *   is the active row of the list and the current item is omitted from the rows
 *   below so it never appears twice.
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
  if (variant === 'switcher')
    return (
      <View className="flex-col items-center">
        <ThemedIcon icon={ChevronUp} token="muted-foreground" size={scale.stackedCaretSize} />
        <ThemedIcon icon={ChevronDown} token="muted-foreground" size={scale.stackedCaretSize} />
      </View>
    );
  if (!open) return <ThemedIcon icon={ChevronDown} token="muted-foreground" size={scale.caretSize} />;
  if (closeIcon === null) return null;
  return closeIcon ?? <ThemedIcon icon={ChevronUp} token="muted-foreground" size={scale.caretSize} />;
}

type SwitcherTriggerProps = {
  icon?: MorphingSwitcherIcon;
  label: string;
  variant: MorphingSwitcherVariant;
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
 * re-styles it (compact pill → full-width active header row) and flips its
 * caret; nothing disappears or reappears. With `onPress` it is the interactive
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
    open || variant === 'switcher' ? 'justify-between self-stretch' : 'self-start',
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
 * The pane's horizontal constraint: `switcher` spans its parent (pinned by
 * `right: 0`), `select` settles on the open width (or the trigger footprint when
 * the consumer's `expandedWidth` is narrower).
 */
function switcherPaneSizeStyle(
  variant: MorphingSwitcherVariant,
  open: boolean,
  openWidth: number,
  closedWidth: number,
): ViewStyle {
  if (variant === 'switcher') return { right: 0 };
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
  variant: MorphingSwitcherVariant;
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
 * and upward-open `translateY` spring on `SPRING_LAYOUT` either way.
 */
function switcherShellGeometry({
  open,
  openAbove,
  variant,
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
        ...(variant === 'select' ? { width: open ? openWidth : closedWidth } : {}),
      }
    : { borderRadius: radius, translateY };
  const style: StyleProp<ViewStyle> = IS_WEB
    ? [
        { flexDirection: openAbove ? 'column-reverse' : 'column' },
        open ? { zIndex: 40 } : undefined,
        variant === 'switcher' ? { right: 0 } : undefined,
      ]
    : [
        paneLayoutStyle(openAbove, open, paneHeight, closedHeight),
        open ? { zIndex: 40 } : undefined,
        switcherPaneSizeStyle(variant, open, openWidth, closedWidth),
      ];
  return { animate, style };
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the shell wires trigger measurement, outside-press handling, and the morph pane around shared refs/state — splitting would prop-drill the shared values across function boundaries
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
  closeIcon,
  variant = 'switcher',
  size = 'md',
  floating = false,
  elevation = 3,
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
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = valueProp ?? internalValue;
  // On Android the blur must render OUTSIDE the `BlurTarget` it frosts (see
  // `OverlayHost`), so a `"blur"` switcher teleports its backdrop + shell there —
  // the morph still runs, the shell just lives in the overlay host instead of inline.
  const blurTargetRef = useBlurTargetRef();
  const teleported = Platform.OS === 'android' && overlay === 'blur' && blurTargetRef !== null;
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
  const measureRoot = useCallback(() => {
    if (!teleported) {
      setRootFrame(null);
      return;
    }
    rootRef.current?.measureInWindow((x, y, width, height) => setRootFrame({ x, y, width, height }));
  }, [teleported]);

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

  // On web `height`/`width` morph through Moti on `SPRING_LAYOUT`; on Fabric they
  // ride `MORPH_LAYOUT` (a layout transition — layout props don't round-trip Yoga
  // through `useAnimatedStyle`). The radius and upward-open `translateY` spring on
  // `SPRING_LAYOUT` either way; matching params keep the bottom edge anchored.
  const morphTransition = reduce ? TIMING_INSTANT : SPRING_LAYOUT;

  // The rows follow the shell closely — a long delay left the pane looking empty
  // while it unfolded, which is the other half of the gooey read.
  const paneEnterTransition = reduce ? TIMING_INSTANT : { type: 'timing' as const, duration: 180, delay: 40, easing: EASE_OUT };

  const triggerIcon = current?.icon ?? placeholderIcon;
  const triggerLabel = current?.label ?? placeholder;

  // The shell is the trigger's footprint plus a `p-1` inset on every side, so the
  // collapsed pill and the open pane both frame their content instead of running
  // flush to the edge.
  const closedWidth = (triggerSize?.width ?? 0) + PANE_INSET * 2;
  const closedHeight = (triggerSize?.height ?? scale.height) + PANE_INSET * 2;
  // `switcher` spans its parent, so its width is not animated — the shell's
  // `right: 0` pins it full-width and only height/radius morph.
  const openWidth = Math.max(expandedWidth, closedWidth);

  const shell = switcherShellGeometry({ open, openAbove, variant, scale, paneHeight, closedHeight, openWidth, closedWidth });

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
  const backdrop =
    open && (overlay !== 'none' || closeOnOutsidePress) && backdropFrame !== null ? (
      <OutsidePressBackdrop
        frame={backdropFrame}
        onPress={closeOnOutsidePress ? handleClose : undefined}
        overlay={overlay}
        blurInline={!teleported}
        testID={`${testID}-backdrop`}
      />
    ) : null;

  // Keyed by variant: Moti holds the last value of every key it has animated,
  // so a `select` pane that later re-renders as `switcher` would keep its
  // 240px width instead of spanning the parent. Remounting drops it.
  const shellView = (
    <MotiView
      key={variant}
      animate={shell.animate}
      transition={morphTransition}
      layout={reduce || IS_WEB ? undefined : MORPH_LAYOUT}
      className={cn('absolute top-0 left-0 overflow-hidden p-1', switcherSurfaceClass(elevation, open, floating))}
      style={shell.style}
    >
      {/* The trigger persists — it morphs into the active header row. Re-tapping
          it while open folds the pane back (it only LOOKS disabled). */}
      <SwitcherTrigger
        icon={triggerIcon}
        label={triggerLabel}
        variant={variant}
        open={open}
        closeIcon={closeIcon}
        scale={scale}
        onPress={handleTriggerPress}
        accessibilityLabel={accessibilityLabel}
        testID={triggerTestID}
      />

      {open ? (
        <MotiView
          from={reduce ? { opacity: 1 } : { opacity: 0, translateY: 4 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={paneEnterTransition}
        >
          {visibleItems.map((item) => (
            <MorphingSwitcherRow
              key={item.value}
              item={item}
              onSelect={handleSelect}
              scale={scale}
              testID={`${testID}-item-${item.value}`}
            />
          ))}
        </MotiView>
      ) : null}
    </MotiView>
  );

  return (
    <View ref={rootRef} collapsable={false} testID={testID} onLayout={measureRoot} style={[{ zIndex: open ? 40 : 0 }, style]}>
      {/* Offscreen measurer holds the collapsed footprint in flow. */}
      <SwitcherTrigger
        icon={triggerIcon}
        label={triggerLabel}
        variant={variant}
        open={false}
        closeIcon={closeIcon}
        scale={scale}
        onLayout={handleTriggerLayout}
      />

      {teleported ? (
        <TeleportedOverlay teleported={teleported} rootWindow={rootWindow} width={wrapperWidth} height={wrapperHeight}>
          {backdrop}
          {shellView}
        </TeleportedOverlay>
      ) : (
        <>
          {backdrop}
          {shellView}
        </>
      )}
    </View>
  );
}
