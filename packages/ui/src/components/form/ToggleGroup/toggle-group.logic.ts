/**
 * toggle-group.logic — the pure selection/shape semantics for ToggleGroup,
 * kept out of the component so the divider-suppression rule and the shape→radius
 * map are unit-testable. Data only, no React.
 */

/** Item and text size — the same four-step ramp the button family uses. */
export type ToggleGroupSize = 'xs' | 'sm' | 'md' | 'lg';

/** Corner shape of the segmented control's outer edges. */
export type ToggleGroupShape = 'square' | 'rounded' | 'pill' | 'circle';

/**
 * Corner radius per shape — `rounded` uses the interactive token, `pill` and
 * `circle` are fully-rounded (the circle's roundness coming from equal fixed
 * dimensions rather than the radius alone).
 */
export const SHAPE_RADIUS: Record<ToggleGroupShape, string> = {
  square: 'rounded-none',
  rounded: 'rounded-interactive',
  pill: 'rounded-full',
  circle: 'rounded-full',
};

/**
 * Whether the divider drawn *after* the item at `index` is suppressed.
 *
 * A divider adjacent to the selected item is dropped so the selection reads as
 * one continuous surface with its neighbours — the selected item's own trailing
 * divider (`index === selectedIdx`) and the trailing divider of the item
 * immediately before it (`index === selectedIdx - 1`) both go. `connected` mode
 * has no internal dividers at all, so every index suppresses. When nothing is
 * selected (`selectedIdx === -1`) all dividers stay.
 */
export function shouldSuppressDivider(index: number, selectedIdx: number, isConnected: boolean): boolean {
  if (isConnected) return true;
  return selectedIdx !== -1 && (index === selectedIdx || index === selectedIdx - 1);
}
