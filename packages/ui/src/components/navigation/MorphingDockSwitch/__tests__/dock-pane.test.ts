import { describe, expect, it } from 'vitest';
import { resolveDockPane } from '../dock-pane';

const BASE = {
  x: 150,
  y: 600,
  closedHeight: 50,
  naturalHeight: 800,
  desiredWidth: 300,
  viewportWidth: 390,
  viewportHeight: 700,
  insetTop: 44,
  insetBottom: 34,
};
describe('dock pane bounds', () => {
  it('opens upward and scrolls rather than overflowing a short viewport', () => {
    const pane = resolveDockPane(BASE);
    expect(pane.openAbove).toBe(true);
    expect(BASE.y + BASE.closedHeight - pane.height).toBe(52);
    expect(BASE.x + pane.offsetX + pane.width).toBe(382);
  });
  it('caps a wide panel without shrinking the dock destinations', () => {
    const pane = resolveDockPane({ ...BASE, desiredWidth: 700 });
    expect(pane.width).toBe(374);
  });
  it('opens down when there is room', () => {
    const pane = resolveDockPane({ ...BASE, y: 100, naturalHeight: 200 });
    expect(pane.openAbove).toBe(false);
    expect(pane.height).toBe(200);
  });
});
