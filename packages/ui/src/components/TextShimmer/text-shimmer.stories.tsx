import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { useMountEffect } from '../../hooks/use-mount-effect';
import { Text } from '../Text/text';
import { TextShimmer } from './text-shimmer';

const meta = {
  title: 'Components/TextShimmer',
  component: TextShimmer,
  parameters: { layout: 'centered' },
  args: {
    children: 'Loading projects…',
    duration: 2.5,
    className: 'text-2xl font-semibold text-foreground',
  },
  argTypes: {
    duration: { control: { type: 'range', min: 0.5, max: 5, step: 0.25 } },
  },
} satisfies Meta<typeof TextShimmer>;

type Story = StoryObj<typeof meta>;

// Mirrors text-animation.preview.tsx: swap between two shimmer strings on a timer.
const PHRASES = ['Loading with shimmer', 'Almost there…'];
const DEFAULT_LABEL = 'default';
const FASTER_LABEL = 'faster';
const FASTER_TEXT = 'Faster shimmer';

export default meta;

export const AllVariants: Story = {
  name: 'All variants',
  render: (args) => (
    <View style={{ gap: 24, alignItems: 'flex-start' }}>
      <View style={{ gap: 8, alignItems: 'flex-start' }}>
        <Text className="text-muted-foreground text-xs">{DEFAULT_LABEL}</Text>
        <TextShimmer {...args} />
      </View>
      <View style={{ gap: 8, alignItems: 'flex-start' }}>
        <Text className="text-muted-foreground text-xs">{FASTER_LABEL}</Text>
        <TextShimmer {...args} duration={1.5}>
          {FASTER_TEXT}
        </TextShimmer>
      </View>
    </View>
  ),
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText('Loading projects…')).toBeInTheDocument();
  },
};

export const Faster: Story = {
  args: { children: 'Faster shimmer', duration: 1.5, className: 'text-sm text-foreground' },
};

export const Swapping: Story = {
  render: (args) => {
    const [i, setI] = useState(0);
    useMountEffect(() => {
      const id = setInterval(() => setI((c) => (c + 1) % PHRASES.length), 3000);
      return () => clearInterval(id);
    });
    return (
      <View style={{ minHeight: 40, alignItems: 'center', justifyContent: 'center' }}>
        <TextShimmer {...args} duration={1.8}>
          {PHRASES[i] ?? PHRASES[0]}
        </TextShimmer>
      </View>
    );
  },
};
