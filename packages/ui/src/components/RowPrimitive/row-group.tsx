// biome-ignore-all lint/style/useExportsLast: the shared types head the module so the component files below read against them
import { Children, Fragment, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '../../lib/cn';
import { elevated } from '../../lib/elevated';
import type { ItemRowAdornment, ItemRowSize } from './item-row';

// ---------------------------------------------------------------------------
// Shared internals
// ---------------------------------------------------------------------------

const GAP_CLASS: Record<ItemRowSize, string> = { sm: 'gap-1', md: 'gap-2', lg: 'gap-3' };

export type RowGroupVariant = 'spaced' | 'grouped' | 'sections';

/** Props every row-group item shares. */
export type RowGroupItemBase = {
  /** Unique key within the group — drives `key` and `testID`. */
  id: string;
  title: ReactNode;
  description?: ReactNode;
  leftAdornment?: ItemRowAdornment;
  rightAdornment?: ItemRowAdornment;
  disabled?: boolean;
};

// ---------------------------------------------------------------------------
// Container layout (internal)
// ---------------------------------------------------------------------------

type RowGroupContainerProps = {
  variant: RowGroupVariant;
  size: ItemRowSize;
  className?: string;
  style?: ViewProps['style'];
  testID?: string;
  children: ReactNode;
};

/**
 * Returns the className for a row inside a `"grouped"` variant group so that
 * consecutive rows share borders and only the first/last row carry outer radii.
 */
export function groupedRowClass(index: number, lastIndex: number): string {
  return cn(
    index === 0 && 'rounded-b-none',
    index === lastIndex && 'rounded-t-none',
    index > 0 && index < lastIndex && 'rounded-none',
    index !== lastIndex && 'border-border border-b',
  );
}

/** Shared container — handles spaced gap, grouped border + dividers, or sections layout. */
export function RowGroupContainer({ variant, size, className, style, testID, children }: RowGroupContainerProps) {
  if (variant === 'spaced')
    return (
      <View testID={testID} className={cn('flex flex-col', GAP_CLASS[size], className)} style={style}>
        {children}
      </View>
    );

  if (variant === 'sections') {
    const childArray = Children.toArray(children);
    return (
      <View testID={testID} className={cn('flex flex-col rounded-card p-4', elevated(3), className)} style={style}>
        {childArray.map((child, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: children array is stable — derived from the parent's fixed items list — and the wrapper fragments are stateless
          <Fragment key={index}>
            {child}
            {index < childArray.length - 1 && <View className="h-px bg-border my-2" />}
          </Fragment>
        ))}
      </View>
    );
  }

  return (
    <View
      testID={testID}
      className={cn('flex flex-col overflow-hidden rounded-interactive border border-border', className)}
      style={style}
    >
      {children}
    </View>
  );
}
