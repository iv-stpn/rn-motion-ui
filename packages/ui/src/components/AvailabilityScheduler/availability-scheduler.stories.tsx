import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useMemo, useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Section } from '../../__stories__/story-harness';
import {
  AvailabilityScheduler,
  type DayAvailability,
  type DayKey,
  defaultWeek,
  type WeekAvailability,
} from './availability-scheduler';

const meta = {
  title: 'Components/AvailabilityScheduler',
  component: AvailabilityScheduler,
  args: {
    defaultValue: defaultWeek(),
    onChange: fn(),
  },
} satisfies Meta<typeof AvailabilityScheduler>;

type Story = StoryObj<typeof meta>;

const NONE = 'None';
const SCHEDULER_STYLE = { maxHeight: 520 };

const DAYS = [
  { key: 'mon', short: 'Mon' },
  { key: 'tue', short: 'Tue' },
  { key: 'wed', short: 'Wed' },
  { key: 'thu', short: 'Thu' },
  { key: 'fri', short: 'Fri' },
  { key: 'sat', short: 'Sat' },
  { key: 'sun', short: 'Sun' },
] as const satisfies readonly { key: DayKey; short: string }[];

const WEEKEND: readonly DayKey[] = ['sat', 'sun'];

const PRESETS = [
  { value: 'weekdays', label: 'Mon–Fri 9–5' },
  { value: 'weekend', label: 'Weekend only' },
  { value: 'all', label: 'Every day' },
  { value: 'none', label: 'All off' },
] as const;

type Preset = (typeof PRESETS)[number]['value'];

const STEPS = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '60 min' },
] as const;

type StepKey = (typeof STEPS)[number]['value'];

// Each preset is a whole week, so switching one re-seeds every row rather than
// patching the current selection.
const PRESET_RANGES: Record<Preset, { weekday: readonly [string, string] | null; weekend: readonly [string, string] | null }> = {
  weekdays: { weekday: ['09:00', '17:00'], weekend: null },
  weekend: { weekday: null, weekend: ['10:00', '16:00'] },
  all: { weekday: ['08:00', '18:00'], weekend: ['10:00', '16:00'] },
  none: { weekday: null, weekend: null },
};

function buildWeek(preset: Preset): WeekAvailability {
  const spec = PRESET_RANGES[preset];
  const seed = (key: DayKey): DayAvailability => {
    const range = WEEKEND.includes(key) ? spec.weekend : spec.weekday;
    // A disabled day keeps a range so flipping its switch back on restores one.
    return { enabled: range !== null, ranges: [{ id: `${key}-0`, start: range?.[0] ?? '09:00', end: range?.[1] ?? '17:00' }] };
  };
  return {
    mon: seed('mon'),
    tue: seed('tue'),
    wed: seed('wed'),
    thu: seed('thu'),
    fri: seed('fri'),
    sat: seed('sat'),
    sun: seed('sun'),
  };
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function SchedulerPlayground() {
  const [preset, setPreset] = useState<Preset>('weekdays');
  const [stepKey, setStepKey] = useState<StepKey>('30');
  const [week, setWeek] = useState<WeekAvailability>(() => buildWeek('weekdays'));

  const selectPreset = useCallback((next: Preset) => {
    setPreset(next);
    setWeek(buildWeek(next));
  }, []);

  const enabled = useMemo(() => DAYS.filter(({ key }) => week[key].enabled).map(({ short }) => short), [week]);

  return (
    <Playground style={{ width: 380 }}>
      <Controls>
        <Choice label="Preset" onChange={selectPreset} options={PRESETS} value={preset} />
        <Choice label="Step" onChange={setStepKey} options={STEPS} value={stepKey} />
      </Controls>

      <Note testID="story-enabled">{`Enabled: ${enabled.length > 0 ? enabled.join(', ') : NONE}`}</Note>

      <Section title="Switch a day off, add a second range, or copy one day across the week">
        <AvailabilityScheduler onChange={setWeek} step={Number(stepKey)} style={SCHEDULER_STYLE} value={week} />
      </Section>
    </Playground>
  );
}

export default meta;

/** Presets re-seed the week; the step choice changes the time-picker granularity. */
export const Interactive: Story = {
  render: () => <SchedulerPlayground />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Mon is enabled by the default preset, so its switch and label are present…
    await expect(await canvas.findByTestId('switch-mon')).toBeTruthy();
    await expect(await canvas.findByText('Monday')).toBeTruthy();
    // …and Mon–Fri all start at 9:00, so that label legitimately repeats.
    const nineAMs = await canvas.findAllByText('9:00 AM');
    await expect(nineAMs.length).toBeGreaterThan(0);

    await userEvent.click(await canvas.findByTestId('story-choice-preset-none'));
    await expect(await canvas.findByTestId('story-enabled')).toHaveTextContent(`Enabled: ${NONE}`);
  },
};
