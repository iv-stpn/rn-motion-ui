// biome-ignore-all lint/style/useExportsLast: the entry types head the module so the implementations below read against them
import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '../../lib/cn';
import { ActionRow } from './action-row';
import { ItemRow, type ItemRowAdornment, type ItemRowSize } from './item-row';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const GAP_CLASS: Record<ItemRowSize, string> = { sm: 'gap-1', md: 'gap-2', lg: 'gap-3' };

export type RowGroupVariant = 'spaced' | 'grouped';

/** Props every row-group item shares. */
type RowGroupItemBase = {
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

/** Shared container — handles spaced gap or grouped border + dividers. */
function RowGroupContainer({ variant, size, className, style, testID, children }: RowGroupContainerProps) {
  if (variant === 'spaced')
    return (
      <View testID={testID} className={cn('flex flex-col', GAP_CLASS[size], className)} style={style}>
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

// ---------------------------------------------------------------------------
// ActionRowGroup
// ---------------------------------------------------------------------------

export type ActionRowGroupItem = RowGroupItemBase & {
  /** Press handler — the row shows hover/press overlays and the default chevron. */
  onPress?: () => void;
  /** URL for link-style navigation (React Native Web extension). */
  href?: string;
};

export type ActionRowGroupProps = {
  items: ActionRowGroupItem[];
  variant?: RowGroupVariant;
  size?: ItemRowSize;
  className?: string;
  style?: ViewProps['style'];
  testID?: string;
};

/**
 * A grouped list of actions, each rendered as an {@link ActionRow}.
 *
 * @example
 * <ActionRowGroup
 *   items={[
 *     { id: 'profile', title: 'Profile', leftAdornment: { icon: User }, onPress: goToProfile },
 *     { id: 'settings', title: 'Settings', leftAdornment: { icon: Settings }, onPress: goToSettings },
 *   ]}
 * />
 */
export function ActionRowGroup({
  items,
  variant = 'grouped',
  size = 'md',
  className,
  style,
  testID = 'action-row-group',
}: ActionRowGroupProps) {
  const lastIndex = items.length - 1;

  const rows = items.map((item, index) => {
    const isLast = index === lastIndex;
    return (
      <ActionRow
        key={item.id}
        testID={`${testID}-item-${item.id}`}
        title={item.title}
        description={item.description}
        leftAdornment={item.leftAdornment}
        rightAdornment={item.rightAdornment}
        onPress={item.onPress}
        href={item.href}
        disabled={item.disabled}
        size={size}
        variant="default"
        className={variant === 'grouped' && !isLast ? 'border-border border-b' : undefined}
      />
    );
  });

  return (
    <RowGroupContainer variant={variant} size={size} className={className} style={style} testID={testID}>
      {rows}
    </RowGroupContainer>
  );
}

// ---------------------------------------------------------------------------
// ItemRowGroup
// ---------------------------------------------------------------------------

export type ItemRowGroupItem = RowGroupItemBase;

export type ItemRowGroupProps = {
  items: ItemRowGroupItem[];
  variant?: RowGroupVariant;
  size?: ItemRowSize;
  className?: string;
  style?: ViewProps['style'];
  testID?: string;
};

/**
 * A grouped list of static rows, each rendered as an {@link ItemRow}.
 *
 * @example
 * <ItemRowGroup
 *   items={[
 *     { id: 'wifi', title: 'Wi-Fi', rightAdornment: <Switch /> },
 *     { id: 'bt', title: 'Bluetooth', rightAdornment: <Switch /> },
 *   ]}
 * />
 */
export function ItemRowGroup({
  items,
  variant = 'grouped',
  size = 'md',
  className,
  style,
  testID = 'item-row-group',
}: ItemRowGroupProps) {
  const lastIndex = items.length - 1;

  const rows = items.map((item, index) => {
    const isLast = index === lastIndex;
    return (
      <ItemRow
        key={item.id}
        testID={`${testID}-item-${item.id}`}
        title={item.title}
        description={item.description}
        leftAdornment={item.leftAdornment}
        rightAdornment={item.rightAdornment}
        disabled={item.disabled}
        size={size}
        variant="default"
        className={variant === 'grouped' && !isLast ? 'border-border border-b' : undefined}
      />
    );
  });

  return (
    <RowGroupContainer variant={variant} size={size} className={className} style={style} testID={testID}>
      {rows}
    </RowGroupContainer>
  );
}
