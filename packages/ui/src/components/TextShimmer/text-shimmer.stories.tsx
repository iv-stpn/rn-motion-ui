import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
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

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText('Loading projects…')).toBeInTheDocument();
  },
};

export const Faster: Story = {
  args: { children: 'Faster shimmer', duration: 1.5, className: 'text-sm text-foreground' },
};

// Mirrors text-animation.preview.tsx: swap between two shimmer strings on a timer.
const PHRASES = ['Loading with shimmer', 'Almost there…'];

export const Swapping: Story = {
  render: (args) => {
    const [i, setI] = useState(0);
    useEffect(() => {
      const id = setInterval(() => setI((c) => (c + 1) % PHRASES.length), 3000);
      return () => clearInterval(id);
    }, []);
    return (
      <View style={{ minHeight: 40, alignItems: 'center', justifyContent: 'center' }}>
        <TextShimmer {...args} duration={1.8}>
          {PHRASES[i] ?? PHRASES[0]}
        </TextShimmer>
      </View>
    );
  },
};
