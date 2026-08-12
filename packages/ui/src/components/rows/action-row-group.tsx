// biome-ignore-all lint/style/useExportsLast: the entry types head the module so the implementations below read against them
import { Fragment } from 'react';
import type { ViewProps } from 'react-native';
import { ActionRow } from './action-row';
import type { ItemRowSize } from './item-row';
import { groupedRowClass, RowGroupContainer, type RowGroupItemBase, type RowGroupVariant } from './row-group';

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

  const rows = items.map((item, index) => (
    <Fragment key={item.id}>
      <ActionRow
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
        className={variant === 'grouped' ? groupedRowClass(index, lastIndex) : undefined}
      />
    </Fragment>
  ));

  return (
    <RowGroupContainer variant={variant} size={size} className={className} style={style} testID={testID}>
      {rows}
    </RowGroupContainer>
  );
}
