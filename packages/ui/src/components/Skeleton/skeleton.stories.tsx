import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { Skeleton } from './skeleton';

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  parameters: { layout: 'centered' },
  args: { shape: 'rounded', speed: 2 },
  argTypes: {
    shape: { control: 'select', options: ['rounded', 'circle', 'square'] },
    speed: { control: { type: 'range', min: 0.5, max: 4, step: 0.25 } },
  },
} satisfies Meta<typeof Skeleton>;

type Story = StoryObj<typeof meta>;

const LINE_WIDTH = 240;

export default meta;

export const Default: Story = {
  render: (args) => (
    <View style={{ width: LINE_WIDTH }}>
      <Skeleton {...args} className="h-4 w-full" />
    </View>
  ),
};

export const Shapes: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'column', gap: 12, width: LINE_WIDTH }}>
      <Skeleton {...args} shape="rounded" className="h-4 w-full" />
      <Skeleton {...args} shape="square" className="h-4 w-full" />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Skeleton {...args} shape="circle" className="h-10 w-10" />
        <Skeleton {...args} shape="circle" className="h-10 w-10" />
      </View>
    </View>
  ),
};

export const TextBlock: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'column', gap: 8, width: LINE_WIDTH }}>
      <Skeleton {...args} className="h-4 w-full" />
      <Skeleton {...args} className="h-4 w-full" />
      <Skeleton {...args} className="h-4 w-3/4" />
    </View>
  ),
};

export const ProfileCard: Story = {
  render: (args) => (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12, width: LINE_WIDTH }}>
      <Skeleton {...args} shape="circle" className="h-12 w-12" />
      <View style={{ flex: 1, flexDirection: 'column', gap: 8 }}>
        <Skeleton {...args} className="h-4 w-1/2" />
        <Skeleton {...args} className="h-3 w-3/4" />
      </View>
    </View>
  ),
};
