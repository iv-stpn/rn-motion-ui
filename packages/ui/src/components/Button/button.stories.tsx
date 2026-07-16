import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ArrowRight, Download, Trash2 } from '../../lib/icons';
import { Button } from './button';
import { type ButtonState, StatefulButton } from './stateful-button';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Continue', variant: 'primary', size: 'md', onPress: fn() },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'outline'] },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalled();
  },
};

export const Secondary: Story = { args: { variant: 'secondary', children: 'Download' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'Ghost' } };
export const Outline: Story = { args: { variant: 'outline', children: 'Outline' } };
export const Loading: Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Ripple: Story = { args: { ripple: true, children: 'Tap me' } };

export const Sizes: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </View>
  ),
};

export const WithIcons: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Button {...args} variant="primary">
        Continue
        <ArrowRight size={16} color="#fafafa" />
      </Button>
      <Button {...args} variant="secondary">
        <Download size={16} color="#111111" />
        Download
      </Button>
      <Button {...args} variant="secondary" size="icon" accessibilityLabel="Delete">
        <Trash2 size={16} color="#111111" />
      </Button>
    </View>
  ),
};

// ─── StatefulButton ──────────────────────────────────────────────────────────
// StatefulButton wraps Button with idle → loading → success/error transitions.

type StatefulStory = StoryObj<typeof StatefulButton>;

const statefulArgs = { children: 'Submit', state: 'idle', onPress: fn() } as const;

export const StatefulIdle: StatefulStory = {
  args: statefulArgs,
  render: (args) => <StatefulButton {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalled();
  },
};

export const StatefulLoading: StatefulStory = {
  args: { ...statefulArgs, state: 'loading' },
  render: (args) => <StatefulButton {...args} />,
};

export const StatefulSuccess: StatefulStory = {
  args: { ...statefulArgs, state: 'success' },
  render: (args) => <StatefulButton {...args} />,
};

export const StatefulFailed: StatefulStory = {
  args: { ...statefulArgs, state: 'error' },
  render: (args) => <StatefulButton {...args} />,
};

/** Custom labels for each state transition. */
export const StatefulCustomLabels: StatefulStory = {
  args: {
    ...statefulArgs,
    state: 'loading',
    loadingText: 'Uploading…',
    successText: 'Uploaded!',
    errorText: 'Upload failed',
    children: 'Upload',
  },
  render: (args) => <StatefulButton {...args} />,
};

/** Icon shown on the right in the idle state via the `icon` prop. */
export const StatefulWithIcon: StatefulStory = {
  args: {
    ...statefulArgs,
    icon: <ArrowRight size={16} color="#fafafa" />,
    children: 'Continue',
  },
  render: (args) => <StatefulButton {...args} />,
};

/** All four states displayed side-by-side for visual comparison. */
export const StatefulAllStates: StatefulStory = {
  args: statefulArgs,
  render: (args) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <StatefulButton {...args} state="idle">
        Submit
      </StatefulButton>
      <StatefulButton {...args} state="loading">
        Submit
      </StatefulButton>
      <StatefulButton {...args} state="success">
        Submit
      </StatefulButton>
      <StatefulButton {...args} state="error">
        Submit
      </StatefulButton>
    </View>
  ),
};

/** Click to watch idle → loading → success → idle. */
export const StatefulInteractiveSuccess: StatefulStory = {
  args: statefulArgs,
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
export const StatefulInteractiveError: StatefulStory = {
  args: statefulArgs,
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
