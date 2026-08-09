// biome-ignore-all lint/style/useExportsLast: the shared types head the module so the component files below read against them
import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '../../lib/cn';
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

/** Shared container — handles spaced gap, grouped border + dividers, or sections layout. */
export function RowGroupContainer({ variant, size, className, style, testID, children }: RowGroupContainerProps) {
  if (variant === 'spaced')
    return (
      <View testID={testID} className={cn('flex flex-col', GAP_CLASS[size], className)} style={style}>
        {children}
      </View>
    );

  if (variant === 'sections')
    return (
      <View
        testID={testID}
        className={cn('flex flex-col rounded-2xl bg-surface-3 p-4', GAP_CLASS[size], className)}
        style={style}
      >
        {children}
      </View>
    );

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
