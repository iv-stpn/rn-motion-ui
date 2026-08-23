// biome-ignore-all lint/style/noExcessiveLinesPerFile: switcher shell, morph transition, and trigger/pane layouts collocated by design
import { type ReactNode, useCallback, useState } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { DownLine as ChevronDown } from 'rn-motion-ui-icons/icons/down-line';
import { UpLine as ChevronUp } from 'rn-motion-ui-icons/icons/up-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { EASE_OUT } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { ThemedIcon } from '../../icon/themed-icon';
import { MenuItem } from '../../rows/menu-item';
import { Text } from '../../typography/Text/text';

const TRIGGER_HEIGHT = 36;
const PANE_RADIUS = 20;
const ROW_HEIGHT = 40;
const PANE_PADDING = 8;
const CLOSE_ROW_HEIGHT = 36;

/** Icon renderer — compatible with this project's icon set signature. */
export type MorphingSwitcherIcon = (props: IconProps) => ReactNode;

/** One selectable entry in the switcher's item list. */
export type MorphingSwitcherItem = {
  value: string;
  label: string;
  /** Leading icon rendered in the trigger and in the item row. */
  icon?: MorphingSwitcherIcon;
};

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
  /** Expanded pane width in px. Defaults to 240. */
  expandedWidth?: number;
  /** Expanded pane height in px. Defaults to a fit for the item list. */
  expandedHeight?: number;
  /** Controlled open state. */
  open?: boolean;
  /** Uncontrolled initial open state. */
  defaultOpen?: boolean;
  /** Called whenever the switcher opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Close affordance rendered in a top-right header row while open.
   *  Defaults to an up-caret (the trigger's down-caret flipped). Pass `null`
   *  to omit it when the pane content owns its own close control. */
  closeIcon?: ReactNode | null;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  /** testID for the collapsed trigger button. */
  triggerTestID?: string;
};

/**
 * A pill-shaped switcher that morphs into the full item list on press, like
 * `MorphingFAB` morphs from a circle into a pane. Collapsed it is a compact
 * pill — the current item's icon + label + a down-caret on the right. Tapping
 * it springs the shell open into a rounded pane of `expandedWidth` ×
 * `expandedHeight` listing every item (the active one highlighted); selecting
 * one reports it through `onValueChange` and folds the switcher back. The
 * caret flips up while open and doubles as the close control.
 *
 * The closed trigger is measured once (`onLayout`) so the morph starts from
 * the pill's exact footprint; the wrapper keeps that footprint while open, so
 * the pane overlays page content without reflowing the header that hosts it.
 */
type MorphingSwitcherRowProps = {
  item: MorphingSwitcherItem;
  active: boolean;
  /** Stable handler — the row binds its own item so no per-render closure. */
  onSelect: (item: MorphingSwitcherItem) => void;
  testID?: string;
};

/** One row in the open pane: icon + label with the active highlight. */
function MorphingSwitcherRow({ item, active, onSelect, testID }: MorphingSwitcherRowProps) {
  const handlePress = useCallback(() => onSelect(item), [onSelect, item]);
  return <MenuItem icon={item.icon} label={item.label} active={active} onPress={handlePress} testID={testID} />;
}

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
  style,
  accessibilityLabel,
  testID = 'morphing-switcher',
  triggerTestID = 'morphing-switcher-trigger',
}: MorphingSwitcherProps) {
  const reduce = useReducedMotion();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = valueProp ?? internalValue;
  const [triggerSize, setTriggerSize] = useState<{ width: number; height: number } | null>(null);

  const current = items.find((item) => item.value === value);

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const handleOpen = useCallback(() => setOpen(true), [setOpen]);
  const handleClose = useCallback(() => setOpen(false), [setOpen]);

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

  // Staggered springs: width snaps open fast, height bounces — reads as unfolding.
  const morphTransition = reduce
    ? { type: 'timing' as const, duration: 0 }
    : ({
        type: 'spring' as const,
        stiffness: 200,
        damping: 18,
        mass: 0.95,
        width: { type: 'spring' as const, stiffness: 350, damping: 30, mass: 0.55 },
        borderRadius: { type: 'spring' as const, stiffness: 350, damping: 30, mass: 0.55 },
      } satisfies import('../../../moti/core/types').MotiTransition);

  const paneEnterTransition = reduce
    ? { type: 'timing' as const, duration: 0 }
    : { type: 'timing' as const, duration: 200, delay: 150, easing: EASE_OUT };

  const triggerIcon = current?.icon ?? placeholderIcon;
  const triggerLabel = current?.label ?? placeholder;
  const paneHeight = expandedHeight ?? items.length * ROW_HEIGHT + PANE_PADDING + (closeIcon === null ? 0 : CLOSE_ROW_HEIGHT);

  // The trigger pill — always in flow so it (a) sizes the wrapper and (b) can be
  // measured for the morph's closed state. When open it is hidden beneath the
  // overlay shell (opacity 0, no pointer events) so the pane reads clean.
  const trigger = (
    <Pressable
      onLayout={handleTriggerLayout}
      onPress={handleOpen}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? triggerLabel}
      testID={triggerTestID}
      // `self-start` so the pill hugs its content instead of stretching to the
      // parent's cross size — the measured width feeds the morph's closed state.
      className="h-9 flex-row items-center gap-1.5 self-start rounded-full bg-surface-3 px-3"
    >
      {triggerIcon ? <ThemedIcon icon={triggerIcon} token="foreground" size={16} /> : null}
      <Text size="sm" weight="semibold" numberOfLines={1} className="text-foreground">
        {triggerLabel}
      </Text>
      <ThemedIcon icon={ChevronDown} token="muted-foreground" size={14} />
    </Pressable>
  );

  const closedWidth = triggerSize?.width ?? 0;
  const closedHeight = triggerSize?.height ?? TRIGGER_HEIGHT;

  return (
    <View
      testID={testID}
      style={[{ zIndex: open ? 40 : 0 }, style]}
      // Relative wrapper holding the trigger in flow; the shell is an absolute
      // overlay that grows beyond it when open, covering the page below.
    >
      <View style={open ? { opacity: 0, pointerEvents: 'none' } : { pointerEvents: 'auto' }}>{trigger}</View>

      <MotiView
        animate={{
          width: open ? Math.max(expandedWidth, triggerSize?.width ?? 0) : closedWidth,
          height: open ? paneHeight : closedHeight,
          borderRadius: open ? PANE_RADIUS : closedHeight / 2,
        }}
        transition={morphTransition}
        className="absolute left-0 top-0 overflow-hidden"
        style={open ? { zIndex: 40, pointerEvents: 'auto' } : { pointerEvents: 'none' }}
      >
        {open ? (
          <MotiView
            from={reduce ? { opacity: 1 } : { opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={paneEnterTransition}
            className="w-full rounded-[20px] bg-surface-3 p-2 shadow-floating"
          >
            {closeIcon === null ? null : (
              <View className="flex-row items-center justify-end pb-1">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  testID={`${testID}-close`}
                  onPress={handleClose}
                  className="h-5 w-5 items-center justify-center rounded-full bg-surface-selected"
                >
                  {closeIcon ?? <ThemedIcon icon={ChevronUp} variant="ghost" size={12} />}
                </Pressable>
              </View>
            )}
            {items.map((item) => (
              <MorphingSwitcherRow
                key={item.value}
                item={item}
                active={item.value === value}
                onSelect={handleSelect}
                testID={`${testID}-item-${item.value}`}
              />
            ))}
          </MotiView>
        ) : null}
      </MotiView>
    </View>
  );
}
