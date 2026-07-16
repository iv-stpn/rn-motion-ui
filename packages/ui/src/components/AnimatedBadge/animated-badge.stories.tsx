import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { AnimatedBadge, type AnimatedBadgeStatus } from './animated-badge';

const meta = {
  title: 'Components/AnimatedBadge',
  component: AnimatedBadge,
  parameters: { layout: 'centered' },
  args: { children: 'Synced', status: 'success', size: 'md', showIcon: true },
  argTypes: {
    status: { control: 'select', options: ['neutral', 'info', 'success', 'warning', 'danger', 'loading'] },
    size: { control: 'select', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof AnimatedBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Synced')).toBeInTheDocument();
  },
};

export const Loading: Story = { args: { status: 'loading', children: 'Syncing' } };
export const Danger: Story = { args: { status: 'danger', children: 'Failed' } };

export const AllStatuses: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxWidth: 320, justifyContent: 'center' }}>
      <AnimatedBadge {...args} status="neutral" size="sm">
        Queued
      </AnimatedBadge>
      <AnimatedBadge {...args} status="info" size="sm">
        Live
      </AnimatedBadge>
      <AnimatedBadge {...args} status="loading" size="sm">
        Indexing
      </AnimatedBadge>
      <AnimatedBadge {...args} status="success" size="sm">
        Verified
      </AnimatedBadge>
      <AnimatedBadge {...args} status="warning" size="sm">
        Pending
      </AnimatedBadge>
      <AnimatedBadge {...args} status="danger" size="sm">
        Blocked
      </AnimatedBadge>
    </View>
  ),
};

const CYCLE: Array<{ status: AnimatedBadgeStatus; label: string }> = [
  { status: 'loading', label: 'Syncing' },
  { status: 'success', label: 'Synced' },
  { status: 'warning', label: 'Review' },
  { status: 'danger', label: 'Failed' },
];

export const Cycling: Story = {
  render: () => {
    const [i, setI] = useState(0);
    useEffect(() => {
      const id = setInterval(() => setI((c) => (c + 1) % CYCLE.length), 1600);
      return () => clearInterval(id);
    }, []);
    const state = CYCLE[i] ?? { status: 'loading' as const, label: 'Syncing' };
    return (
      <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
        <AnimatedBadge status={state.status}>{state.label}</AnimatedBadge>
      </View>
    );
  },
};
