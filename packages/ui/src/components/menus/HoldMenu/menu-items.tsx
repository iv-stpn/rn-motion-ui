import { memo } from 'react';
import type { MenuItemProps } from './hold-menu-types';
import { MenuItem } from './menu-item';

type MenuItemsComponentProps = { items: MenuItemProps[] };

/**
 * The row list — upstream's `MenuItems`. Rows are memoized individually, so a
 * fresh `items` array identity (which happens every time the list crosses the
 * shared-value boundary) only re-runs this `.map`, never the rows' styles.
 */
const MenuItemsComponent = ({ items }: MenuItemsComponentProps) => (
  <>
    {items.map((item: MenuItemProps, index: number) => (
      <MenuItem key={item.text} item={item} isLast={items.length === index + 1} />
    ))}
  </>
);

export const MenuItems = memo(MenuItemsComponent);
