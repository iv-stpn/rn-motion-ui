import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { useInterval } from '../../../hooks/use-interval';
import { TextNumberTicker, type TextNumberTickerMode } from './text-number-ticker';

const meta = {
  title: 'Typography/TextNumberTicker',
  component: TextNumberTicker,
  parameters: { layout: 'centered' },
  args: {
    value: 48_273,
    mode: 'roll',
    stagger: 0.04,
    startOnView: true,
    locale: true,
    className: 'text-4xl text-foreground',
    weight: 'semibold',
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['roll', 'count'] },
    duration: { control: { type: 'range', min: 0.2, max: 3, step: 0.1 } },
    stagger: { control: { type: 'range', min: 0, max: 0.2, step: 0.01 } },
    locale: { control: 'boolean' },
    pad: { control: { type: 'number' } },
  },
} satisfies Meta<typeof TextNumberTicker>;

type Story = StoryObj<typeof meta>;

const NUMERAL = 'text-3xl text-foreground';
const LIVE_MS = 2500;

const MODES = [
  { value: 'roll', label: 'roll (per-digit columns)' },
  { value: 'count', label: 'count (single label)' },
] as const satisfies readonly { value: TextNumberTickerMode; label: string }[];

const TARGETS = [
  { value: '42', label: '42' },
  { value: '1280', label: '1,280' },
  { value: '48273', label: '48,273' },
] as const;

const STAGGERS = [
  { value: '0', label: 'none' },
  { value: '0.04', label: '0.04s' },
  { value: '0.12', label: '0.12s' },
] as const;
const FORMATS = ['plain', 'currency', 'compact'] as const;

type FormatKey = (typeof FORMATS)[number];
type TargetKey = (typeof TARGETS)[number]['value'];
type StaggerKey = (typeof STAGGERS)[number]['value'];

/** `'count'` hands the formatter the in-flight fractional value, so each one
 *  rounds however it wants to — that is what keeps "1.2k" legible mid-roll. */
const FORMATTERS: Record<FormatKey, ((n: number) => string) | undefined> = {
  plain: undefined,
  currency: (n) => `$${Math.round(n).toLocaleString()}`,
  compact: (n) => `${(Math.round(n) / 1000).toFixed(1)}k`,
};

function TextNumberTickerPlayground(args: ComponentProps<typeof TextNumberTicker>) {
  const [mode, setMode] = useState<TextNumberTickerMode>('roll');
  const [targetKey, setTargetKey] = useState<TargetKey>('48273');
  const [staggerKey, setStaggerKey] = useState<StaggerKey>('0.04');
  const [formatKey, setFormatKey] = useState<FormatKey>('plain');
  const [locale, setLocale] = useState(true);
  const [padded, setPadded] = useState(false);
  const [affixed, setAffixed] = useState(false);
  const [live, setLive] = useState(false);
  const [drift, setDrift] = useState(0);

  const stagger = Number(staggerKey);
  // The live feed only nudges the last digits, which is what the per-digit
  // stagger is for: unchanged columns hold still while the tail rolls.
  const bump = useCallback(() => setDrift((d) => d + Math.floor(Math.random() * 50) + 1), []);
  useInterval(bump, live ? LIVE_MS : null);
  const value = Number(targetKey) + drift;

  return (
    <Playground className="max-w-[420px]">
      <ControlCard title="Controls">
        <Choice label="Mode" onChange={setMode} options={MODES} value={mode} />
        <Choice label="Target" onChange={setTargetKey} options={TARGETS} value={targetKey} />
        <Choice label="Stagger" onChange={setStaggerKey} options={STAGGERS} value={staggerKey} />
        <Choice label="Format" onChange={setFormatKey} options={FORMATS} value={formatKey} />
      </ControlCard>
      <ControlCard title="Options">
        <Toggle label="Locale separators" onChange={setLocale} value={locale} />
        <Toggle label="Pad to 6" onChange={setPadded} value={padded} />
        <Toggle label="Affixes" onChange={setAffixed} value={affixed} />
        <Toggle label="Live feed" onChange={setLive} value={live} />
      </ControlCard>

      <View className="items-center gap-1.5">
        <TextNumberTicker
          {...args}
          format={FORMATTERS[formatKey]}
          locale={locale}
          mode={mode}
          pad={padded ? 6 : undefined}
          prefix={affixed ? '$' : undefined}
          stagger={stagger}
          suffix={affixed ? ' MRR' : undefined}
          value={value}
        />
        <Note testID="story-ticker-value">{live ? `live · every ${LIVE_MS / 1000}s` : `value ${value}`}</Note>
      </View>

      {/* The two modes side by side on one value: `'roll'` moves columns, `'count'`
          moves the number itself. Only `'roll'` reacts to `stagger`. */}
      <Section title="Modes">
        <Variants direction="column">
          {MODES.map(({ value: m, label }) => (
            <Sample key={m} label={label}>
              <TextNumberTicker {...args} className={NUMERAL} mode={m} stagger={stagger} value={value} />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Formatting">
        <Variants direction="column">
          <Sample label="locale separators">
            <TextNumberTicker {...args} className={NUMERAL} locale={true} mode={mode} stagger={stagger} value={48_273} />
          </Sample>
          <Sample label="pad={6} (leading zeros hold their columns)">
            <TextNumberTicker {...args} className={NUMERAL} locale={false} mode={mode} pad={6} stagger={stagger} value={42} />
          </Sample>
          <Sample label="prefix / suffix">
            <TextNumberTicker {...args} className={NUMERAL} mode={mode} prefix="$" stagger={stagger} suffix=" MRR" value={1280} />
          </Sample>
          <Sample label="compact formatter">
            <TextNumberTicker
              {...args}
              className={NUMERAL}
              format={FORMATTERS.compact}
              mode={mode}
              stagger={stagger}
              value={value}
            />
          </Sample>
        </Variants>
      </Section>

      {/* `startOnView` gates the animation on the viewport; with it off the number
          animates the moment it mounts, which is what a dashboard tile wants. */}
      <Section title="startOnView">
        <View className="flex-row gap-7">
          <Sample align="center" label="true (animates when scrolled in)">
            <TextNumberTicker {...args} className={NUMERAL} mode={mode} startOnView={true} value={9480} />
          </Sample>
          <Sample align="center" label="false (animates on mount)">
            <TextNumberTicker {...args} className={NUMERAL} mode={mode} startOnView={false} value={9480} />
          </Sample>
        </View>
      </Section>
    </Playground>
  );
}

export default meta;

/** Switch between the two modes, every formatting option (locale separators,
 *  padding, affixes, custom formatter) and the per-digit stagger. Flip "Live feed"
 *  to watch only the changed columns roll. */
export const Interactive: Story = { render: (args) => <TextNumberTickerPlayground {...args} /> };

export const Default: Story = {
  name: 'Demo: Exposes a readable value',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Digits render as scrolling columns, so assert the accessible readable value.
    await expect(await canvas.findByLabelText('48,273')).toBeInTheDocument();
  },
};
