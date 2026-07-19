import { useMountEffect } from '@rn-motion-ui/hooks/use-mount-effect';
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { TextRolling } from './text-rolling';

const meta = {
  title: 'Components/TextRolling',
  component: TextRolling,
  parameters: { layout: 'centered' },
  args: {
    text: 'Uploading',
    direction: 'forward',
    className: 'text-lg font-medium text-foreground',
  },
  argTypes: {
    direction: { control: 'radio', options: ['up', 'down'] },
  },
} satisfies Meta<typeof TextRolling>;

type Story = StoryObj<typeof meta>;

const STATUSES = ['Uploading', 'Processing', 'Almost done', 'Complete'];

export default meta;

/** Cycles the label every couple of seconds so the whole-text roll is visible. */
export const Cycling: Story = {
  render: (args) => {
    const [index, setIndex] = useState(0);
    useMountEffect(() => {
      const id = setInterval(() => setIndex((i) => (i + 1) % STATUSES.length), 2000);
      return () => clearInterval(id);
    });
    const current = STATUSES[index % STATUSES.length] ?? 'Uploading';
    return (
      <View style={{ minWidth: 160, alignItems: 'center' }}>
        <TextRolling {...args} text={current} />
      </View>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText('Uploading')).toBeInTheDocument();
  },
};

/** Rolls downward — new label enters from above, old exits to the bottom. */
export const RollDown: Story = {
  render: (args) => {
    const [index, setIndex] = useState(0);
    useMountEffect(() => {
      const id = setInterval(() => setIndex((i) => (i + 1) % STATUSES.length), 2000);
      return () => clearInterval(id);
    });
    const current = STATUSES[index % STATUSES.length] ?? 'Uploading';
    return (
      <View style={{ minWidth: 160, alignItems: 'center' }}>
        <TextRolling {...args} text={current} direction="backward" />
      </View>
    );
  },
};
