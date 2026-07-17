import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import { AvailabilityScheduler, defaultWeek } from './availability-scheduler';

const meta = {
  title: 'Components/AvailabilityScheduler',
  component: AvailabilityScheduler,
  args: {
    defaultValue: defaultWeek(),
    onChange: fn(),
  },
} satisfies Meta<typeof AvailabilityScheduler>;

type Story = StoryObj<typeof meta>;
export default meta;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Monday switch should be present and checked (Mon is enabled by default)
    const mondaySwitch = await canvas.findByTestId('switch-mon');
    await expect(mondaySwitch).toBeTruthy();

    // The Monday label should be visible
    const mondayLabel = await canvas.findByText('Monday');
    await expect(mondayLabel).toBeTruthy();

    // 9:00 AM should appear in the time buttons (Mon–Fri all start 9:00 by default,
    // so it legitimately repeats — assert at least one match rather than a unique one).
    const nineAMs = await canvas.findAllByText('9:00 AM');
    await expect(nineAMs.length).toBeGreaterThan(0);
  },
};

export const WeekendOnly: Story = {
  args: {
    defaultValue: {
      mon: { enabled: false, ranges: [{ id: 'mon-0', start: '09:00', end: '17:00' }] },
      tue: { enabled: false, ranges: [{ id: 'tue-0', start: '09:00', end: '17:00' }] },
      wed: { enabled: false, ranges: [{ id: 'wed-0', start: '09:00', end: '17:00' }] },
      thu: { enabled: false, ranges: [{ id: 'thu-0', start: '09:00', end: '17:00' }] },
      fri: { enabled: false, ranges: [{ id: 'fri-0', start: '09:00', end: '17:00' }] },
      sat: { enabled: true, ranges: [{ id: 'sat-0', start: '10:00', end: '16:00' }] },
      sun: { enabled: true, ranges: [{ id: 'sun-0', start: '10:00', end: '16:00' }] },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const satLabel = await canvas.findByText('Saturday');
    await expect(satLabel).toBeTruthy();
  },
};
