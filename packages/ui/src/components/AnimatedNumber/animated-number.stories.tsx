import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Choice, Controls, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { useInterval } from '../../hooks/use-interval';
import { AnimatedNumber } from './animated-number';

const meta = {
  title: 'Components/AnimatedNumber',
  component: AnimatedNumber,
  parameters: { layout: 'centered' },
  args: {
    value: 129_480,
    duration: 1.2,
    startOnView: true,
    className: 'text-4xl font-semibold text-foreground',
  },
  argTypes: {
    duration: { control: { type: 'range', min: 0.2, max: 4, step: 0.1 } },
    startOnView: { control: 'boolean' },
  },
} satisfies Meta<typeof AnimatedNumber>;

type Story = StoryObj<typeof meta>;

const FORMATS = ['plain', 'currency', 'compact'] as const;
const DURATIONS = [
  { value: '0.4', label: '0.4s' },
  { value: '1.2', label: '1.2s' },
  { value: '3', label: '3s' },
] as const;
const TARGETS = [
  { value: '42', label: '42' },
  { value: '1280', label: '1,280' },
  { value: '129480', label: '129,480' },
] as const;
const LIVE_STEP_MS = 1800;

type FormatKey = (typeof FORMATS)[number];

const FORMATTERS: Record<FormatKey, (n: number) => string> = {
  plain: (n) => Math.round(n).toLocaleString(),
  currency: (n) => `$${Math.round(n).toLocaleString()}`,
  compact: (n) => `${(Math.round(n) / 1000).toFixed(1)}k`,
};

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function AnimatedNumberPlayground(args: ComponentProps<typeof AnimatedNumber>) {
  const [format, setFormat] = useState<FormatKey>('plain');
  const [durationKey, setDurationKey] = useState<(typeof DURATIONS)[number]['value']>('1.2');
  const [targetKey, setTargetKey] = useState<(typeof TARGETS)[number]['value']>('129480');
  const [live, setLive] = useState(false);
  const [bump, setBump] = useState(0);

  const duration = Number(durationKey);
  // The counter rolls from wherever it is to the new target, so a "live" tick is
  // just a bumped target — same code path the chips take.
  const value = Number(targetKey) + bump;
  const tick = useCallback(() => setBump((b) => b + Math.floor(Math.random() * 500)), []);
  useInterval(tick, live ? LIVE_STEP_MS : null);

  return (
    <Playground className="max-w-[420px]">
      <Controls>
        <Choice label="Target" onChange={setTargetKey} options={TARGETS} value={targetKey} />
        <Choice label="Format" onChange={setFormat} options={FORMATS} value={format} />
        <Choice label="Duration" onChange={setDurationKey} options={DURATIONS} value={durationKey} />
        <Toggle label="Live updates" onChange={setLive} value={live} />
      </Controls>

      <AnimatedNumber {...args} duration={duration} format={FORMATTERS[format]} value={value} />

      <View className="h-3" />
      <Section title="Formats (same value, different formatter)">
        <Variants>
          {FORMATS.map((name) => (
            <Sample align="center" key={name} label={name}>
              <AnimatedNumber
                {...args}
                className="font-semibold text-2xl text-foreground"
                duration={duration}
                format={FORMATTERS[name]}
                value={value}
              />
            </Sample>
          ))}
        </Variants>
      </Section>

      {/* `startOnView` gates the roll on the viewport; with it off the number
          counts up the moment it mounts, which is what a dashboard tile wants. */}
      <Section title="startOnView">
        <View className="flex-row gap-7">
          <Sample align="center" label="true (rolls when scrolled in)">
            <AnimatedNumber {...args} className="font-semibold text-2xl text-foreground" startOnView={true} value={9480} />
          </Sample>
          <Sample align="center" label="false (rolls on mount)">
            <AnimatedNumber {...args} className="font-semibold text-2xl text-foreground" startOnView={false} value={9480} />
          </Sample>
        </View>
      </Section>
    </Playground>
  );
}

export default meta;

/** Pick a target to watch it roll there, switch formatter, or flip "Live updates"
 *  to feed it a new value every 1.8s the way a metrics tile would. */
export const Interactive: Story = { render: (args) => <AnimatedNumberPlayground {...args} /> };

export const Default: Story = {
  name: 'Demo: Exposes the final value',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The final value is exposed as the accessible label regardless of the roll.
    await expect(await canvas.findByLabelText('129,480')).toBeInTheDocument();
  },
};
