/**
 * hover-menu-geometry — the pure panel-positioning math for HoverMenu.
 *
 * `computePanelLayout` decides where the floating panel goes: it clamps the panel
 * to the viewport (with a small margin), aligns it to the trigger's start or end
 * edge, and flips it above the trigger when it wouldn't fit below. Pulled out of
 * the component so the geometry is unit-testable and the render stays readable.
 * The slide direction that follows from `openAbove` is `resolveMenuMotion`'s job
 * (theme/motion.ts).
 */

/** Trigger-width fallback used while the trigger has not been measured. */
export const DEFAULT_WIDTH = 200;

/** Minimum gap, in px, between the panel and each viewport edge. */
export const VIEWPORT_PADDING = 8;

export type Rect = { x: number; y: number; w: number; h: number };
export type PanelSize = { w: number; h: number };

export type PanelLayout = { left: number; top: number; openAbove: boolean; panelWidth: number; measured: boolean };

export type ComputePanelLayoutOptions = {
  rect: Rect | null;
  panelSize: PanelSize;
  viewportWidth: number;
  viewportHeight: number;
  align: 'start' | 'end';
  offset: number;
  width: number | 'trigger';
};

/**
 * The floating panel's resolved position. `measured` is false until both the
 * trigger rect and the panel size are known, so the caller can hold the panel at
 * opacity 0 rather than painting it at an unresolved spot.
 */
export function computePanelLayout(options: ComputePanelLayoutOptions): PanelLayout {
  const { rect, panelSize, viewportWidth, viewportHeight, align, offset, width } = options;
  const triggerWidth = rect === null ? DEFAULT_WIDTH : rect.w;
  const panelWidth = width === 'trigger' ? triggerWidth : width;
  const panelH = panelSize.h;
  const measured = rect !== null && panelSize.w > 0 && panelSize.h > 0;

  let left = 0;
  let top = 0;
  let openAbove = false;
  if (rect) {
    const anchoredLeft = align === 'end' ? rect.x + rect.w - panelWidth : rect.x;
    const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - panelWidth - VIEWPORT_PADDING);
    left = Math.min(Math.max(anchoredLeft, VIEWPORT_PADDING), maxLeft);
    const spaceBelow = viewportHeight - (rect.y + rect.h) - offset - VIEWPORT_PADDING;
    const spaceAbove = rect.y - offset - VIEWPORT_PADDING;
    openAbove = panelH > 0 && panelH > spaceBelow && spaceAbove > spaceBelow;
    const rawTop = openAbove ? rect.y - offset - panelH : rect.y + rect.h + offset;
    const maxTop = Math.max(VIEWPORT_PADDING, viewportHeight - panelH - VIEWPORT_PADDING);
    top = Math.min(Math.max(rawTop, VIEWPORT_PADDING), maxTop);
  }

  return { left, top, openAbove, panelWidth, measured };
}
