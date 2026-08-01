import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { expect, within } from 'storybook/test';
import { Action, Choice, ControlCard, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { TextReveal, type TextRevealSplit } from './text-reveal';

const meta = {
  title: 'Components/TextReveal',
  component: TextReveal,
  parameters: { layout: 'centered' },
  args: {
    text: 'Motion that feels considered.',
    split: 'word',
    stagger: 0.09,
    delay: 0,
    yOffset: 24,
    once: true,
    whileInView: false,
    className: 'text-2xl font-semibold text-foreground',
  },
  argTypes: {
    split: { control: 'select', options: ['word', 'char'] satisfies TextRevealSplit[] },
    stagger: { control: { type: 'range', min: 0.01, max: 0.3, step: 0.01 } },
    yOffset: { control: { type: 'range', min: 0, max: 80, step: 4 } },
  },
} satisfies Meta<typeof TextReveal>;

type Story = StoryObj<typeof meta>;

const SPLITS = ['word', 'char'] as const satisfies readonly TextRevealSplit[];
const PACES = [
  { value: '0.03', label: 'quick' },
  { value: '0.09', label: 'default' },
  { value: '0.18', label: 'slow' },
] as const;
const OFFSETS = ['0', '24', '60'] as const;
const ONE_LINE = 'Motion that feels considered.';
const TWO_LINES = ['Motion that feels', 'considered.'];
const HEADING = 'text-2xl font-semibold text-foreground';

type PaceKey = (typeof PACES)[number]['value'];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function TextRevealPlayground(args: ComponentProps<typeof TextReveal>) {
  const [split, setSplit] = useState<TextRevealSplit>('word');
  const [paceKey, setPaceKey] = useState<PaceKey>('0.09');
  const [offsetKey, setOffsetKey] = useState<(typeof OFFSETS)[number]>('24');
  const [multiline, setMultiline] = useState(false);
  // Remounting is the only way to replay a reveal — the animation runs once on mount.
  const [runKey, setRunKey] = useState(0);
  const replay = useCallback(() => setRunKey((k) => k + 1), []);

  const stagger = Number(paceKey);
  const yOffset = Number(offsetKey);

  return (
    <Playground className="max-w-[460px]">
      <ControlCard title="Options">
        <Choice label="Split" onChange={setSplit} options={SPLITS} value={split} />
        <Choice label="Stagger" onChange={setPaceKey} options={PACES} value={paceKey} />
        <Choice label="Y offset" onChange={setOffsetKey} options={OFFSETS} value={offsetKey} />
        <Toggle label="Multi-line" onChange={setMultiline} value={multiline} />
        <Action label="Replay" onPress={replay} />
      </ControlCard>

      <TextReveal
        {...args}
        className={HEADING}
        key={runKey}
        split={split}
        stagger={stagger}
        text={multiline ? TWO_LINES : ONE_LINE}
        yOffset={yOffset}
      />

      <Section title="Split">
        <Variants direction="column">
          {SPLITS.map((name) => (
            <Sample key={name} label={`${name} split`}>
              <TextReveal {...args} className={HEADING} split={name} stagger={name === 'char' ? 0.04 : 0.09} text={ONE_LINE} />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Stacked lines">
        <TextReveal {...args} className={HEADING} text={TWO_LINES} />
      </Section>

      {/* `whileInView` defers the reveal until the text scrolls into view; inside a
          story canvas it is already visible, so the two read the same here. */}
      <Section title="Y offset">
        <Variants direction="column">
          {OFFSETS.map((key) => (
            <Sample key={key} label={`${key}px travel`}>
              <TextReveal {...args} className="font-medium text-base text-foreground" text={ONE_LINE} yOffset={Number(key)} />
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Reveal per word or per character, at three paces and three travel distances.
 *  Press "Replay" to remount and watch the stagger again. */
export const Interactive: Story = { render: (args) => <TextRevealPlayground {...args} /> };

export const Words: Story = {
  name: 'Demo: Announces the whole line',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText(ONE_LINE)).toBeInTheDocument();
  },
};
