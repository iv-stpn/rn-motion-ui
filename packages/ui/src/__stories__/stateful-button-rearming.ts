// Shared machinery for the StatefulButton re-arm stories. Split out of
// stateful-button.stories.tsx so the heavy geometry check doesn't bury the
// stories themselves; Storybook's test transform requires stories to be defined
// in the .stories file, so the four thin story objects stay there and import
// `checkRearming`/`REARMING_ARGS` back in.
//
// The re-arm stories pin the icon-exit fix: on re-arm (terminal → idle) the
// exiting state icon keeps its fade but drops its width and gap, so the button
// and its label must hold their geometry. Each runs the machine twice — once to
// its terminal state and back, once more to prove the re-arm is repeatable.
import type { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type meta from '../components/buttons/Button/stateful-button.stories';

type Story = StoryObj<typeof meta>;

function idleGeometry(button: HTMLElement) {
  // The first label is the in-flow sizer, not the rolling decorative copy.
  const label = within(button).getAllByText(SUBMIT_LABEL)[0];
  if (!label) throw new Error('Missing idle label');
  const rect = button.getBoundingClientRect();
  const scale = rect.width / button.offsetWidth;
  return { width: button.offsetWidth, labelX: (label.getBoundingClientRect().x - rect.x) / scale };
}

// The idle button's label text. Shared with the non-re-arm stories that also
// read the "Submit" sizer, so the geometry check and those plays agree on it.
export const SUBMIT_LABEL = 'Submit';

// Runs the machine twice and asserts the re-arm (terminal → idle) never resizes
// the button or shifts its label: the exiting state icon keeps its fade but
// drops its width/gap, so presence must not alter the plate's geometry.
export const checkRearming: NonNullable<Story['play']> = async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  const button = await canvas.findByRole('button');
  await document.fonts.ready;
  // Baseline before the trigger: sampling the first animation frame is too late.
  const idle = idleGeometry(button);

  const checkRun = async (run: number) => {
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'true'));
    await waitFor(() => expect(args.afterReset).toHaveBeenCalledTimes(run));
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled', 'true'));

    // Presence must keep the icon alive for its fade, but not its width or gap.
    // With an idle icon, both the exiting state icon and incoming arrow coexist.
    const icons = button.querySelectorAll('[aria-live="polite"] svg');
    await expect(icons.length).toBe(args.icon ? 2 : 1);
    const exitingSlot = icons[0]?.parentElement;
    if (!exitingSlot) throw new Error('Missing exiting state icon');
    await expect(getComputedStyle(exitingSlot).position).toBe('absolute');

    const frames: ReturnType<typeof idleGeometry>[] = [];
    await new Promise<void>((resolve) => {
      const started = performance.now();
      const sample = () => {
        frames.push(idleGeometry(button));
        if (performance.now() - started < 500) requestAnimationFrame(sample);
        else resolve();
      };
      sample();
    });
    // Check the whole exit, not just its settled endpoint: the old slot caused
    // a 24px overshoot for ~400ms, then snapped when the icon finally unmounted.
    await expect(Math.max(...frames.map((frame) => Math.abs(frame.width - idle.width)))).toBeLessThan(1);
    await expect(Math.max(...frames.map((frame) => Math.abs(frame.labelX - idle.labelX)))).toBeLessThan(1);
    await waitFor(() => expect(button.querySelectorAll('[aria-live="polite"] svg').length).toBe(args.icon ? 1 : 0));
  };
  await checkRun(1);
  await checkRun(2);
  await expect(args.onPress).toHaveBeenCalledTimes(2);
};

export const REARMING_ARGS = {
  afterReset: fn(),
  minLoadingMs: 100,
  successDurationMs: 650,
  errorDurationMs: 650,
  shouldAutoReset: true,
};
