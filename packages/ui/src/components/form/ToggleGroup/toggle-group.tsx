import { cva, type VariantProps } from 'class-variance-authority';
import { type ReactNode, useCallback } from 'react';
import { Pressable, ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
import { cn } from '../../../lib/cn';
import { H_INTERACTIVE, PX_INTERACTIVE, TEXT_INTERACTIVE } from '../../../lib/radius';
import { Text } from '../../typography/Text/text';

// ── types ──────────────────────────────────────────────────────────────────────

type ToggleGroupSize = 'sm' | 'md' | 'lg';
type ToggleGroupShape = 'rounded' | 'pill';

// ── cva container ──────────────────────────────────────────────────────────────

const container = cva('flex relative', {
  variants: {
    orientation: {
      horizontal: 'flex-row',
      vertical: 'flex-col',
    },
    variant: {
      spaced: 'flex-wrap',
      bordered: 'border border-border overflow-hidden',
      connected: 'border border-border overflow-hidden',
    },
  },
  defaultVariants: { orientation: 'horizontal', variant: 'spaced' },
});

// ── gap map ────────────────────────────────────────────────────────────────────

const GAP_CLASS: Record<ToggleGroupSize, string> = { sm: 'gap-2', md: 'gap-3', lg: 'gap-4' };

// ── shape → radius ─────────────────────────────────────────────────────────────

const SHAPE_RADIUS: Record<ToggleGroupShape, string> = { rounded: 'rounded-interactive', pill: 'rounded-full' };

// ── shared text ────────────────────────────────────────────────────────────────

/** Selection-aware text class — selected items get a subtle foreground lift above the translucent overlay. */
function itemTextClass(size: ToggleGroupSize, selected: boolean): string {
  return cn('font-medium', TEXT_INTERACTIVE[size], selected ? 'text-white' : 'text-muted-foreground');
}

// ── exports ────────────────────────────────────────────────────────────────────

export type ToggleGroupItem = {
  /** Unique identifier for the item — passed to `onValueChange` on press. */
  value: string;
  /** Content rendered inside the item. Typically a short text label. */
  label: ReactNode;
};

export interface ToggleGroupProps extends VariantProps<typeof container> {
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
   * In `bordered` / `connected` variants it shapes the outer edges; in `spaced` it
   * shapes each individual item.
   * @default 'pill'
   */
  shape?: ToggleGroupShape;
  children?: undefined;

  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// ── component ──────────────────────────────────────────────────────────────────

/**
 * A row (or column) of flat toggle items where one choice is selected at a time —
 * a radio-group-style control built from Pressable + Text.
 *
 * `variant` — `spaced` (items apart with gaps), `bordered` (segmented control
 * with an outer border and inner dividers), or `connected` (same as bordered but
 * without the outer border — items sit flush with inner dividers only).
 *
 * `shape` — `rounded` (interactive corner radius) or `pill` (fully-rounded). In
 * `bordered` / `connected` it controls the outer edges; in `spaced` it controls
 * each individual item's shape.
 *
 * Dividers adjacent to the selected item are suppressed so the selection reads as
 * one continuous surface with its neighbours.
 *
 * `spaced` groups wrap onto additional lines when they run out of width, while
 * `bordered` / `connected` groups scroll horizontally instead of overflowing.
 *
 * Each item is identified by a `value` string. Pressing an item calls
 * `onValueChange` with that value — the consumer updates `value` to complete
 * the selection.
 */
export function ToggleGroup({
  variant = 'spaced',
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
  const isSegmented = variant === 'bordered' || variant === 'connected';
  const isHorizontal = orientation === 'horizontal';
  const radius = SHAPE_RADIUS[shape];

  const getOnValueChangeHandler = useCallback((itemValue: string) => () => onValueChange?.(itemValue), [onValueChange]);

  // ── segmented (bordered / connected) ─────────────────────────────────────────

  if (isSegmented) {
    const total = items.length;
    const selectedIdx = items.findIndex((it) => it.value === value);
    const isConnected = variant === 'connected';

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
        selected ? 'bg-info -my-px' : 'bg-surface-contrast',
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
          <Text className={itemTextClass(size, selected)}>{item.label}</Text>
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

  // ── spaced ───────────────────────────────────────────────────────────────────

  return (
    <View
      testID={testID ?? 'toggle-group'}
      className={cn(container({ orientation, variant }), GAP_CLASS[size], className)}
      style={style}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="radio"
            aria-checked={selected}
            onPress={getOnValueChangeHandler(item.value)}
            className={cn(
              radius,
              H_INTERACTIVE[size],
              PX_INTERACTIVE[size],
              selected ? 'bg-info' : 'bg-surface-contrast',
              'items-center justify-center',
              !isHorizontal && 'py-3',
            )}
          >
            <Text className={itemTextClass(size, selected)}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
