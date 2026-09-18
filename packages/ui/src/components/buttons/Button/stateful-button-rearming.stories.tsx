import type { Meta, StoryObj } from '@storybook/react';
import { ArrowRightLine } from 'rn-motion-ui-icons/icons/arrow-right-line';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { StatefulButton } from './stateful-button';

const meta = {
  title: 'Buttons/StatefulButton/Rearming',
  component: StatefulButton,
  parameters: { layout: 'centered' },
  args: {
    children: 'Submit',
    onPress: fn(() => Promise.resolve()),
    afterReset: fn(),
    minLoadingMs: 100,
    successDurationMs: 650,
    errorDurationMs: 650,
    shouldAutoReset: true,
  },
} satisfies Meta<typeof StatefulButton>;

type Story = StoryObj<typeof meta>;

function idleGeometry(button: HTMLElement) {
  // The first label is the in-flow sizer, not the rolling decorative copy.
  const label = within(button).getAllByText('Submit')[0];
  if (!label) throw new Error('Missing idle label');
  const rect = button.getBoundingClientRect();
  const scale = rect.width / button.offsetWidth;
  return { width: button.offsetWidth, labelX: (label.getBoundingClientRect().x - rect.x) / scale };
}

const checkRearming: NonNullable<Story['play']> = async ({ canvasElement, args }) => {
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

export default meta;

export const Success: Story = { play: checkRearming };

export const Rejection: Story = {
  args: { onPress: fn(() => Promise.reject(new Error('Try again'))) },
  play: checkRearming,
};

export const WithIdleIcon: Story = {
  args: { icon: <ArrowRightLine size={19} /> },
  play: checkRearming,
};

export const Elevated: Story = {
  args: { chip: 'elevated' },
  play: checkRearming,
};
