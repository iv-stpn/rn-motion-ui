import { expect, fireEvent, waitFor } from 'storybook/test';

function scaleOf(node: Element): number {
  return new DOMMatrix(getComputedStyle(node).transform).a;
}

/** The shell's LAYOUT height, with the motion host's scale divided back out.
 *  `getBoundingClientRect` reports the transformed box, so a scaled-down shell
 *  measures shorter than its own layout — comparing raw heights would read the
 *  press-scale dip as if the shell had finished collapsing. Takes the already-read
 *  scale so the two measurements stay on the same frame. */
function layoutHeight(shell: Element, scale: number): number {
  return shell.getBoundingClientRect().height / scale;
}

/** The pane's height once it has stopped changing — the settled open layout.
 *  The first sampled frame cannot stand in for it: under load the first rAF after
 *  the click can land well into the collapse, and half of an already-shrunk pane
 *  sits below the pane's own closed height, so "it actually closed" would fail for
 *  a pane that closed perfectly. Read it before the close instead. */
async function restingHeight(shell: HTMLElement): Promise<number> {
  let previous = shell.getBoundingClientRect().height;
  for (let frame = 0; frame < 240; frame += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: consecutive frames are the measurement — the height has to be seen to stop changing between two of them
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const current = shell.getBoundingClientRect().height;
    if (Math.abs(current - previous) < 0.5) return current;
    previous = current;
  }
  return previous;
}

/** Sample the actual rendered transform, not just the final React state. */
async function checkSwitcherClose(root: HTMLElement, dismiss: HTMLElement, rowValues: readonly string[]) {
  const id = root.dataset.testid;
  const motion = root.querySelector(`[data-testid="${id}-motion"]`);
  const shell = root.querySelector(`[data-testid="${id}-shell"]`);
  if (!(motion instanceof HTMLElement && shell instanceof HTMLElement)) throw new Error('Missing switcher motion hosts');
  await waitFor(() => expect(scaleOf(motion)).toBeCloseTo(1, 3));
  // The pane is settled open here, so its resting height divided by the (already
  // checked ~1) press scale is the layout height the close starts from.
  const openHeight = (await restingHeight(shell)) / scaleOf(motion);
  const frames: { time: number; scale: number; height: number; rows: number[] }[] = [];
  const start = performance.now();
  fireEvent.click(dismiss);
  await new Promise<void>((resolve) => {
    const sample = () => {
      const time = performance.now() - start;
      const scale = scaleOf(motion);
      frames.push({
        time,
        scale,
        height: layoutHeight(shell, scale),
        rows: rowValues.map((value) => {
          const row = root.querySelector(`[data-testid="${id}-row-${value}"]`);
          return row ? Number(getComputedStyle(row).opacity) : -1;
        }),
      });
      if (time < 850) requestAnimationFrame(sample);
      else resolve();
    };
    requestAnimationFrame(sample);
  });
  expect(Math.max(...frames.filter((frame) => frame.time < 150).map((frame) => frame.scale))).toBeGreaterThan(1.015);
  expect(
    frames.some((frame) => {
      const [first, last] = frame.rows;
      return first !== undefined && last !== undefined && first >= 0 && last >= 0 && Math.abs(first - last) > 0.05;
    }),
  ).toBe(true);
  // The end-of-close press bottoms out at ~0.965, and it must do so while the shell
  // is STILL collapsing (overlapping the tail of the shrink), not after it lands.
  // The dip is the global scale minimum — the anticipation peak is a maximum — and
  // it is found by value rather than by timestamp so retiming the collapse cannot
  // quietly push it out of the searched window.
  const dip = frames.reduce((min, frame) => (frame.scale < min.scale ? frame : min));
  expect(dip.scale).toBeLessThan(0.98);
  // The margin is what makes this an overlap claim rather than a float comparison:
  // measured against a settled pane the two heights agree to within noise.
  const settledHeight = frames.at(-1)?.height ?? 0;
  expect(dip.height - settledHeight).toBeGreaterThan(1);
  expect(scaleOf(motion)).toBeCloseTo(1, 3);
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.at(-1)?.height).toBeLessThan(openHeight / 2);
  // Neither scale nor the closing morph may leave an upward translate on the shell.
  expect(new DOMMatrix(getComputedStyle(shell).transform).m42).toBeCloseTo(0, 1);
}

/** The pane's content has to travel with the edge that moves, and thin out on the
 *  way down. A pane anchored upward is pinned to the dock's bottom, so its TOP edge
 *  is the travelling one: a row's offset from it must hold steady the whole way
 *  down, and the rows must still be mounted while the pane is visibly shrinking.
 *  Two regressions are pinned here. Dissolving the rows in place and only then
 *  collapsing an emptied shell fails on `ridden.length`, because the old order
 *  retired every row while the pane still stood at full height. Holding the content
 *  at full opacity for most of the drop and then blinking it out fails the fade
 *  assertions, because the content wrapper carried no opacity at all. */
async function checkContentFallsWithPane(root: HTMLElement, rowValue: string, dismiss: HTMLElement) {
  const id = root.dataset.testid;
  const shell = root.querySelector(`[data-testid="${id}-shell"]`);
  const row = root.querySelector(`[data-testid="${id}-row-${rowValue}"]`);
  const content = root.querySelector(`[data-testid="${id}-content"]`);
  if (!(shell instanceof HTMLElement)) throw new Error('Missing pane shell');
  if (!(row instanceof HTMLElement)) throw new Error('Missing pane row');
  if (!(content instanceof HTMLElement)) throw new Error('Missing pane content');
  const openHeight = await restingHeight(shell);
  const frames: { offset: number | null; height: number; opacity: number | null }[] = [];
  const start = performance.now();
  fireEvent.click(dismiss);
  await new Promise<void>((resolve) => {
    const sample = () => {
      // Both nodes are dropped when the pane swaps back to the closed control, so a
      // detached node is "it is gone", not "it is at 0" — hence nulls rather than
      // zeroes, which would otherwise read as a perfectly completed fade.
      const top = row.isConnected ? row.getBoundingClientRect().top : null;
      frames.push({
        offset: top === null ? null : top - shell.getBoundingClientRect().top,
        height: shell.getBoundingClientRect().height,
        opacity: content.isConnected ? Number(getComputedStyle(content).opacity) : null,
      });
      if (performance.now() - start < 850) requestAnimationFrame(sample);
      else resolve();
    };
    requestAnimationFrame(sample);
  });
  const ridden = frames.filter((frame) => frame.offset !== null && frame.height <= openHeight * 0.6);
  // The row is still there once the pane is most of the way closed…
  expect(ridden.length).toBeGreaterThan(0);
  // …and it came down with the pane's top edge instead of staying put.
  expect(Math.max(...ridden.map((frame) => Math.abs(frame.offset ?? 0)))).toBeLessThan(12);
  // While the pane is most of the way down the content must already be thinning.
  const falling = frames.filter((frame) => frame.opacity !== null && frame.height <= openHeight * 0.4);
  expect(falling.length).toBeGreaterThan(0);
  expect(Math.max(...falling.map((frame) => frame.opacity ?? 1))).toBeLessThan(0.9);
  // …and it must have genuinely faded before the pane retires it, rather than
  // vanishing at full strength and letting the shell finish the drop alone. This
  // reads the minimum rather than the last connected frame: sampling is sparse
  // under load, so the final frame caught before the pane swaps can legitimately
  // land mid-fade and would make a tighter threshold flaky, not stricter.
  const connected = frames.flatMap((frame) => (frame.opacity === null ? [] : [frame.opacity]));
  expect(Math.min(...connected)).toBeLessThan(0.3);
}

export { checkContentFallsWithPane, checkSwitcherClose };
