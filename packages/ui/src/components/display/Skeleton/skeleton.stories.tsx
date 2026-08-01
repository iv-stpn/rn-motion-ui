import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { expect, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Variants } from '../../../__stories__/story-harness';
import { Skeleton, type SkeletonShape } from './skeleton';

const meta = {
  title: 'Display/Skeleton',
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
      <ControlCard title="Options">
        <Choice label="Shape" onChange={setShape} options={SHAPES} value={shape} />
        <Choice label="Pulse" onChange={setSpeedKey} options={SPEEDS} value={speedKey} />
      </ControlCard>

      <Skeleton {...args} className="h-10 w-full" shape={shape} speed={speed} />

      <Section title="Shapes">
        <Variants align="center">
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
        <View className="gap-2">
          <Skeleton {...args} className="h-4 w-full" speed={speed} />
          <Skeleton {...args} className="h-4 w-full" speed={speed} />
          <Skeleton {...args} className="h-4 w-3/4" speed={speed} />
        </View>
      </Section>

      <Section title="Profile card">
        <View className="flex-row items-center gap-3">
          <Skeleton {...args} className="h-12 w-12" shape="circle" speed={speed} />
          <View className="flex-1 gap-2">
            <Skeleton {...args} className="h-4 w-1/2" speed={speed} />
            <Skeleton {...args} className="h-3 w-3/4" speed={speed} />
          </View>
        </View>
      </Section>
    </Playground>
  );
}

const PULSE_TESTID = 'skeleton-pulse';

export default meta;

/** Every shape and pulse speed, plus the two placeholder layouts they compose
 *  into (text block, profile card). Sizing stays a `className` concern. */
export const Interactive: Story = { render: (args) => <SkeletonPlayground {...args} /> };

/**
 * A skeleton that renders but never pulses is indistinguishable from a plain
 * muted box — it looks like a deliberate design, not a broken animation. This
 * samples the opacity twice across the tween and asserts it actually moved.
 *
 * The reduced-motion branch is the same assertion inverted, and which one runs
 * is decided by the environment rather than by the story: `useReducedMotion`
 * resolves through `AccessibilityInfo`, which reads a `matchMedia` list
 * captured at module load, so a play function can't flip it after the fact.
 * CI's headless Chromium reports no-preference and exercises the pulse; a
 * developer running with reduce-motion on exercises the static branch and gets
 * a real assertion rather than a false failure.
 */
export const Default: Story = {
  name: 'Demo: Pulses (unless reduced motion)',
  render: (args) => <Skeleton {...args} className="h-10 w-40" speed={1} testID={PULSE_TESTID} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pulse = await canvas.findByTestId(PULSE_TESTID);
    await expect(pulse).toBeInTheDocument();

    const prefersReduced = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const opacity = () => Number(getComputedStyle(pulse).opacity);

    if (prefersReduced) {
      // Static muted box: the transition is a 0ms timing to opacity 1, so the
      // value must never leave 1 — sampling over a full nominal cycle.
      await new Promise((resolve) => setTimeout(resolve, 600));
      await expect(opacity()).toBe(1);
      return;
    }

    // speed={1} → a 500ms half-cycle ping-ponging 1 → 0.5 → 1, so any sample
    // taken mid-flight sits strictly below 1.
    await waitFor(() => expect(opacity()).toBeLessThan(1), { timeout: 2000 });
    await expect(opacity()).toBeGreaterThanOrEqual(0.5);
  },
};
