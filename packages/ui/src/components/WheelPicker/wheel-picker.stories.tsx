import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useEffect, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { Card } from '../Card/card';
import { WheelPicker } from './wheel-picker';

const meta = {
  title: 'Components/WheelPicker',
  component: WheelPicker,
  parameters: { layout: 'centered' },
  args: {
    options: ['Small', 'Medium', 'Large', 'X-Large'],
    onValueChange: fn(),
    visibleCount: 5,
    itemHeight: 36,
  },
  argTypes: {
    visibleCount: { control: { type: 'number', min: 3, max: 9, step: 2 } },
    itemHeight: { control: { type: 'number', min: 28, max: 56, step: 2 } },
    variant: { control: 'inline-radio', options: ['card', 'plain'] },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof WheelPicker>;

type Story = StoryObj<typeof meta>;

const SIZES = ['Small', 'Medium', 'Large', 'X-Large'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const YEARS = Array.from({ length: 60 }, (_, i) => String(1980 + i));

const ROWS = [
  { value: '3', label: '3 rows' },
  { value: '5', label: '5 rows' },
  { value: '7', label: '7 rows' },
] as const;
const HEIGHTS = [
  { value: '28', label: '28px' },
  { value: '36', label: '36px' },
  { value: '48', label: '48px' },
] as const;

type RowKey = (typeof ROWS)[number]['value'];
type HeightKey = (typeof HEIGHTS)[number]['value'];

// Specimen width. The wheel needs an explicit one: every row is absolutely
// positioned, so the frame has almost no intrinsic width, and a centred `Sample`
// (`alignItems: center`) sizes children to content instead of stretching them —
// which collapsed these specimens to ~32px. Setting the width on the picker
// itself, not the `Sample`, is what actually sizes the drum.
const SAMPLE_WHEEL = { width: 180 } as const;

function daysIn(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function BirthdayPicker() {
  const [month, setMonth] = useState('June');
  const [year, setYear] = useState('2004');
  const [day, setDay] = useState('9');

  const monthIndex = MONTHS.indexOf(month);
  const dayCount = daysIn(monthIndex, Number(year));
  const days = Array.from({ length: dayCount }, (_, i) => String(i + 1));

  // A short month can strand the day past the end — pull it back.
  // biome-ignore lint/plugin: mount-only by design
  useEffect(() => {
    if (Number(day) > dayCount) setDay(String(dayCount));
  }, [day, dayCount]);

  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Note>{`${month} ${day}, ${year}`}</Note>
      {/* Three `plain` wheels butted together inside one frame: no per-wheel
          surface or shadow, so the Card here (rounded, elevated, clipped) is the
          only container. Each wheel keeps its own rounded centre pill, aligned
          with its neighbours' — one selection row read across three columns.
          Widths are explicit: the frame's children are absolutely positioned, so
          a wheel has no intrinsic width to fall back on. */}
      <Card className="flex-row items-stretch overflow-hidden p-0" elevation={3}>
        <WheelPicker
          accessibilityLabel="Month"
          itemHeight={42}
          onValueChange={setMonth}
          options={MONTHS}
          style={{ width: 132 }}
          value={month}
          variant="plain"
          visibleCount={7}
        />
        <WheelPicker
          accessibilityLabel="Day"
          itemHeight={42}
          onValueChange={setDay}
          options={days}
          style={{ width: 64 }}
          value={day}
          variant="plain"
          visibleCount={7}
        />
        <WheelPicker
          accessibilityLabel="Year"
          itemHeight={42}
          onValueChange={setYear}
          options={YEARS}
          style={{ width: 88 }}
          value={year}
          variant="plain"
          visibleCount={7}
        />
      </Card>
    </View>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function WheelPickerPlayground(args: ComponentProps<typeof WheelPicker>) {
  const [size, setSize] = useState('Medium');
  const [rowKey, setRowKey] = useState<RowKey>('5');
  const [heightKey, setHeightKey] = useState<HeightKey>('36');
  const [disabled, setDisabled] = useState(false);
  const [sound, setSound] = useState(false);

  return (
    <Playground>
      <Controls>
        <Choice label="Visible rows" onChange={setRowKey} options={ROWS} value={rowKey} />
        <Choice label="Row height" onChange={setHeightKey} options={HEIGHTS} value={heightKey} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
        <Toggle label="Tick sound" onChange={setSound} value={sound} />
      </Controls>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={{ width: 200 }}>
          <WheelPicker
            {...args}
            accessibilityLabel="Size"
            disabled={disabled}
            itemHeight={Number(heightKey)}
            onValueChange={setSize}
            options={SIZES}
            sound={sound}
            value={size}
            visibleCount={Number(rowKey)}
          />
        </View>
        <Note testID="story-size">{size}</Note>
      </View>

      {/* Fewer visible rows steepen the drum: the same options bunch harder
          toward the horizon because each row covers more of the arc. */}
      <Section title="Window height">
        <Variants gap={16}>
          {ROWS.map((option) => (
            <Sample align="center" key={option.value} label={option.label}>
              <WheelPicker
                accessibilityLabel={`Size in ${option.label}`}
                defaultValue="Medium"
                options={SIZES}
                style={SAMPLE_WHEEL}
                visibleCount={Number(option.value)}
              />
            </Sample>
          ))}
        </Variants>
      </Section>

      {/* `card` stands alone; `plain` drops the surface but keeps the rounded
          selection pill, so it still reads on its own — shown unframed here,
          which is how it looks before a parent wraps it. */}
      <Section title="Container variant">
        <Variants gap={16}>
          <Sample align="center" label="card (default)">
            <WheelPicker accessibilityLabel="Size, card" defaultValue="Medium" options={SIZES} style={SAMPLE_WHEEL} />
          </Sample>
          <Sample align="center" label="plain">
            <WheelPicker
              accessibilityLabel="Size, plain"
              defaultValue="Medium"
              options={SIZES}
              style={SAMPLE_WHEEL}
              variant="plain"
            />
          </Sample>
        </Variants>
      </Section>

      <Section title="Disabled (dimmed, no drag)">
        <View style={{ width: 200 }}>
          <WheelPicker accessibilityLabel="Locked size" defaultValue="Medium" disabled={true} options={SIZES} />
        </View>
      </Section>

      {/* Several wheels in one row is the canonical use — a date picker. */}
      <Section title="Composed as a date picker">
        <BirthdayPicker />
      </Section>
    </Playground>
  );
}

export default meta;

/** One wheel plus its window/row-height ladder, the disabled state, and three
 *  wheels composed into a date picker. The tick sound is a toggle because it
 *  only fires while dragging across a row boundary. */
export const Interactive: Story = { render: (args) => <WheelPickerPlayground {...args} /> };

export const Default: Story = {
  name: 'Demo: Pick a size',
  render: (args) => (
    <View style={{ width: 200 }}>
      <WheelPicker {...args} accessibilityLabel="Size" defaultValue="Medium" />
    </View>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Tapping a row snaps to it and emits the new value (drag-scroll isn't
    // reproducible in jsdom/Chromium, so the row press stands in for a flick).
    await userEvent.click(await canvas.findByRole('button', { name: 'X-Large' }));
    await expect(args.onValueChange).toHaveBeenCalledWith('X-Large');
  },
};
