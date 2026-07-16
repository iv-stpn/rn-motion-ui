import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { expect, within } from 'storybook/test';
import { NumberTicker } from './number-ticker';

const meta = {
  title: 'Components/NumberTicker',
  component: NumberTicker,
  parameters: { layout: 'centered' },
  args: {
    value: 48273,
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

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Digits render as scrolling columns, so assert the accessible readable value.
    await expect(await canvas.findByLabelText('48,273')).toBeInTheDocument();
  },
};

export const Padded: Story = {
  args: { value: 42, pad: 6, locale: false },
};

export const WithAffixes: Story = {
  args: { value: 1280, prefix: '$', suffix: ' MRR', locale: true },
};

export const Live: Story = {
  render: (args) => {
    const [value, setValue] = useState(48273);
    useEffect(() => {
      const id = setInterval(() => setValue((v) => v + Math.floor(Math.random() * 50)), 2500);
      return () => clearInterval(id);
    }, []);
    return (
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 12, color: '#71717a' }}>Active users</Text>
        <NumberTicker {...args} value={value} />
        <Text style={{ fontSize: 12, color: '#71717a' }}>live · updates every 2.5s</Text>
      </View>
    );
  },
};
