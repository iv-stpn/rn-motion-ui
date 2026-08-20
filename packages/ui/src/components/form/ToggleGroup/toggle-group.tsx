import { type ReactNode, useCallback } from 'react';
import { Pressable, ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
import { cn } from '../../../lib/cn';
import { H_INTERACTIVE, PX_INTERACTIVE, TEXT_INTERACTIVE } from '../../../lib/radius';
import { Text } from '../../typography/Text/text';

// ── types ──────────────────────────────────────────────────────────────────────

type ToggleGroupSize = 'sm' | 'md' | 'lg';
type ToggleGroupShape = 'rounded' | 'pill';
type ToggleGroupVariant = 'bordered' | 'connected';

// ── shape → radius ─────────────────────────────────────────────────────────────

const SHAPE_RADIUS: Record<ToggleGroupShape, string> = { rounded: 'rounded-interactive', pill: 'rounded-full' };

// ── shared text ────────────────────────────────────────────────────────────────

/** Selection-aware text class — selected items get a subtle foreground lift above the translucent overlay. */
function itemTextClass(size: ToggleGroupSize, selected: boolean): string {
  return cn(TEXT_INTERACTIVE[size], selected ? 'text-white' : 'text-muted-foreground');
}

// ── exports ────────────────────────────────────────────────────────────────────

export type ToggleGroupItem = {
  /** Unique identifier for the item — passed to `onValueChange` on press. */
  value: string;
  /** Content rendered inside the item. Typically a short text label. */
  label: ReactNode;
};

export type ToggleGroupProps = {
  /** Items to render. Each item must have a unique `value` and a `label` to display. */
  items: ToggleGroupItem[];
  /** The `value` of the currently-selected item. Pass `undefined` for no selection. */
  value?: string;
  /** Called when the user presses an item, with that item's `value`. */
  onValueChange?: (value: string) => void;
  /** Size drives item height and text size. @default 'md' */
  size?: ToggleGroupSize;
  /**
   * Corner shape — `rounded` uses the interactive radius, `pill` uses fully-rounded.
   * Shapes the outer edges of the segmented control.
   * @default 'pill'
   */
  shape?: ToggleGroupShape;
  /**
   * `bordered` renders a segmented control with an outer border and inner dividers
   * between items; `connected` drops the inner dividers so items read as one
   * continuous strip.
   * @default 'bordered'
   */
  variant?: ToggleGroupVariant;
  /** Layout direction — items sit side by side or stacked. @default 'horizontal' */
  orientation?: 'horizontal' | 'vertical';
  children?: undefined;

  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// ── component ──────────────────────────────────────────────────────────────────

/**
 * A segmented control — a row (or column) of flat items where one choice is
 * selected at a time, built from Pressable + Text.
 *
 * `variant` — `bordered` (an outer border with inner dividers between items) or
 * `connected` (no inner dividers — items sit flush as one continuous strip).
 *
 * `shape` — `rounded` (interactive corner radius) or `pill` (fully-rounded) —
 * controls the outer edges of the control.
 *
 * Dividers adjacent to the selected item are suppressed so the selection reads as
 * one continuous surface with its neighbours.
 *
 * Horizontal groups scroll when they run out of width, while vertical groups keep
 * their items stacked.
 *
 * Each item is identified by a `value` string. Pressing an item calls
 * `onValueChange` with that value — the consumer updates `value` to complete
 * the selection.
 */
export function ToggleGroup({
  variant = 'bordered',
  orientation = 'horizontal',
  shape = 'pill',
  size = 'md',
  value,
  onValueChange,
  items,
  className,
  style,
  testID,
}: ToggleGroupProps) {
  const isHorizontal = orientation === 'horizontal';
  const radius = SHAPE_RADIUS[shape];
  const isConnected = variant === 'connected';

  const getOnValueChangeHandler = useCallback((itemValue: string) => () => onValueChange?.(itemValue), [onValueChange]);

  const total = items.length;
  const selectedIdx = items.findIndex((it) => it.value === value);

  const segmentedItems = items.map((item, index) => {
    const selected = item.value === value;
    const isLast = index === total - 1;

    // suppress dividers adjacent to the selected item so it reads as
    // one continuous surface with its neighbours. connected mode has no
    // internal dividers at all.
    const suppressDivider = isConnected || (selectedIdx !== -1 && (index === selectedIdx || index === selectedIdx - 1));

    const itemClass = cn(
      H_INTERACTIVE[size],
      'items-center justify-center',
      PX_INTERACTIVE[size],
      !isHorizontal && 'py-3',
      selected ? 'bg-info' : 'bg-surface-contrast',
      total > 1 && !isLast && !suppressDivider && (isHorizontal ? 'border-r border-border' : 'border-b border-border'),
    );

    return (
      <Pressable
        key={item.value}
        accessibilityRole="radio"
        aria-checked={selected}
        onPress={getOnValueChangeHandler(item.value)}
        className={itemClass}
      >
        <Text weight="medium" className={itemTextClass(size, selected)}>
          {item.label}
        </Text>
      </Pressable>
    );
  });

  // The shell is a bordered, overflow-clipped column so a horizontal ScrollView
  // can stretch to its width and scroll the items when they overflow; vertical
  // segmented controls keep the items stacked directly.
  return (
    <View
      testID={testID ?? 'toggle-group'}
      className={cn('relative flex flex-col overflow-hidden border border-border', radius, className)}
      style={style}
    >
      {isHorizontal ? (
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
          {segmentedItems}
        </ScrollView>
      ) : (
        segmentedItems
      )}
    </View>
  );
}
