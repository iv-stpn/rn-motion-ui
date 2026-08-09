import { cva, type VariantProps } from 'class-variance-authority';
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { cn } from '../../../lib/cn';
import type { ButtonSize, ButtonVariant } from '../Button/button';

// ── cva container ────────────────────────────────────────────────────────────

const container = cva('flex', {
  variants: {
    orientation: {
      horizontal: 'flex-row',
      vertical: 'flex-col',
    },
    variant: {
      spaced: '',
      bordered: '',
    },
  },
  defaultVariants: { orientation: 'horizontal', variant: 'spaced' },
});

// ── gap map ──────────────────────────────────────────────────────────────────

const GAP_CLASS: Record<ButtonSize, string> = { sm: 'gap-2', md: 'gap-3', lg: 'gap-4', icon: 'gap-2' };

// ── helpers ──────────────────────────────────────────────────────────────────

function alignmentClass(bordered: boolean, horizontal: boolean): 'items-stretch' | 'items-center' {
  if (bordered) return 'items-stretch';
  return horizontal ? 'items-center' : 'items-stretch';
}

/**
 * Per-button `contentClassName` for the bordered variant. Zeros out the inner
 * corner radii so adjacent buttons sit flush; outer corners keep the
 * interactive radius. A single child keeps its natural `rounded-interactive`.
 */
function borderedContentClassName(index: number, total: number, horizontal: boolean): string {
  if (total === 1) return '';

  const isFirst = index === 0;
  const isLast = index === total - 1;

  if (horizontal) {
    if (isFirst) return 'rounded-r-none';
    if (isLast) return 'rounded-l-none';
  } else {
    if (isFirst) return 'rounded-b-none';
    if (isLast) return 'rounded-t-none';
  }
  return 'rounded-none';
}

/**
 * Resolves the press animation mode for a vertical bordered group. The first
 * button nudges up, the last nudges down, and middle buttons squeeze inward
 * horizontally — together they read as a stack compressing toward its centre.
 */
function verticalPressMode(isFirst: boolean, isLast: boolean) {
  if (isFirst) return 'scaleXFirst' as const;
  if (isLast) return 'scaleXLast' as const;
  return 'scaleX' as const;
}

/**
 * Type guard that narrows a React node to an element whose props accept
 * `value` (for toggle identity), `contentClassName`, `className`, `variant`,
 * `onPress`, and `pressMode`. Used by the bordered variant to inject border,
 * corner-radius, press-animation, and selection overrides directly into Button
 * children without an `as` cast.
 */
function isToggleChild(child: ReactNode): child is ReactElement<{
  value?: string;
  className?: string;
  contentClassName?: string;
  variant?: ButtonVariant;
  onPress?: () => void;
  pressMode?: 'scale' | 'scaleY' | 'scaleX' | 'scaleXFirst' | 'scaleXLast' | 'none';
}> {
  return isValidElement(child);
}

// ── props ────────────────────────────────────────────────────────────────────

export interface ToggleGroupProps extends VariantProps<typeof container> {
  /** Size drives the gap between children in `spaced` mode. @default 'md' */
  size?: ButtonSize;
  /**
   * The `value` of the currently-selected toggle item. Pass `undefined` or
   * omit to leave every item unselected.
   */
  value?: string;
  /**
   * Called when the user presses a toggle item, with that item's `value`
   * string. The consumer updates `value` in response.
   */
  onValueChange?: (value: string) => void;
  /**
   * Button variant applied to the **selected** child.
   * @default 'secondary' for bordered, 'primary' for spaced
   */
  selectedVariant?: ButtonVariant;
  /**
   * Button variant applied to **unselected** children.
   * @default 'ghost'
   */
  unselectedVariant?: ButtonVariant;
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// ── component ────────────────────────────────────────────────────────────────

/**
 * A horizontal (or vertical) row of buttons where exactly one choice is
 * selected at a time — a radio-group-style toggle built from the Button
 * family.
 *
 * `spaced` — each button keeps its own border-radius; a consistent gap
 * separates them. The selected button renders with `selectedVariant`
 * (default `primary`); unselected buttons use `unselectedVariant` (default
 * `ghost`).
 *
 * `bordered` — a segmented control: inner-facing edges carry a single divider
 * border; no border forms on the outer perimeter. Inner corner radii are
 * zeroed via `contentClassName` so adjacent buttons sit flush. The selected
 * button renders with `selectedVariant` (default `secondary`); unselected
 * buttons use `unselectedVariant` (default `ghost`).
 *
 * Each child must carry a `value` prop (a string) that identifies it. Pressing
 * a child calls `onValueChange` with that value — the consumer updates `value`
 * to complete the selection.
 */
export function ToggleGroup({
  variant = 'spaced',
  orientation = 'horizontal',
  size = 'md',
  value,
  onValueChange,
  selectedVariant,
  unselectedVariant = 'ghost',
  children,
  className,
  style,
  testID,
}: ToggleGroupProps) {
  const isBordered = variant === 'bordered';
  const isHorizontal = orientation === 'horizontal';

  // Resolve defaults for the selection variants.
  const selVariant: ButtonVariant = selectedVariant ?? (isBordered ? 'secondary' : 'primary');

  const alignClass = alignmentClass(isBordered, isHorizontal);

  const groupClassName = cn(container({ orientation, variant }), alignClass, !isBordered && GAP_CLASS[size], className);

  // ── spaced (simple gap) ──────────────────────────────────────────────────

  if (!isBordered) {
    const spacedChildren = Children.map(children, (child) => {
      if (!isToggleChild(child)) return child;

      const childValue = child.props.value;
      const isSelected = childValue !== undefined && childValue === value;

      return cloneElement(child, {
        variant: isSelected ? selVariant : unselectedVariant,
        onPress: childValue ? () => onValueChange?.(childValue) : child.props.onPress,
      });
    });

    return (
      <View testID={testID ?? 'toggle-group'} className={groupClassName} style={style}>
        {spacedChildren}
      </View>
    );
  }

  // ── bordered (segmented) ─────────────────────────────────────────────────

  const kids = Children.toArray(children).filter(Boolean);
  const total = kids.length;

  const content = kids.map((child, index) => {
    const isFirst = index === 0;
    const isLast = index === total - 1;

    // Borders go only on inner-facing sides: each non-last button contributes
    // a trailing divider; non-first buttons suppress their leading border so
    // adjacent edges never double up.
    let positionClass = 'flex-1';
    if (total > 1) {
      if (isHorizontal && !isLast) positionClass += ' border-r border-border/50';
      else if (!isLast) positionClass += ' border-b border-border/50';

      if (!isFirst) positionClass += isHorizontal ? ' border-l-0' : ' border-t-0';
    }

    if (!isToggleChild(child)) return child;

    const childValue = child.props.value;
    const isSelected = childValue !== undefined && childValue === value;

    return cloneElement(child, {
      className: positionClass,
      contentClassName: borderedContentClassName(index, total, isHorizontal),
      pressMode: isHorizontal ? 'scaleY' : verticalPressMode(isFirst, isLast),
      variant: isSelected ? selVariant : unselectedVariant,
      onPress: childValue ? () => onValueChange?.(childValue) : child.props.onPress,
    });
  });

  return (
    <View testID={testID ?? 'toggle-group'} className={groupClassName} style={style}>
      {content}
    </View>
  );
}
