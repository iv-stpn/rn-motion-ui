import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Choice, Controls, Playground, Sample, Section, Variants } from '../../__stories__/story-harness';
import { Text } from '../Text/text';
import { Marquee, type MarqueeDirection } from './marquee';

const LOGOS = ['Vercel', 'Linear', 'Stripe', 'Figma', 'GitHub', 'Notion', 'Loom', 'Raycast'];

type ChipProps = { label: string };

// biome-ignore lint/style/useComponentExportOnlyModules: Chip is a local story helper, intentionally unexported
function Chip({ label }: ChipProps) {
  return (
    <View className="h-12 items-center justify-center rounded-lg border border-border bg-surface-3 px-6">
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

const DIRECTIONS = ['left', 'right', 'up', 'down'] as const satisfies readonly MarqueeDirection[];
const SPEEDS = [
  { value: '10', label: '10s (fast)' },
  { value: '20', label: '20s' },
  { value: '40', label: '40s (slow)' },
] as const;
const GAPS = [
  { value: '0', label: 'none' },
  { value: '16', label: '16px' },
  { value: '48', label: '48px' },
] as const;
const VERTICAL_HEIGHT = 180;

type SpeedKey = (typeof SPEEDS)[number]['value'];
type GapKey = (typeof GAPS)[number]['value'];

/** Both tracks render the same chips, so the helper is called once per track. */
function chips() {
  return LOGOS.map((label) => <Chip key={label} label={label} />);
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function MarqueePlayground(args: ComponentProps<typeof Marquee>) {
  const [direction, setDirection] = useState<MarqueeDirection>('left');
  const [speedKey, setSpeedKey] = useState<SpeedKey>('20');
  const [gapKey, setGapKey] = useState<GapKey>('16');

  // `speed` is seconds per loop, so a bigger number is a slower marquee.
  const speed = Number(speedKey);
  const gap = Number(gapKey);
  const vertical = direction === 'up' || direction === 'down';

  return (
    <Playground>
      <Controls>
        <Choice label="Direction" onChange={setDirection} options={DIRECTIONS} value={direction} />
        <Choice label="Loop" onChange={setSpeedKey} options={SPEEDS} value={speedKey} />
        <Choice label="Gap" onChange={setGapKey} options={GAPS} value={gapKey} />
      </Controls>

      <Marquee {...args} direction={direction} gap={gap} speed={speed} style={vertical ? { height: VERTICAL_HEIGHT } : undefined}>
        {chips()}
      </Marquee>

      <View style={{ height: 12 }} />
      <Section title="Horizontal">
        <Variants direction="column" gap={16}>
          <Sample label="left">
            <Marquee {...args} direction="left" gap={gap} speed={speed}>
              {chips()}
            </Marquee>
          </Sample>
          <Sample label="right">
            <Marquee {...args} direction="right" gap={gap} speed={speed}>
              {chips()}
            </Marquee>
          </Sample>
        </Variants>
      </Section>

      <Section title="Vertical">
        <Variants gap={20}>
          <Sample label="up">
            <Marquee {...args} direction="up" gap={gap} speed={speed} style={{ height: VERTICAL_HEIGHT }}>
              {chips()}
            </Marquee>
          </Sample>
          <Sample label="down">
            <Marquee {...args} direction="down" gap={gap} speed={speed} style={{ height: VERTICAL_HEIGHT }}>
              {chips()}
            </Marquee>
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** All four directions plus loop duration and gap. The two tracks are identical,
 *  so every label appears twice — that's what makes the loop seamless. */
export const Interactive: Story = { render: (args) => <MarqueePlayground {...args} /> };

export const Horizontal: Story = {
  name: 'Demo: Duplicates its track',
  render: (args) => (
    <Marquee {...args} testID="marquee">
      {chips()}
    </Marquee>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Content is duplicated across two tracks, so each label appears twice.
    const hits = await canvas.findAllByText('Vercel');
    await expect(hits.length).toBeGreaterThanOrEqual(2);
  },
};
