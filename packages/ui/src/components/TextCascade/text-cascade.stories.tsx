import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Action, Choice, Controls, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { useInterval } from '../../hooks/use-interval';
import { TextCascade } from './text-cascade';

const meta = {
  title: 'Components/TextCascade',
  component: TextCascade,
  parameters: { layout: 'centered' },
  args: {
    text: 'Install skills',
    className: 'text-lg font-medium text-foreground',
  },
} satisfies Meta<typeof TextCascade>;

type Story = StoryObj<typeof meta>;

const PHRASE_SETS = {
  actions: ['Install skills', 'Open settings', 'Ship updates'],
  status: ['Syncing', 'Merging', 'Deploying'],
  counts: ['1 file', '12 files', '340 files'],
} as const;

const SETS = [
  { value: 'actions', label: 'Actions' },
  { value: 'status', label: 'Status' },
  { value: 'counts', label: 'Counts' },
] as const;

const INTERVALS = [
  { value: '1200', label: '1.2s' },
  { value: '2400', label: '2.4s' },
  { value: '4000', label: '4s' },
] as const;

const STYLES = [
  { value: 'text-lg font-medium text-foreground', label: 'md' },
  { value: 'font-semibold text-2xl text-foreground', label: 'lg' },
  { value: 'font-bold text-4xl text-primary', label: 'display' },
] as const;

type SetKey = (typeof SETS)[number]['value'];
type IntervalKey = (typeof INTERVALS)[number]['value'];
type StyleKey = (typeof STYLES)[number]['value'];

const CASCADE_WIDTH = 220;

type CascadeDemoProps = { phrases: readonly string[]; interval: number | null; className?: string; index?: number };

// Cycles the label so the letter-by-letter roll is visible without pressing anything.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function CascadeDemo({ phrases, interval, className, index }: CascadeDemoProps) {
  const [step, setStep] = useState(0);
  const advance = useCallback(() => setStep((p) => p + 1), []);
  useInterval(advance, interval);
  const at = index ?? step;
  const current = phrases[at % phrases.length] ?? phrases[0] ?? '';
  return (
    <View className="items-center" style={{ minWidth: CASCADE_WIDTH }}>
      <TextCascade className={className} text={current} />
    </View>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function CascadePlayground() {
  const [setKey, setSetKey] = useState<SetKey>('actions');
  const [intervalKey, setIntervalKey] = useState<IntervalKey>('2400');
  const [styleKey, setStyleKey] = useState<StyleKey>('text-lg font-medium text-foreground');
  const [cycling, setCycling] = useState(true);
  const [step, setStep] = useState(0);

  const phrases = PHRASE_SETS[setKey];
  const advance = useCallback(() => setStep((p) => p + 1), []);
  // Pausing hands the roll over to the Next button — the same state either way.
  useInterval(advance, cycling ? Number(intervalKey) : null);
  const current = phrases[step % phrases.length] ?? '';

  return (
    <Playground>
      <Controls>
        <Choice label="Phrases" onChange={setSetKey} options={SETS} value={setKey} />
        <Choice label="Every" onChange={setIntervalKey} options={INTERVALS} value={intervalKey} />
        <Choice label="Style" onChange={setStyleKey} options={STYLES} value={styleKey} />
        <Toggle label="Auto-cycle" onChange={setCycling} value={cycling} />
        <Action label="Next" onPress={advance} />
      </Controls>

      <View className="items-center" style={{ minWidth: CASCADE_WIDTH }}>
        <TextCascade className={styleKey} text={current} />
      </View>

      {/* Letters land left to right, so a longer word takes longer to settle —
          the width snaps to the new label rather than animating with it. */}
      <Section title="Text styles">
        <Variants align="center" direction="column">
          {STYLES.map((style) => (
            <Sample align="center" key={style.value} label={style.label}>
              <CascadeDemo className={style.value} interval={2400} phrases={phrases} />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Static labels (no cycle)">
        <Variants align="center" direction="column">
          {phrases.map((phrase, index) => (
            <CascadeDemo className={styleKey} index={index} interval={null} key={phrase} phrases={phrases} />
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Phrase sets, cycle interval and text scale. Pause the cycle to step through
 *  the labels by hand — each change re-runs the same per-letter roll. */
export const Interactive: Story = { render: () => <CascadePlayground /> };

/** Cycles the label every few seconds so the letter-by-letter roll is visible. */
export const Cycling: Story = {
  name: 'Demo: Cycles its label',
  render: (args) => <CascadeDemo className={args.className} interval={2400} phrases={PHRASE_SETS.actions} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The current phrase is exposed as the accessible label.
    await expect(await canvas.findByLabelText('Install skills')).toBeInTheDocument();
  },
};
