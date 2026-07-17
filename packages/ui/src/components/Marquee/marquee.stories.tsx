import type { Meta, StoryObj } from '@storybook/react';
import { Text, View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Marquee } from './marquee';

const LOGOS = ['Vercel', 'Linear', 'Stripe', 'Figma', 'GitHub', 'Notion', 'Loom', 'Raycast'];

// biome-ignore lint/style/useComponentExportOnlyModules: Chip is a local story helper, intentionally unexported
function Chip({ label }: { label: string }) {
  return (
    <View className="h-12 items-center justify-center rounded-lg border border-border bg-card px-6">
      <Text className="font-medium text-foreground text-sm">{label}</Text>
    </View>
  );
}

const meta = {
  title: 'Components/Marquee',
  component: Marquee,
  parameters: { layout: 'centered' },
  args: { direction: 'left', speed: 20, gap: 16, children: null },
  argTypes: {
    direction: { control: 'select', options: ['left', 'right', 'up', 'down'] },
    speed: { control: { type: 'range', min: 4, max: 40, step: 2 } },
  },
  decorators: [
    (Story) => (
      <View style={{ width: 360 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Marquee>;

type Story = StoryObj<typeof meta>;
export default meta;

export const Horizontal: Story = {
  render: (args) => (
    <Marquee {...args} testID="marquee">
      {LOGOS.map((l) => (
        <Chip key={l} label={l} />
      ))}
    </Marquee>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Content is duplicated across two tracks, so each label appears twice.
    const hits = await canvas.findAllByText('Vercel');
    await expect(hits.length).toBeGreaterThanOrEqual(2);
  },
};

export const Reverse: Story = {
  render: (args) => (
    <Marquee {...args} direction="right">
      {LOGOS.map((l) => (
        <Chip key={l} label={l} />
      ))}
    </Marquee>
  ),
};
