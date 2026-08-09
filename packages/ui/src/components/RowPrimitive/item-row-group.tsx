// biome-ignore-all lint/style/useExportsLast: the entry types head the module so the implementations below read against them
import { Fragment } from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '../../lib/cn';
import type { ItemRowSize } from './item-row';
import { ItemRow } from './item-row';
import { RowGroupContainer, type RowGroupItemBase, type RowGroupVariant } from './row-group';

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
    const row = (
      <ItemRow
        testID={`${testID}-item-${item.id}`}
        title={item.title}
        description={item.description}
        leftAdornment={item.leftAdornment}
        rightAdornment={item.rightAdornment}
        disabled={item.disabled}
        size={size}
        variant="default"
        className={
          variant === 'grouped'
            ? cn(
                index === 0 && 'rounded-b-none',
                index === lastIndex && 'rounded-t-none',
                index > 0 && index < lastIndex && 'rounded-none',
                !isLast && 'border-border border-b',
              )
            : undefined
        }
      />
    );

    if (variant === 'sections' && !isLast)
      return (
        <Fragment key={item.id}>
          {row}
          <View className="h-px bg-border" />
        </Fragment>
      );

    return <Fragment key={item.id}>{row}</Fragment>;
  });

  return (
    <RowGroupContainer variant={variant} size={size} className={className} style={style} testID={testID}>
      {rows}
    </RowGroupContainer>
  );
}
