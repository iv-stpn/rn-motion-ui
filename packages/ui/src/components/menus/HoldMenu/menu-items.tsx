import { memo } from 'react';
import { menuItemsEqual } from './hold-menu-layout';
import type { MenuItemProps } from './hold-menu-types';
import { MenuItem } from './menu-item';

type MenuItemsComponentProps = {
  items: MenuItemProps[];
  /** Base testID of the item that opened the menu, forwarded to each row. */
  testID?: string;
};

/**
 * The row list — upstream's `MenuItems`. Memoized with a field-level
 * comparator so the panel does not re-render every row when the item list
 * crosses the shared value boundary with a new array identity.
 */
const MenuItemsComponent = ({ items, testID }: MenuItemsComponentProps) => (
  <>
    {items.map((item: MenuItemProps, index: number) => (
      <MenuItem key={item.text} item={item} isLast={items.length === index + 1} testID={testID} />
    ))}
  </>
);

export const MenuItems = memo(
  MenuItemsComponent,
  (prev, next) => prev.testID === next.testID && menuItemsEqual(prev.items, next.items),
);
