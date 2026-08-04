// biome-ignore-all lint/style/useExportsLast: stories demo
import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { useInterval } from '../../../hooks/use-interval';
import { AnimatedBadge, type AnimatedBadgeSize, type AnimatedBadgeStatus } from './animated-badge';

const meta = {
  title: 'Display/AnimatedBadge',
  component: AnimatedBadge,
  parameters: { layout: 'centered' },
  args: { children: 'Synced', status: 'success', size: 'md', showIcon: true },
  argTypes: {
    status: { control: 'select', options: ['neutral', 'info', 'success', 'warning', 'danger', 'loading'] },
    size: { control: 'select', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof AnimatedBadge>;

type Story = StoryObj<typeof meta>;

const STATUSES = ['neutral', 'info', 'success', 'warning', 'danger', 'loading'] as const satisfies readonly AnimatedBadgeStatus[];
const SIZES = ['sm', 'md'] as const satisfies readonly AnimatedBadgeSize[];

/** Label each status carries in the catalogue rows — a badge is a word plus a hue. */
const STATUS_LABELS: Record<AnimatedBadgeStatus, string> = {
  neutral: 'Queued',
  info: 'Live',
  success: 'Verified',
  warning: 'Pending',
  danger: 'Blocked',
  loading: 'Indexing',
};

const CYCLE: readonly AnimatedBadgeStatus[] = ['loading', 'success', 'warning', 'danger'];
const CYCLE_MS = 1600;

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function AnimatedBadgePlayground(args: ComponentProps<typeof AnimatedBadge>) {
  const [status, setStatus] = useState<AnimatedBadgeStatus>('success');
  const [size, setSize] = useState<AnimatedBadgeSize>('md');
  const [showIcon, setShowIcon] = useState(true);
  const [cycling, setCycling] = useState(false);

  // The status crossfade (label swap + fill interpolation) only shows when the
  // status actually changes, so the auto-cycle drives the same state the chips do.
  const advance = useCallback(() => {
    setStatus((current) => {
      const next = CYCLE.indexOf(current) + 1;
      return CYCLE[next % CYCLE.length] ?? 'loading';
    });
  }, []);
  useInterval(advance, cycling ? CYCLE_MS : null);

  return (
    <Playground className="max-w-[380px]">
      <ControlCard title="Options">
        <Choice label="Status" onChange={setStatus} options={STATUSES} value={status} />
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Toggle label="Icon" onChange={setShowIcon} value={showIcon} />
        <Toggle label="Auto-cycle" onChange={setCycling} value={cycling} />
      </ControlCard>

      <View className="items-start">
        <AnimatedBadge {...args} showIcon={showIcon} size={size} status={status}>
          {STATUS_LABELS[status]}
        </AnimatedBadge>
      </View>

      <View className="mt-3">
        {SIZES.map((name) => (
          <Section key={name} title={name === 'sm' ? 'Small' : 'Medium'}>
            <Variants>
              {STATUSES.map((value) => (
                <AnimatedBadge {...args} key={value} showIcon={showIcon} size={name} status={value}>
                  {STATUS_LABELS[value]}
                </AnimatedBadge>
              ))}
            </Variants>
          </Section>
        ))}

        <Section title="Without icons">
          <Variants>
            {STATUSES.map((value) => (
              <AnimatedBadge {...args} key={value} showIcon={false} size={size} status={value}>
                {STATUS_LABELS[value]}
              </AnimatedBadge>
            ))}
          </Variants>
        </Section>
      </View>
    </Playground>
  );
}

export default meta;

/** Every status at both sizes, with or without icons. Flip "Auto-cycle" to watch
 *  the fill interpolate and the label crossfade as the status changes. */
export const Interactive: Story = { render: (args) => <AnimatedBadgePlayground {...args} /> };

export const Success: Story = {
  name: 'Demo: Renders its label',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Synced')).toBeInTheDocument();
  },
};

const SPIN_TESTID = 'animated-badge-spin';
/** Re-render cadence for the churn below — fast enough to land several inside one revolution. */
const CHURN_MS = 50;
const ROTATE_DEG = /rotate\((-?[\d.]+)deg\)/;

// A parent that re-renders on a timer while the badge just sits there loading.
// This is the shape that broke the spin: the badge's own props never change, but
// each parent render hands MotiView a fresh `animate` literal, and moti's
// useAnimatedStyle re-ran and re-issued withTiming(360deg) *from the current
// angle* — so the rotation kept restarting mid-turn instead of cycling.

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function ChurningParent() {
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((value) => value + 1), []);
  useInterval(bump, CHURN_MS);
  return (
    <AnimatedBadge size="md" status="loading" testID={SPIN_TESTID}>
      {STATUS_LABELS.loading}
    </AnimatedBadge>
  );
}

/** Reads the spinner's current angle out of the inline transform the web driver writes. */
function readAngle(badge: HTMLElement): number {
  for (const element of badge.querySelectorAll('div')) {
    const match = ROTATE_DEG.exec(element.getAttribute('style') ?? '');
    if (match?.[1]) return Number(match[1]);
  }
  return Number.NaN;
}

/**
 * The loading spin has to be continuous under a re-rendering parent.
 *
 * Sampling the angle twice across ~500ms — half a revolution at the 1000ms
 * period — and requiring real progress catches both halves of what was wrong.
 * The restart-per-render bug pinned the angle near its starting value, because
 * every 50ms tick re-issued the tween from wherever it had reached and gave it a
 * fresh full second to finish. The easing bug (`withTiming` defaults to
 * `Easing.inOut(Easing.quad)`) then stalled it again at each revolution
 * boundary. A linear loop owned by a shared value does neither.
 */
export const ContinuousSpin: Story = {
  name: 'Demo: Loading spin cycles under re-renders',
  render: () => <ChurningParent />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badge = await canvas.findByTestId(SPIN_TESTID);

    await waitFor(() => expect(Number.isNaN(readAngle(badge))).toBe(false));
    const first = readAngle(badge);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const second = readAngle(badge);

    // Normalise into one turn so a sample landing after the 360° wrap still
    // reads as forward travel rather than a large negative jump.
    const travelled = (((second - first) % 360) + 360) % 360;
    await expect(travelled).toBeGreaterThan(120);
  },
};
