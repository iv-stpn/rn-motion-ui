// biome-ignore-all lint/style/useExportsLast: the entry types head the module so the implementations below read against them
import { Fragment } from 'react';
import type { ViewProps } from 'react-native';
import type { ItemRowSize } from './item-row';
import { ItemRow } from './item-row';
import { groupedRowClass, RowGroupContainer, type RowGroupItemBase, type RowGroupVariant } from './row-group';

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

  const rows = items.map((item, index) => (
    <Fragment key={item.id}>
      <ItemRow
        testID={`${testID}-item-${item.id}`}
        title={item.title}
        description={item.description}
        leftAdornment={item.leftAdornment}
        rightAdornment={item.rightAdornment}
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
