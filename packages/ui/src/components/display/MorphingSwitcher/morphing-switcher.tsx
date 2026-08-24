// biome-ignore-all lint/style/noExcessiveLinesPerFile: switcher shell, morph transition, and trigger/pane layouts collocated by design
// biome-ignore-all lint/style/useExportsLast: the public icon/item/variant/props types head the module so the sub-components below read against them
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Platform,
  Pressable,
  type StyleProp,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { DownLine as ChevronDown } from 'rn-motion-ui-icons/icons/down-line';
import { UpLine as ChevronUp } from 'rn-motion-ui-icons/icons/up-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { EASE_OUT, SPRING_LAYOUT } from '../../../lib/ease';
import { clampSurfaceLevel, elevated, type SurfaceElevation } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { ThemedIcon } from '../../icon/themed-icon';
import { MenuItem } from '../../rows/menu-item';
import { Text } from '../../typography/Text/text';

const TRIGGER_HEIGHT = 36;
const PANE_RADIUS = 20;
/** Rows are the trigger's twin, so one height serves both. */
const ROW_HEIGHT = TRIGGER_HEIGHT;
/** Minimum clearance kept between the open pane and the viewport edge when deciding whether to flip up. */
const VIEWPORT_PADDING = 8;
/** `p-1` inset between the shell edge and its content, so the trigger and hover pills never run flush to the pane rim. */
const PANE_INSET = 4;

/**
 * The row geometry the trigger and every item row share, so the trigger reads as
 * the active row of the list rather than a differently-sized header: one height,
 * one inset, one gap. `py-0` drops {@link MenuItem}'s own vertical padding — the
 * fixed height owns it here.
 */
const ROW_CLASSNAME = 'h-9 gap-2 px-3 py-0';
/** {@link MenuItem}'s `md` leading-icon size — the trigger matches it. */
const ROW_ICON_SIZE = 21;
/** The single caret of the `select` trigger. */
const CARET_SIZE = 14;
/** Each caret of the `switcher` trigger's stacked pair. */
const STACKED_CARET_SIZE = 12;
/**
 * Overlap for the lower stacked caret. The chevron glyph fills only ~5.7 of its
 * 24-unit box, so two boxes set flush leave ~9px of air between the strokes —
 * far too much to read as one control. Pulling the second up by most of that
 * gap lands the pair ~2px apart.
 */
const STACKED_CARET_STYLE = { marginTop: -7 };
/** Rungs the shell floats above its resting `elevation` while open. */
const OPEN_ELEVATION_LIFT = 2;

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

type TriggerCaretsProps = { variant: MorphingSwitcherVariant; open: boolean; closeIcon: ReactNode | null | undefined };

/** The trailing carets — a down/up caret for `select`, stacked up/down for `switcher`. */
function TriggerCarets({ variant, open, closeIcon }: TriggerCaretsProps) {
  if (variant === 'switcher')
    return (
      <View className="flex-col items-center">
        <ThemedIcon icon={ChevronUp} token="muted-foreground" size={STACKED_CARET_SIZE} />
        <ThemedIcon icon={ChevronDown} token="muted-foreground" size={STACKED_CARET_SIZE} style={STACKED_CARET_STYLE} />
      </View>
    );
  if (!open) return <ThemedIcon icon={ChevronDown} token="muted-foreground" size={CARET_SIZE} />;
  if (closeIcon === null) return null;
  return closeIcon ?? <ThemedIcon icon={ChevronUp} token="muted-foreground" size={CARET_SIZE} />;
}

type SwitcherTriggerProps = {
  icon?: MorphingSwitcherIcon;
  label: string;
  variant: MorphingSwitcherVariant;
  open: boolean;
  closeIcon: ReactNode | null | undefined;
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
  onPress,
  onLayout,
  accessibilityLabel,
  testID,
}: SwitcherTriggerProps) {
  const leading = (
    <View className="flex-row items-center gap-2">
      {icon ? <ThemedIcon icon={icon} token="foreground" size={ROW_ICON_SIZE} /> : null}
      <Text size="sm" weight="medium" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  const className = cn(
    ROW_CLASSNAME,
    'relative flex-row items-center overflow-hidden',
    open || variant === 'switcher' ? 'justify-between self-stretch' : 'self-start',
  );

  const inner = (
    <>
      {leading}
      <TriggerCarets variant={variant} open={open} closeIcon={closeIcon} />
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
  testID?: string;
};

type OutsidePressBackdropProps = {
  /** The backdrop's window-covering frame — negative offsets from the root's measured window position. */
  frame: { top: number; left: number; width: number; height: number };
  onPress: () => void;
  testID?: string;
};

/**
 * Full-window transparent layer that folds the switcher on an outside tap
 * (native). Rendered inside the small root but measured to cover the whole
 * window, so a tap anywhere outside the pane — the page, the header, another
 * control — lands here and dismisses. Sits below the shell (zIndex 40), above
 * the page.
 */
function OutsidePressBackdrop({ frame, onPress, testID }: OutsidePressBackdropProps) {
  const handlePress = useCallback(() => onPress(), [onPress]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      testID={testID}
      onPress={handlePress}
      style={{ position: 'absolute', top: frame.top, left: frame.left, width: frame.width, height: frame.height }}
    />
  );
}

/**
 * One row in the open pane: icon + label. The current item never renders here —
 * the trigger is its row. {@link ROW_CLASSNAME} pins the row to the trigger's
 * geometry, so the two stacks align and the highlight runs the full pane width.
 */
function MorphingSwitcherRow({ item, onSelect, testID }: MorphingSwitcherRowProps) {
  const handlePress = useCallback(() => onSelect(item), [onSelect, item]);
  return (
    <MenuItem
      icon={item.icon}
      label={item.label}
      labelWeight="medium"
      onPress={handlePress}
      className={cn(ROW_CLASSNAME, 'rounded-full')}
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

// Minimal web-only DOM types — the RN package tsconfig omits the DOM lib, so the
// browser `document`/pointer globals aren't declared here. Mirrors HoverMenu's
// `WebNode`/`getWebDocument` (Reflect.get + a typeof guard, no cast).
type WebNode = { contains: (node: unknown) => boolean };
type WebPointerEvent = { target: unknown };
type WebDocument = {
  addEventListener: (type: 'pointerdown', listener: (event: WebPointerEvent) => void) => void;
  removeEventListener: (type: 'pointerdown', listener: (event: WebPointerEvent) => void) => void;
};

function isWebNode(node: unknown): node is WebNode {
  return node !== null && typeof node === 'object' && typeof Reflect.get(node, 'contains') === 'function';
}

function isWebDocument(value: unknown): value is WebDocument {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof Reflect.get(value, 'addEventListener') === 'function' &&
    typeof Reflect.get(value, 'removeEventListener') === 'function'
  );
}

function getWebDocument(): WebDocument | undefined {
  if (Platform.OS !== 'web') return;
  const doc = Reflect.get(globalThis, 'document');
  return isWebDocument(doc) ? doc : undefined;
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
  elevation = 3,
  style,
  accessibilityLabel,
  testID = 'morphing-switcher',
  triggerTestID = 'morphing-switcher-trigger',
  closeOnOutsidePress = true,
}: MorphingSwitcherProps) {
  const reduce = useReducedMotion();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const rootRef = useRef<View>(null);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = valueProp ?? internalValue;
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
  const [backdropFrame, setBackdropFrame] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const current = items.find((item) => item.value === value);

  // The current item lives in the persistent trigger header, so the rows below
  // never repeat it — for both variants.
  const visibleItems = items.filter((item) => item.value !== value);

  const paneHeight = expandedHeight ?? TRIGGER_HEIGHT + visibleItems.length * ROW_HEIGHT + PANE_INSET * 2;

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
    if (!(open && closeOnOutsidePress)) {
      setBackdropFrame(null);
      return;
    }
    rootRef.current?.measureInWindow((x, y) => {
      setBackdropFrame({ top: -y, left: -x, width: windowWidth, height: windowHeight });
    });
  }, [open, closeOnOutsidePress, windowWidth, windowHeight]);

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
    setTriggerSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  // One spring for every morphing property. Height, width and radius arriving on
  // separate, underdamped springs is what made the morph read as gooey — the box
  // stretched, overshot, and settled in pieces. `SPRING_LAYOUT` is the library's
  // shared-layout glide: just past critical damping, so it lands without bounce.
  const morphTransition = reduce ? { type: 'timing' as const, duration: 0 } : SPRING_LAYOUT;

  // The rows follow the shell closely — a long delay left the pane looking empty
  // while it unfolded, which is the other half of the gooey read.
  const paneEnterTransition = reduce
    ? { type: 'timing' as const, duration: 0 }
    : { type: 'timing' as const, duration: 180, delay: 40, easing: EASE_OUT };

  const triggerIcon = current?.icon ?? placeholderIcon;
  const triggerLabel = current?.label ?? placeholder;

  // The shell is the trigger's footprint plus a `p-1` inset on every side, so the
  // collapsed pill and the open pane both frame their content instead of running
  // flush to the edge.
  const closedWidth = (triggerSize?.width ?? 0) + PANE_INSET * 2;
  const closedHeight = (triggerSize?.height ?? TRIGGER_HEIGHT) + PANE_INSET * 2;
  // `switcher` spans its parent, so its width is not animated — the shell's
  // `right: 0` pins it full-width and only height/radius morph.
  const openWidth = Math.max(expandedWidth, closedWidth);

  return (
    <View ref={rootRef} collapsable={false} testID={testID} style={[{ zIndex: open ? 40 : 0 }, style]}>
      {/* Offscreen measurer holds the collapsed footprint in flow. */}
      <SwitcherTrigger
        icon={triggerIcon}
        label={triggerLabel}
        variant={variant}
        open={false}
        closeIcon={closeIcon}
        onLayout={handleTriggerLayout}
      />

      {/* Outside-press backdrop (native): covers the whole window so a tap
          anywhere outside the pane folds it back — the web path is the
          document listener above. */}
      {open && closeOnOutsidePress && backdropFrame !== null ? (
        <OutsidePressBackdrop frame={backdropFrame} onPress={handleClose} testID={`${testID}-backdrop`} />
      ) : null}

      {/* Keyed by variant: Moti holds the last value of every key it has animated,
          so a `select` pane that later re-renders as `switcher` would keep its
          240px width instead of spanning the parent. Remounting drops it. */}
      <MotiView
        key={variant}
        animate={{
          height: open ? paneHeight : closedHeight,
          borderRadius: open ? PANE_RADIUS : closedHeight / 2,
          // Opening upward anchors the pane's bottom to the trigger's bottom edge:
          // shift the shell up by its growth so it extends above instead of below.
          // `translateY` shares the morph spring, so the two stay in lockstep and
          // the bottom edge never drifts while the pane unfolds.
          translateY: open && openAbove ? closedHeight - paneHeight : 0,
          ...(variant === 'select' ? { width: open ? openWidth : closedWidth } : {}),
        }}
        transition={morphTransition}
        className={cn(
          'absolute top-0 left-0 overflow-hidden p-1',
          elevated(elevation, open ? clampSurfaceLevel(elevation + OPEN_ELEVATION_LIFT) : elevation),
        )}
        style={[
          // Flip the stack when opening up so the trigger lands at the bottom (its
          // closed position) and the list fills in above it. Persists past the open
          // flip so the closing morph keeps the trigger pinned at the bottom too.
          { flexDirection: openAbove ? 'column-reverse' : 'column' },
          open ? { zIndex: 40 } : undefined,
          variant === 'switcher' ? { right: 0 } : undefined,
        ]}
      >
        {/* The trigger persists — it morphs into the active header row. Re-tapping
            it while open folds the pane back (it only LOOKS disabled). */}
        <SwitcherTrigger
          icon={triggerIcon}
          label={triggerLabel}
          variant={variant}
          open={open}
          closeIcon={closeIcon}
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
              <MorphingSwitcherRow key={item.value} item={item} onSelect={handleSelect} testID={`${testID}-item-${item.value}`} />
            ))}
          </MotiView>
        ) : null}
      </MotiView>
    </View>
  );
}
