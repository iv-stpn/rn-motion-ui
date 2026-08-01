import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Variants } from '../../__stories__/story-harness';
import { DirectionProvider } from '../../hooks/direction-provider';
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
  args: { direction: 'start', speed: 20, gap: 16, children: null },
  argTypes: {
    direction: { control: 'select', options: ['start', 'end', 'left', 'right', 'up', 'down'] },
    speed: { control: { type: 'range', min: 4, max: 40, step: 2 } },
  },
  decorators: [
    (Story) => (
      <View className="w-[360px]">
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

// `style.direction` rather than the `dir` prop: `dir` is a react-native-web
// extension and is not in React Native's own ViewProps, so it does not
// typecheck against the library's RN types. `direction` is a real RN layout
// style and lands on CSS `direction` on web.
const LTR_STYLE = { direction: 'ltr' } as const;
const RTL_STYLE = { direction: 'rtl' } as const;

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
      <ControlCard title="Options">
        <Choice label="Direction" onChange={setDirection} options={DIRECTIONS} value={direction} />
        <Choice label="Loop" onChange={setSpeedKey} options={SPEEDS} value={speedKey} />
        <Choice label="Gap" onChange={setGapKey} options={GAPS} value={gapKey} />
      </ControlCard>

      <Marquee
        {...args}
        direction={direction}
        gap={gap}
        speed={speed}
        className="w-full"
        style={vertical ? { height: VERTICAL_HEIGHT } : undefined}
      >
        {chips()}
      </Marquee>

      <View className="h-3" />
      <Section title="Horizontal">
        <Variants direction="column">
          <Sample label="left">
            <Marquee {...args} direction="left" gap={gap} speed={speed} className="w-full">
              {chips()}
            </Marquee>
          </Sample>
          <Sample label="right">
            <Marquee {...args} direction="right" gap={gap} speed={speed} className="w-full">
              {chips()}
            </Marquee>
          </Sample>
        </Variants>
      </Section>

      <Section title="Vertical">
        <Variants>
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
    <Marquee {...args} testID="marquee" className="w-full">
      {chips()}
    </Marquee>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Content is duplicated across two tracks, so each label appears twice.
    const hits = await canvas.findAllByText('Vercel');
    await expect(hits.length).toBeGreaterThanOrEqual(2);

    // …but only one of them is audible. The duplicate exists to make the loop
    // seamless; a screen reader reading the logo list twice is a bug.
    const [, duplicate] = hits;
    expect(duplicate?.closest('[aria-hidden="true"]')).not.toBeNull();
  },
};

/**
 * `direction="start"` means "toward the leading edge", so the belt has to
 * travel the other way in RTL — and it is not a cosmetic preference. Under
 * `dir="rtl"` the platform mirrors the belt's own flex row, putting the second
 * track to the *left* of the first; keeping the LTR travel direction would pull
 * the first track away from its duplicate and tear a gap open in the loop
 * instead of cycling.
 *
 * The two directions are rendered side by side and asserted to travel opposite
 * ways, which also pins the wiring the RTL toolbar toggle depends on: the
 * layout flip comes from `dir`, the library's own resolution from
 * `DirectionProvider`, and this fails if either is missing.
 */
export const RightToLeft: Story = {
  name: 'Demo: Mirrors travel in RTL',
  render: (args) => (
    <View className="gap-4">
      <DirectionProvider value="ltr">
        <View style={LTR_STYLE} className="w-full">
          <Marquee {...args} direction="start" testID="marquee-ltr" className="w-full">
            {chips()}
          </Marquee>
        </View>
      </DirectionProvider>
      <DirectionProvider value="rtl">
        <View style={RTL_STYLE} className="w-full">
          <Marquee {...args} direction="start" testID="marquee-rtl" className="w-full">
            {chips()}
          </Marquee>
        </View>
      </DirectionProvider>
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The animated belt is the marquee's only transformed child.
    const beltOf = async (testID: string) => {
      const root = await canvas.findByTestId(testID);
      const belt = root.firstElementChild;
      if (!(belt instanceof HTMLElement)) throw new Error(`No animated belt inside ${testID}`);
      return belt;
    };
    // translateX out of the computed matrix — `matrix(a, b, c, d, tx, ty)`.
    const translateX = (el: HTMLElement) => {
      const { transform } = getComputedStyle(el);
      if (transform === 'none') return 0;
      return Number(transform.slice(transform.indexOf('(') + 1, -1).split(',')[4] ?? 0);
    };

    const ltr = await beltOf('marquee-ltr');
    const rtl = await beltOf('marquee-rtl');

    // Let both loops get past their first frame before sampling. The RTL belt
    // starts by jumping to -distance and animating back toward 0, so a window
    // that straddles that jump reads one full track width of "travel" in the
    // wrong direction — which is exactly the false negative this avoids.
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Sample both belts over the same window and compare the direction of
    // travel rather than absolute offsets, which depend on measured width.
    const before = { ltr: translateX(ltr), rtl: translateX(rtl) };
    await new Promise((resolve) => setTimeout(resolve, 250));
    const after = { ltr: translateX(ltr), rtl: translateX(rtl) };

    const ltrDelta = after.ltr - before.ltr;
    const rtlDelta = after.rtl - before.rtl;
    // Both must actually be moving — two stationary belts would "agree" on a
    // delta of zero and pass an opposite-sign check that only compared signs.
    expect(Math.abs(ltrDelta)).toBeGreaterThan(0);
    expect(Math.abs(rtlDelta)).toBeGreaterThan(0);
    expect(ltrDelta).toBeLessThan(0); // LTR: content travels left
    expect(rtlDelta).toBeGreaterThan(0); // RTL: mirrored
  },
};
