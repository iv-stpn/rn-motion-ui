import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
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
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof WheelPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <View style={{ width: 200 }}>
      <WheelPicker {...args} defaultValue="Medium" accessibilityLabel="Size" />
    </View>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Tapping a row snaps to it and emits the new value (drag-scroll isn't
    // reproducible in jsdom/Chromium, so the row press stands in for a flick).
    await userEvent.click(await canvas.findByText('X-Large'));
    await expect(args.onValueChange).toHaveBeenCalledWith('X-Large');
  },
};

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

function daysIn(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

export const DateOfBirth: Story = {
  render: () => {
    const [month, setMonth] = useState('June');
    const [year, setYear] = useState('2004');
    const [day, setDay] = useState('9');

    const monthIndex = MONTHS.indexOf(month);
    const dayCount = daysIn(monthIndex, Number(year));
    const days = Array.from({ length: dayCount }, (_, i) => String(i + 1));

    // A short month can strand the day past the end — pull it back.
    useEffect(() => {
      if (Number(day) > dayCount) setDay(String(dayCount));
    }, [day, dayCount]);

    return (
      <View style={{ alignItems: 'center', gap: 16 }}>
        <Text className="text-sm text-muted-foreground">
          Born{' '}
          <Text className="font-medium text-foreground">
            {month} {day}, {year}
          </Text>
        </Text>
        <View className="flex-row items-stretch gap-1 rounded-3xl border border-border bg-background p-2">
          <WheelPicker
            options={MONTHS}
            value={month}
            onValueChange={setMonth}
            visibleCount={7}
            itemHeight={42}
            accessibilityLabel="Month"
            style={{ width: 128, borderWidth: 0, backgroundColor: 'transparent' }}
          />
          <WheelPicker
            options={days}
            value={day}
            onValueChange={setDay}
            visibleCount={7}
            itemHeight={42}
            accessibilityLabel="Day"
            style={{ width: 56, borderWidth: 0, backgroundColor: 'transparent' }}
          />
          <WheelPicker
            options={YEARS}
            value={year}
            onValueChange={setYear}
            visibleCount={7}
            itemHeight={42}
            accessibilityLabel="Year"
            style={{ width: 80, borderWidth: 0, backgroundColor: 'transparent' }}
          />
        </View>
      </View>
    );
  },
};

export const Disabled: Story = {
  render: (args) => (
    <View style={{ width: 200 }}>
      <WheelPicker {...args} defaultValue="Medium" disabled accessibilityLabel="Size" />
    </View>
  ),
};
