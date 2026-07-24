import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Text } from '../Text/text';
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
const WORDS_LABEL = 'word split';
const CHARS_LABEL = 'char split';
const MULTILINE_LABEL = 'multi-line';

export default meta;

export const AllVariants: Story = {
  name: 'All variants',
  render: (args) => (
    <View style={{ gap: 32, alignItems: 'flex-start' }}>
      <View style={{ gap: 8, alignItems: 'flex-start' }}>
        <Text className="text-muted-foreground text-xs">{WORDS_LABEL}</Text>
        <TextReveal {...args} />
      </View>
      <View style={{ gap: 8, alignItems: 'flex-start' }}>
        <Text className="text-muted-foreground text-xs">{CHARS_LABEL}</Text>
        <TextReveal {...args} text="considered." split="char" stagger={0.04} />
      </View>
      <View style={{ gap: 8, alignItems: 'flex-start' }}>
        <Text className="text-muted-foreground text-xs">{MULTILINE_LABEL}</Text>
        <TextReveal {...args} text={['Motion that feels', 'considered.']} />
      </View>
    </View>
  ),
};

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
          className="h-9 items-center justify-center rounded-full border border-border bg-surface-3 px-4"
        >
          <Text className="font-medium text-foreground text-xs">{REPLAY_LABEL}</Text>
        </Pressable>
      </View>
    );
  },
};
