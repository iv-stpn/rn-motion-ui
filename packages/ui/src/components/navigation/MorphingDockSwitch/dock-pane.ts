type DockPaneInput = {
  x: number;
  y: number;
  closedHeight: number;
  naturalHeight: number;
  desiredWidth: number;
  viewportWidth: number;
  viewportHeight: number;
  insetTop: number;
  insetBottom: number;
};
/** Keep a long switcher reachable without changing its resting dock footprint. */
export function resolveDockPane(input: DockPaneInput) {
  const padding = 8;
  const top = input.insetTop + padding;
  const bottom = input.viewportHeight - input.insetBottom - padding;
  const below = Math.max(0, bottom - input.y);
  const above = Math.max(0, input.y + input.closedHeight - top);
  const openAbove = input.naturalHeight > below && above > below;
  const height = Math.min(input.naturalHeight, openAbove ? above : below);
  const width = Math.min(input.desiredWidth, Math.max(0, input.viewportWidth - padding * 2));
  const left = Math.max(padding, Math.min(input.x, input.viewportWidth - padding - width));
  return { height, width, openAbove, offsetX: left - input.x };
}
