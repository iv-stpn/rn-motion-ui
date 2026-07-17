import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { expect, within } from 'storybook/test';
import { TextReveal, type TextRevealSplit } from './text-reveal';

const meta = {
  title: 'Components/TextReveal',
  component: TextReveal,
  parameters: { layout: 'centered' },
  args: {
    text: 'Motion that feels considered.',
    split: 'word',
    stagger: 0.09,
    delay: 0,
    yOffset: 24,
    once: true,
    whileInView: false,
    className: 'text-2xl font-semibold text-foreground',
  },
  argTypes: {
    split: { control: 'select', options: ['word', 'char'] satisfies TextRevealSplit[] },
    stagger: { control: { type: 'range', min: 0.01, max: 0.3, step: 0.01 } },
    yOffset: { control: { type: 'range', min: 0, max: 80, step: 4 } },
  },
} satisfies Meta<typeof TextReveal>;

type Story = StoryObj<typeof meta>;

const REPLAY_LABEL = 'Replay';

export default meta;

export const Words: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText('Motion that feels considered.')).toBeInTheDocument();
  },
};

export const Characters: Story = {
  args: { text: 'considered.', split: 'char', stagger: 0.04 },
};

export const MultiLine: Story = {
  args: {
    text: ['Motion that feels', 'considered.'],
    className: 'text-3xl font-semibold text-foreground',
  },
};

export const Replay: Story = {
  render: (args) => {
    const [key, setKey] = useState(0);
    const replay = useCallback(() => setKey((k) => k + 1), []);
    return (
      <View style={{ alignItems: 'center', gap: 24 }}>
        <TextReveal {...args} key={key} />
        <Pressable
          onPress={replay}
          accessibilityRole="button"
          className="h-9 items-center justify-center rounded-full border border-border bg-card px-4"
        >
          <Text className="font-medium text-foreground text-xs">{REPLAY_LABEL}</Text>
        </Pressable>
      </View>
    );
  },
};
