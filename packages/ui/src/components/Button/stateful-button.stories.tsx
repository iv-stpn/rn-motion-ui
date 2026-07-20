import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ArrowRight } from '../../lib/icons';
import { type ButtonState, StatefulButton } from './stateful-button';

const meta = {
  title: 'Components/StatefulButton',
  component: StatefulButton,
  parameters: { layout: 'centered' },
  args: { children: 'Submit', state: 'idle', onPress: fn() },
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

/** Click to watch idle → loading → success → idle. */
export const InteractiveSuccess: Story = {
  render: (args) => {
    const [state, setState] = useState<ButtonState>('idle');

    const handlePress = () => {
      if (state !== 'idle') return;
      setState('loading');
      setTimeout(() => {
        setState('success');
        setTimeout(() => setState('idle'), 1500);
      }, 1500);
    };

    return <StatefulButton {...args} state={state} onPress={handlePress} />;
  },
};

/** Click to watch idle → loading → error → idle. */
export const InteractiveError: Story = {
  render: (args) => {
    const [state, setState] = useState<ButtonState>('idle');

    const handlePress = () => {
      if (state !== 'idle') return;
      setState('loading');
      setTimeout(() => {
        setState('error');
        setTimeout(() => setState('idle'), 1500);
      }, 1500);
    };

    return <StatefulButton {...args} state={state} onPress={handlePress} />;
  },
};
