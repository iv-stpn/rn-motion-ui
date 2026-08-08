import { cva, type VariantProps } from 'class-variance-authority';
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
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
 * Per-button `contentStyle` for the bordered variant. Zeros out the inner
 * corner radii so adjacent buttons sit flush; outer corners keep the
 * interactive radius. A single child keeps its natural `rounded-interactive`.
 */
function borderedContentStyle(index: number, total: number, horizontal: boolean): ViewStyle {
  if (total === 1) return {}; // keep the button's own rounded-interactive

  const isFirst = index === 0;
  const isLast = index === total - 1;

  if (horizontal) {
    if (isFirst) return { borderTopRightRadius: 0, borderBottomRightRadius: 0 };
    if (isLast) return { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 };
  } else {
    if (isFirst) return { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 };
    if (isLast) return { borderTopLeftRadius: 0, borderTopRightRadius: 0 };
  }
  return { borderRadius: 0 };
}

/**
 * Type guard that narrows a React node to an element whose props accept
 * `contentStyle`, `className`, and `pressMode`. Used by the bordered variant
 * to inject border, corner-radius, and press-animation overrides directly
 * into Button children without an `as` cast.
 */
function isPressableElement(child: ReactNode): child is ReactElement<{
  className?: string;
  contentStyle?: StyleProp<ViewStyle>;
  pressMode?: 'scale' | 'scaleY' | 'none';
}> {
  return isValidElement(child);
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
 * `bordered` — a segmented control: inner-facing edges carry a single divider
 * border (`border-r` / `border-b`); no border forms on the outer perimeter.
 * Inner corner radii are zeroed via `contentStyle` so adjacent buttons sit
 * flush. Outer corners keep the interactive radius from the button's own
 * variant. Horizontal groups press down (`scaleY` + `translateY`); vertical
 * groups have no press animation.
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

  // ── bordered (segmented) ─────────────────────────────────────────────────

  const kids = Children.toArray(children).filter(Boolean);

  const total = kids.length;

  const content = kids.map((child, index) => {
    const isFirst = index === 0;
    const isLast = index === total - 1;

    // Borders go only on inner-facing sides so no perimeter border forms
    // around the group.  Each non-last button contributes a single divider
    // edge; adjacent buttons overlap 1 px to merge them.
    let positionClass = 'flex-1';
    if (total > 1) {
      if (isHorizontal && !isLast) positionClass += ' border-r border-border';
      else if (!isLast) positionClass += ' border-b border-border';

      if (!isFirst) positionClass += isHorizontal ? ' -ml-px' : ' -mt-px';
    }

    if (!isPressableElement(child)) return child;

    return cloneElement(child, {
      className: positionClass,
      contentStyle: borderedContentStyle(index, total, isHorizontal),
      pressMode: isHorizontal ? 'scaleY' : 'none',
    });
  });

  return (
    <View testID={testID ?? 'button-group'} className={groupClassName} style={style}>
      {content}
    </View>
  );
}
