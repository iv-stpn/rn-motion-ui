import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { useMountEffect } from '../../hooks/use-mount-effect';
import { Text } from '../Text/text';
import { TextRolling, type TextRollingDirection } from './text-rolling';

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
const FORWARD_LABEL = 'forward';
const BACKWARD_LABEL = 'backward';

type RollingDemoProps = { direction?: TextRollingDirection; className?: string };

// Cycles the label every couple of seconds so the whole-text roll is visible.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function RollingDemo({ direction = 'forward', className }: RollingDemoProps) {
  const [index, setIndex] = useState(0);
  useMountEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % STATUSES.length), 2000);
    return () => clearInterval(id);
  });
  const current = STATUSES[index % STATUSES.length] ?? 'Uploading';
  return (
    <View style={{ minWidth: 160, alignItems: 'center' }}>
      <TextRolling text={current} direction={direction} className={className} />
    </View>
  );
}

export default meta;

export const AllVariants: Story = {
  name: 'All variants',
  render: (args) => (
    <View style={{ gap: 24, alignItems: 'center' }}>
      <View style={{ gap: 8, alignItems: 'center' }}>
        <Text className="text-muted-foreground text-xs">{FORWARD_LABEL}</Text>
        <RollingDemo direction="forward" className={args.className} />
      </View>
      <View style={{ gap: 8, alignItems: 'center' }}>
        <Text className="text-muted-foreground text-xs">{BACKWARD_LABEL}</Text>
        <RollingDemo direction="backward" className={args.className} />
      </View>
    </View>
  ),
};

/** Cycles the label every couple of seconds so the whole-text roll is visible. */
export const Cycling: Story = {
  render: (args) => <RollingDemo direction="forward" className={args.className} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText('Uploading')).toBeInTheDocument();
  },
};

/** Rolls downward — new label enters from above, old exits to the bottom. */
export const RollDown: Story = {
  render: (args) => <RollingDemo direction="backward" className={args.className} />,
};
