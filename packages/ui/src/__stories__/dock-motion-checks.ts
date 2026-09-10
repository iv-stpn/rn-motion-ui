import { expect, waitFor } from 'storybook/test';

export async function expectDockAlignment(pill: HTMLElement, item: HTMLElement) {
  await waitFor(() => {
    const a = pill.getBoundingClientRect();
    const b = item.getBoundingClientRect();
    for (const key of ['x', 'y', 'width', 'height'] as const)
      expect(
        Math.abs(a[key] - b[key]),
        `${item.getAttribute('aria-label')}: ${key}, pill=${a[key]}, item=${b[key]}`,
      ).toBeLessThan(1.1);
  });
}

/** Sample relative coordinates so a centered/bottom-anchored host cannot hide a snap. */
export async function checkDockLabelMotion(shell: HTMLElement, item: HTMLElement, toggle: HTMLElement) {
  const compact = shell.getBoundingClientRect();
  const caption = item.querySelector('[aria-hidden="true"]');
  const frames: { width: number; itemWidth: number; x: number }[] = [];
  const start = performance.now();
  const sample = () => {
    const a = shell.getBoundingClientRect();
    const b = item.getBoundingClientRect();
    frames.push({ width: a.width, itemWidth: b.width, x: b.x - a.x });
    if (performance.now() - start < 650) requestAnimationFrame(sample);
  };
  sample();
  toggle.click();
  await new Promise((resolve) => setTimeout(resolve, 700));
  const labelled = shell.getBoundingClientRect();
  expect(labelled.width / compact.width).toBeGreaterThan(1.12);
  expect(labelled.width / compact.width).toBeLessThan(1.23);
  expect(labelled.height).toBeGreaterThan(compact.height);
  expect(frames.some((frame) => frame.width > compact.width + 1 && frame.width < labelled.width - 1)).toBe(true);
  const first = frames[0];
  const last = frames.at(-1);
  if (!(first && last && caption)) throw new Error('Dock motion samples or caption are missing');
  // Items must not jump to the endpoint while the shell is still compact.
  for (const frame of frames.filter((value) => value.width < compact.width + 0.5)) {
    expect(Math.abs(frame.x - first.x)).toBeLessThan(1.1);
    expect(Math.abs(frame.itemWidth - first.itemWidth)).toBeLessThan(1.1);
  }
  expect(last.itemWidth).toBeGreaterThan(first.itemWidth);
  expect(item.querySelector('[aria-hidden="true"]')).toBe(caption);
  expect(caption).not.toBeNull();
  expect(Number(getComputedStyle(caption).opacity)).toBeGreaterThan(0.49);
  // Reverse before the spring settles; the same content and pill must survive.
  toggle.click();
  await new Promise((resolve) => setTimeout(resolve, 60));
  toggle.click();
  await new Promise((resolve) => setTimeout(resolve, 60));
  toggle.click();
  await waitFor(() => expect(Math.abs(shell.getBoundingClientRect().width - compact.width)).toBeLessThan(1));
  await waitFor(() => expect(Number(getComputedStyle(caption).opacity)).toBeLessThan(0.01));
  expect(item.querySelector('[aria-hidden="true"]')).toBe(caption);
}
