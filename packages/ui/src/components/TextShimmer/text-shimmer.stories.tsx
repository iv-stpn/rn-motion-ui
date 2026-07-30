import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Action, Choice, Controls, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { useInterval } from '../../hooks/use-interval';
import { useThemeColor } from '../../theme/use-theme-color';
import { Text } from '../Text/text';
import { TextShimmer } from './text-shimmer';

const meta = {
  title: 'Components/TextShimmer',
  component: TextShimmer,
  parameters: { layout: 'centered' },
  args: {
    children: 'Loading projects…',
    duration: 2.5,
    // No `text-*` colour here: the sweep writes colour as an animated style, so
    // `color` / `highlightColor` own it and a class would be overridden anyway.
    className: 'text-2xl font-semibold',
  },
  argTypes: {
    duration: { control: { type: 'range', min: 0.5, max: 5, step: 0.25 } },
  },
} satisfies Meta<typeof TextShimmer>;

type Story = StoryObj<typeof meta>;

// Mirrors text-animation.preview.tsx: swap between two shimmer strings on a timer.
const PHRASES = ['Loading with shimmer', 'Almost there…'];
const DEFAULT_TEXT = 'Loading projects…';
const DURATIONS = [
  { value: '1.2', label: '1.2s (fast)' },
  { value: '2.5', label: '2.5s (default)' },
  { value: '4', label: '4s (slow)' },
] as const;
const SIZES = [
  { value: 'text-sm', label: 'sm' },
  { value: 'text-lg', label: 'lg' },
  { value: 'text-2xl', label: '2xl' },
] as const;
const SWAP_MS = 3000;

type DurationKey = (typeof DURATIONS)[number]['value'];
type SizeClass = (typeof SIZES)[number]['value'];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function TextShimmerPlayground(args: ComponentProps<typeof TextShimmer>) {
  const [durationKey, setDurationKey] = useState<DurationKey>('2.5');
  const [sizeClass, setSizeClass] = useState<SizeClass>('text-2xl');
  const [swapping, setSwapping] = useState(false);
  const [phrase, setPhrase] = useState(0);
  const mutedForeground = useThemeColor('muted-foreground');
  const info = useThemeColor('info');

  const duration = Number(durationKey);
  const advance = useCallback(() => setPhrase((p) => (p + 1) % PHRASES.length), []);
  useInterval(advance, swapping ? SWAP_MS : null);
  const text = swapping ? (PHRASES[phrase] ?? DEFAULT_TEXT) : DEFAULT_TEXT;

  return (
    <Playground className="max-w-[420px]">
      <Controls>
        <Choice label="Sweep" onChange={setDurationKey} options={DURATIONS} value={durationKey} />
        <Choice label="Size" onChange={setSizeClass} options={SIZES} value={sizeClass} />
        <Toggle label="Swap text" onChange={setSwapping} value={swapping} />
        <Action label="Next phrase" onPress={advance} />
      </Controls>

      <View className="min-h-[44px] justify-center">
        <TextShimmer {...args} className={`font-semibold ${sizeClass}`} duration={duration}>
          {text}
        </TextShimmer>
      </View>

      <Section title="Sweep speeds">
        <Variants direction="column">
          {DURATIONS.map((option) => (
            <Sample key={option.value} label={option.label}>
              <TextShimmer {...args} className="font-medium text-lg" duration={Number(option.value)}>
                {DEFAULT_TEXT}
              </TextShimmer>
            </Sample>
          ))}
        </Variants>
      </Section>

      {/* The sweep interpolates between two colours, so a tinted glint is just a
          different pair of tokens — no gradient or mask needed. */}
      <Section title="Sweep colours">
        <Variants direction="column">
          <Sample label="default (muted → foreground)">
            <TextShimmer {...args} className="font-medium text-lg" duration={duration}>
              {DEFAULT_TEXT}
            </TextShimmer>
          </Sample>
          <Sample label="tinted (muted → info)">
            <TextShimmer
              {...args}
              className="font-medium text-lg"
              color={mutedForeground}
              duration={duration}
              highlightColor={info}
            >
              {DEFAULT_TEXT}
            </TextShimmer>
          </Sample>
        </Variants>
      </Section>

      {/* Non-string children can't be split per character, so they render static —
          the documented fallback rather than a broken shimmer. */}
      <Section title="Non-string child (renders static)">
        <TextShimmer {...args} className="font-medium text-lg" duration={duration}>
          <Text className="font-medium text-foreground text-lg">{DEFAULT_TEXT}</Text>
        </TextShimmer>
      </Section>
    </Playground>
  );
}

export default meta;

/** One shimmering line plus the sweep-speed ladder. Flip "Swap text" to watch the
 *  shimmer re-derive its per-character stagger when the string length changes. */
export const Interactive: Story = { render: (args) => <TextShimmerPlayground {...args} /> };

export const Default: Story = {
  name: 'Demo: Announces its text',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText(DEFAULT_TEXT)).toBeInTheDocument();
  },
};
