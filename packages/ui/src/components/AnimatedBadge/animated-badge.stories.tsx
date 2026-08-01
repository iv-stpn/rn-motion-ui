import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { useInterval } from '../../hooks/use-interval';
import { AnimatedBadge, type AnimatedBadgeSize, type AnimatedBadgeStatus } from './animated-badge';

const meta = {
  title: 'Components/AnimatedBadge',
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
