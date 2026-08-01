import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { useInterval } from '../../../hooks/use-interval';
import { NumberTicker } from './number-ticker';

const meta = {
  title: 'Typography/NumberTicker',
  component: NumberTicker,
  parameters: { layout: 'centered' },
  args: {
    value: 48_273,
    duration: 0.9,
    stagger: 0.04,
    startOnView: true,
    locale: true,
    className: 'text-4xl font-semibold text-foreground',
  },
  argTypes: {
    duration: { control: { type: 'range', min: 0.2, max: 3, step: 0.1 } },
    stagger: { control: { type: 'range', min: 0, max: 0.2, step: 0.01 } },
    locale: { control: 'boolean' },
    pad: { control: { type: 'number' } },
  },
} satisfies Meta<typeof NumberTicker>;

type Story = StoryObj<typeof meta>;

const NUMERAL = 'font-semibold text-3xl text-foreground';
const LIVE_MS = 2500;

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

type TargetKey = (typeof TARGETS)[number]['value'];
type StaggerKey = (typeof STAGGERS)[number]['value'];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function NumberTickerPlayground(args: ComponentProps<typeof NumberTicker>) {
  const [targetKey, setTargetKey] = useState<TargetKey>('48273');
  const [staggerKey, setStaggerKey] = useState<StaggerKey>('0.04');
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
        <Choice label="Target" onChange={setTargetKey} options={TARGETS} value={targetKey} />
        <Choice label="Stagger" onChange={setStaggerKey} options={STAGGERS} value={staggerKey} />
      </ControlCard>
      <ControlCard title="Options">
        <Toggle label="Locale separators" onChange={setLocale} value={locale} />
        <Toggle label="Pad to 6" onChange={setPadded} value={padded} />
        <Toggle label="Affixes" onChange={setAffixed} value={affixed} />
        <Toggle label="Live feed" onChange={setLive} value={live} />
      </ControlCard>

      <View className="items-center gap-1.5">
        <NumberTicker
          {...args}
          locale={locale}
          pad={padded ? 6 : undefined}
          prefix={affixed ? '$' : undefined}
          stagger={stagger}
          suffix={affixed ? ' MRR' : undefined}
          value={value}
        />
        <Note testID="story-ticker-value">{live ? `live · every ${LIVE_MS / 1000}s` : `value ${value}`}</Note>
      </View>

      <Section title="Formatting">
        <Variants direction="column">
          <Sample label="locale separators">
            <NumberTicker {...args} className={NUMERAL} locale={true} stagger={stagger} value={48_273} />
          </Sample>
          <Sample label="pad={6} (leading zeros hold their columns)">
            <NumberTicker {...args} className={NUMERAL} locale={false} pad={6} stagger={stagger} value={42} />
          </Sample>
          <Sample label="prefix / suffix">
            <NumberTicker {...args} className={NUMERAL} prefix="$" stagger={stagger} suffix=" MRR" value={1280} />
          </Sample>
        </Variants>
      </Section>

      <Section title="Stagger">
        <Variants direction="column">
          {STAGGERS.map((option) => (
            <Sample key={option.value} label={`stagger ${option.label}`}>
              <NumberTicker {...args} className={NUMERAL} stagger={Number(option.value)} value={value} />
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Every formatting mode (locale separators, padding, affixes) plus the per-digit
 *  stagger. Flip "Live feed" to watch only the changed columns roll. */
export const Interactive: Story = { render: (args) => <NumberTickerPlayground {...args} /> };

export const Default: Story = {
  name: 'Demo: Exposes a readable value',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Digits render as scrolling columns, so assert the accessible readable value.
    await expect(await canvas.findByLabelText('48,273')).toBeInTheDocument();
  },
};
