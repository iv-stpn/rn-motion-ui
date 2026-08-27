import { type ReactNode, useCallback } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { cn } from '../../../lib/cn';
import { H_INTERACTIVE, PX_INTERACTIVE, TEXT_INTERACTIVE } from '../../../lib/radius';
import { Text } from '../../typography/Text/text';

// ── types ──────────────────────────────────────────────────────────────────────

type ChoiceGroupSize = 'sm' | 'md' | 'lg';
type ChoiceGroupShape = 'rounded' | 'pill';
type ChoiceGroupVariant = 'neutral' | 'info' | 'outline' | 'outline-info';

// ── gap map ────────────────────────────────────────────────────────────────────

const GAP_CLASS: Record<ChoiceGroupSize, string> = { sm: 'gap-2', md: 'gap-3', lg: 'gap-4' };

// ── shape → radius ─────────────────────────────────────────────────────────────

const SHAPE_RADIUS: Record<ChoiceGroupShape, string> = { rounded: 'rounded-interactive', pill: 'rounded-full' };

// ── variant → item classes ─────────────────────────────────────────────────────

/**
 * Selected-item class per variant. Filled variants (`neutral` / `info`) paint the
 * accent as the background; outline variants (`outline` / `outline-info`) keep the
 * fill transparent and signal selection with a coloured border. Spelled as
 * literals so UniWind statically resolves every member.
 */
const VARIANT_SELECTED: Record<ChoiceGroupVariant, string> = {
  neutral: 'bg-primary',
  info: 'bg-info',
  outline: 'border-[1.5px] border-primary',
  'outline-info': 'border-[1.5px] border-info',
};

/** Unselected-item class per variant — filled items keep the surface, outline items keep a hairline border. */
const VARIANT_UNSELECTED: Record<ChoiceGroupVariant, string> = {
  neutral: 'bg-muted',
  info: 'bg-muted',
  outline: 'border-[1.5px] border-border',
  'outline-info': 'border-[1.5px] border-border',
};

/** Selected label colour per variant — the accent's `-foreground` on filled items, the accent ink on outline items. */
const VARIANT_SELECTED_TEXT: Record<ChoiceGroupVariant, string> = {
  neutral: 'text-primary-foreground',
  info: 'text-info-foreground',
  outline: 'text-primary',
  'outline-info': 'text-info',
};

// ── shared text ────────────────────────────────────────────────────────────────

/** Selection-aware text class — the label reads on the accent (filled) or as the accent (outline) when selected, muted otherwise. */
function itemTextClass(size: ChoiceGroupSize, variant: ChoiceGroupVariant, selected: boolean): string {
  return cn(TEXT_INTERACTIVE[size], selected ? VARIANT_SELECTED_TEXT[variant] : 'text-muted-foreground');
}

// ── exports ────────────────────────────────────────────────────────────────────

export type ChoiceGroupItem = {
  /** Unique identifier for the item — passed to `onValueChange` on press. */
  value: string;
  /** Content rendered inside the item. Typically a short text label. */
  label: ReactNode;
};

export type ChoiceGroupProps = {
  /** Items to render. Each item must have a unique `value` and a `label` to display. */
  items: ChoiceGroupItem[];
  /** The `value` of the currently-selected item. Pass `undefined` for no selection. */
  value?: string;
  /** Called when the user presses an item, with that item's `value`. */
  onValueChange?: (value: string) => void;
  /** Size drives item height and text size. @default 'md' */
  size?: ChoiceGroupSize;
  /**
   * Corner shape — `rounded` uses the interactive radius, `pill` uses fully-rounded.
   * Shapes each individual item.
   * @default 'pill'
   */
  shape?: ChoiceGroupShape;
  /**
   * How the selected item is highlighted — `neutral` / `info` fill the accent as
   * the background, `outline` / `outline-info` draw a coloured border around it.
   * @default 'outline'
   */
  variant?: ChoiceGroupVariant;
  /** Layout direction — items sit side by side or stacked. @default 'horizontal' */
  orientation?: 'horizontal' | 'vertical';
  children?: undefined;

  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// ── component ──────────────────────────────────────────────────────────────────

/**
 * A row (or column) of flat, independent choice chips where one is selected at a
 * time — a radio-group-style control built from Pressable + Text.
 *
 * Unlike `ToggleGroup`'s segmented (`bordered` / `connected`) container variants,
 * items sit apart with a gap and each carries its own `shape` (rounded or pill)
 * border, and the group wraps onto additional lines when it runs out of width
 * instead of scrolling.
 *
 * `shape` — `rounded` (interactive corner radius) or `pill` (fully-rounded) — is
 * applied to each individual item.
 *
 * `variant` — `neutral` / `info` (filled) or `outline` / `outline-info`
 * (bordered) — controls how the selected item is highlighted.
 *
 * Each item is identified by a `value` string. Pressing an item calls
 * `onValueChange` with that value — the consumer updates `value` to complete
 * the selection.
 */
export function ChoiceGroup({
  orientation = 'horizontal',
  shape = 'pill',
  variant = 'outline',
  size = 'md',
  value,
  onValueChange,
  items,
  className,
  style,
  testID,
}: ChoiceGroupProps) {
  const isHorizontal = orientation === 'horizontal';
  const radius = SHAPE_RADIUS[shape];

  const getOnValueChangeHandler = useCallback((itemValue: string) => () => onValueChange?.(itemValue), [onValueChange]);

  return (
    <View
      testID={testID ?? 'choice-group'}
      className={cn('relative flex flex-wrap', isHorizontal ? 'flex-row' : 'flex-col', GAP_CLASS[size], className)}
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
              selected ? VARIANT_SELECTED[variant] : VARIANT_UNSELECTED[variant],
              'items-center justify-center',
              !isHorizontal && 'py-3',
            )}
          >
            <Text weight="medium" className={itemTextClass(size, variant, selected)}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
