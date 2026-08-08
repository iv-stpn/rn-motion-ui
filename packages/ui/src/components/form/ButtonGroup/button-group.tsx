import { cva, type VariantProps } from 'class-variance-authority';
import { Children, isValidElement, type ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { cn } from '../../../lib/cn';
import type { ButtonSize } from '../Button/button-scale';

// ── cva container ────────────────────────────────────────────────────────────

const container = cva('flex', {
  variants: {
    orientation: {
      horizontal: 'flex-row',
      vertical: 'flex-col',
    },
    variant: {
      spaced: '',
      bordered: 'border border-border rounded-button-md overflow-hidden',
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

// ── props ────────────────────────────────────────────────────────────────────

export interface ButtonGroupProps extends VariantProps<typeof container> {
  /** Size drives the gap between children in `spaced` mode. @default 'md' */
  size?: ButtonSize;
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// ── component ────────────────────────────────────────────────────────────────

/**
 * A horizontal (or vertical) row of buttons.
 *
 * `spaced` — each button keeps its own border-radius; a consistent gap separates them.
 * `bordered` — buttons sit flush inside a shared border with thin dividers between
 * them; the container's `overflow-hidden` clips the outer corners while inner edges
 * stay sharp, giving a segmented-control look.
 *
 * Individual button press animations are handled by the Button children themselves
 * (pressScale + MOTION_SNAPPY spring) — the group is purely a layout container.
 */
export function ButtonGroup({
  variant = 'spaced',
  orientation = 'horizontal',
  size = 'md',
  children,
  className,
  style,
  testID,
}: ButtonGroupProps) {
  const isBordered = variant === 'bordered';
  const isHorizontal = orientation === 'horizontal';

  const alignClass = alignmentClass(isBordered, isHorizontal);

  const groupClassName = cn(container({ orientation, variant }), alignClass, !isBordered && GAP_CLASS[size], className);

  // ── spaced (simple gap) ──────────────────────────────────────────────────

  if (!isBordered)
    return (
      <View testID={testID ?? 'button-group'} className={groupClassName} style={style}>
        {children}
      </View>
    );

  // ── bordered (dividers between children) ─────────────────────────────────

  const kids = Children.toArray(children).filter(Boolean);

  const content = kids.flatMap((child, index) => {
    // Use the child's own key as a stable identifier; fall back to index for
    // host containers (strings, fragments) that don't carry a key.
    const childKey = isValidElement(child) ? child.key : index;
    const isLast = index === kids.length - 1;
    const item = (
      <View key={`bg-btn-${childKey}`} className="flex-1">
        {child}
      </View>
    );

    if (isLast) return [item];

    const divider = <View key={`bg-div-${childKey}`} className={cn(isHorizontal ? 'w-px bg-border' : 'h-px bg-border')} />;

    return [item, divider];
  });

  return (
    <View testID={testID ?? 'button-group'} className={groupClassName} style={style}>
      {content}
    </View>
  );
}
