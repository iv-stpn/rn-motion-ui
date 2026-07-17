import { useMountEffect } from '@rn-motion-ui/hooks/use-mount-effect';
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { TextCascade } from './text-cascade';

const meta = {
  title: 'Components/TextCascade',
  component: TextCascade,
  parameters: { layout: 'centered' },
  args: {
    text: 'Install skills',
    className: 'text-lg font-medium text-foreground',
  },
} satisfies Meta<typeof TextCascade>;

type Story = StoryObj<typeof meta>;

const PHRASES = ['Install skills', 'Open settings', 'Ship updates'];

export default meta;

/** Cycles the label every few seconds so the letter-by-letter roll is visible. */
export const Cycling: Story = {
  render: (args) => {
    const [phrase, setPhrase] = useState(0);
    useMountEffect(() => {
      const id = setInterval(() => setPhrase((p) => (p + 1) % PHRASES.length), 2400);
      return () => clearInterval(id);
    });
    const current = PHRASES[phrase % PHRASES.length] ?? 'Install skills';
    return (
      <View style={{ minWidth: 200, alignItems: 'center' }}>
        <TextCascade {...args} text={current} />
      </View>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The current phrase is exposed as the accessible label.
    await expect(await canvas.findByLabelText('Install skills')).toBeInTheDocument();
  },
};
