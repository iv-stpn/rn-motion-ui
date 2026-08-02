/**
 * Placement side of `HoldContextMenu`: turns the item's measured rect into panel
 * coordinates, and reconciles the estimated panel height with the measured one.
 *
 * The math itself lives in `hold-context-menu-layout.ts`, which is React-free and
 * unit-tested. This is the hook that feeds it the window, the insets and a height
 * for a panel that has not been laid out yet.
 */

import { useCallback, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeInsets } from '../../../hooks/use-safe-insets';
import {
  estimateHoldMenuHeight,
  type HoldMenuAlign,
  type HoldMenuLayout,
  type HoldMenuRect,
  type HoldMenuSide,
  resolveHoldMenuLayout,
} from './hold-context-menu-layout';
import type { HoldContextMenuItem } from './hold-context-menu-row';

export type UseHoldMenuLayoutOptions = {
  items: readonly HoldContextMenuItem[];
  /** Measured window rect of the held item — `null` until the first activation. */
  rect: HoldMenuRect | null;
  side: HoldMenuSide;
  align: HoldMenuAlign;
  menuWidth: number;
  disableMove: boolean;
};

export type HoldMenuPlacement = {
  /** `null` while there is nothing measured to anchor to. */
  layout: HoldMenuLayout | null;
  /** The height the layout was resolved from — the panel uses it to decide whether to scroll. */
  menuHeight: number;
  /** Hand the panel's real height back once it has been laid out. */
  onMenuHeight: (height: number) => void;
  /** Drop the measurement once the overlay has left, so the next open starts from the estimate. */
  resetMenuHeight: () => void;
};

export function useHoldMenuLayout({
  items,
  rect,
  side,
  align,
  menuWidth,
  disableMove,
}: UseHoldMenuLayoutOptions): HoldMenuPlacement {
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const insets = useSafeInsets();

  // The panel is placed on the frame it opens, before `onLayout` can report
  // anything, so the estimate goes first and the measurement corrects it.
  // Corrections only ever grow the height: a measured height is already clamped
  // by the `maxHeight` it was given, so feeding a shrunken one back in would
  // resolve a smaller layout, which clamps harder, which shrinks it again.
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const estimatedHeight = useMemo(() => estimateHoldMenuHeight(items), [items]);
  const menuHeight = Math.max(estimatedHeight, measuredHeight);

  const onMenuHeight = useCallback((height: number) => {
    setMeasuredHeight((previous) => (height > previous ? height : previous));
  }, []);

  const resetMenuHeight = useCallback(() => setMeasuredHeight(0), []);

  const layout = useMemo(() => {
    if (!rect) return null;
    return resolveHoldMenuLayout({
      align,
      disableMove,
      insets,
      item: rect,
      menuHeight,
      menuWidth,
      side,
      viewport: { height: viewportHeight, width: viewportWidth },
    });
  }, [align, disableMove, insets, menuHeight, menuWidth, rect, side, viewportHeight, viewportWidth]);

  return { layout, menuHeight, onMenuHeight, resetMenuHeight };
}
