import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ArrowRight } from '../../lib/icons';
import { StatefulButton } from './stateful-button';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const meta = {
  title: 'Components/StatefulButton',
  component: StatefulButton,
  parameters: { layout: 'centered' },
  args: { children: 'Submit', onPress: fn(() => Promise.resolve()) },
  argTypes: {
    state: { control: 'select', options: ['idle', 'loading', 'success', 'error'] },
  },
} satisfies Meta<typeof StatefulButton>;

type Story = StoryObj<typeof meta>;

const SUBMIT_LABEL = 'Submit';

export default meta;

export const Idle: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalled();
  },
};

/** Press to run a 1.2 s action that resolves — loading dots, then “Done”,
 *  held disabled (the default, so a navigation callback can't be double-fired). */
export const AsyncSuccess: Story = {
  args: { onPress: fn(() => sleep(1200)) },
};

/** Press to run a 1.2 s action that rejects — loading dots, then “Try again”.
 *  `autoReset` re-arms the button after the error window so it can be retried. */
export const AsyncError: Story = {
  args: {
    onPress: fn(async () => {
      await sleep(1200);
      throw new Error('Upload failed');
    }),
    autoReset: true,
  },
};

/** `autoReset` returns the button to idle once the success window ends. */
export const AsyncAutoReset: Story = {
  args: { onPress: fn(() => sleep(1200)), autoReset: true },
};

/** Full machine run: press → action → success window → afterSuccess, with the
 *  button held disabled the whole way so the action can't be double-fired. */
export const MachineSuccess: Story = {
  args: {
    onPress: fn(() => Promise.resolve()),
    afterSuccess: fn(),
    minLoadingMs: 50,
    successDurationMs: 100,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(args.afterSuccess).toHaveBeenCalledTimes(1));
    // Terminal hold: still disabled after the window — RNW also renders
    // pointer-events:none, so the action can't be double-fired.
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

/** Rejection path: afterError receives the rejection, then autoReset re-arms
 *  the button so a second press runs the action again. */
export const MachineError: Story = {
  args: {
    onPress: fn(() => Promise.reject(new Error('nope'))),
    afterError: fn(),
    minLoadingMs: 50,
    errorDurationMs: 100,
    autoReset: true,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await waitFor(() => expect(args.afterError).toHaveBeenCalledTimes(1));
    await expect(args.afterError).toHaveBeenCalledWith(expect.any(Error));
    // autoReset re-arms the button: RNW drops aria-disabled once re-enabled.
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled', 'true'));
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalledTimes(2);
  },
};

// --- controlled mode: an explicit `state` bypasses the machine ---

export const Loading: Story = { args: { state: 'loading' } };
export const Success: Story = { args: { state: 'success' } };
export const Failed: Story = { args: { state: 'error' } };

/** Custom labels for each state transition. */
export const CustomLabels: Story = {
  args: {
    state: 'loading',
    loadingText: 'Uploading…',
    successText: 'Uploaded!',
    errorText: 'Upload failed',
    children: 'Upload',
  },
};

/** Icon shown on the right in the idle state via the `icon` prop. */
export const WithIcon: Story = {
  args: {
    icon: <ArrowRight size={16} color="#fafafa" />,
    children: 'Continue',
  },
};

/** All four states displayed side-by-side for visual comparison. */
export const AllStates: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <StatefulButton {...args} state="idle">
        {SUBMIT_LABEL}
      </StatefulButton>
      <StatefulButton {...args} state="loading">
        {SUBMIT_LABEL}
      </StatefulButton>
      <StatefulButton {...args} state="success">
        {SUBMIT_LABEL}
      </StatefulButton>
      <StatefulButton {...args} state="error">
        {SUBMIT_LABEL}
      </StatefulButton>
    </View>
  ),
};
