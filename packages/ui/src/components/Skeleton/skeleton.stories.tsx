import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { Choice, Controls, Playground, Sample, Section, Variants } from '../../__stories__/story-harness';
import { Skeleton, type SkeletonShape } from './skeleton';

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
const SHAPES = ['rounded', 'circle', 'square'] as const satisfies readonly SkeletonShape[];
const SPEEDS = [
  { value: '1', label: '1s' },
  { value: '2', label: '2s (default)' },
  { value: '4', label: '4s' },
] as const;

type SpeedKey = (typeof SPEEDS)[number]['value'];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function SkeletonPlayground(args: ComponentProps<typeof Skeleton>) {
  const [shape, setShape] = useState<SkeletonShape>('rounded');
  const [speedKey, setSpeedKey] = useState<SpeedKey>('2');
  const speed = Number(speedKey);

  return (
    <Playground style={{ width: LINE_WIDTH }}>
      <Controls>
        <Choice label="Shape" onChange={setShape} options={SHAPES} value={shape} />
        <Choice label="Pulse" onChange={setSpeedKey} options={SPEEDS} value={speedKey} />
      </Controls>

      <Skeleton {...args} className="h-10 w-full" shape={shape} speed={speed} />

      <Section title="Shapes">
        <Variants align="center" gap={16}>
          {SHAPES.map((name) => (
            <Sample align="center" key={name} label={name}>
              <Skeleton {...args} className="h-10 w-10" shape={name} speed={speed} />
            </Sample>
          ))}
        </Variants>
      </Section>

      {/* Sizing is a `className` concern — the component only owns the pulse and
          the corner preset, so real placeholders are composed, not configured. */}
      <Section title="Text block">
        <View style={{ gap: 8 }}>
          <Skeleton {...args} className="h-4 w-full" speed={speed} />
          <Skeleton {...args} className="h-4 w-full" speed={speed} />
          <Skeleton {...args} className="h-4 w-3/4" speed={speed} />
        </View>
      </Section>

      <Section title="Profile card">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Skeleton {...args} className="h-12 w-12" shape="circle" speed={speed} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton {...args} className="h-4 w-1/2" speed={speed} />
            <Skeleton {...args} className="h-3 w-3/4" speed={speed} />
          </View>
        </View>
      </Section>
    </Playground>
  );
}

export default meta;

/** Every shape and pulse speed, plus the two placeholder layouts they compose
 *  into (text block, profile card). Sizing stays a `className` concern. */
export const Interactive: Story = { render: (args) => <SkeletonPlayground {...args} /> };
