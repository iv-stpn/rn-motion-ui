import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { expect, within } from 'storybook/test';
import { AnimatedNumber } from './animated-number';

const meta = {
  title: 'Components/AnimatedNumber',
  component: AnimatedNumber,
  parameters: { layout: 'centered' },
  args: {
    value: 129480,
    duration: 1.2,
    startOnView: true,
    className: 'text-4xl font-semibold text-foreground',
  },
  argTypes: {
    duration: { control: { type: 'range', min: 0.2, max: 4, step: 0.1 } },
    startOnView: { control: 'boolean' },
  },
} satisfies Meta<typeof AnimatedNumber>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The final value is exposed as the accessible label regardless of the roll.
    await expect(await canvas.findByLabelText('129,480')).toBeInTheDocument();
  },
};

export const Currency: Story = {
  args: {
    value: 129480,
    format: (n: number) => `$${Math.round(n).toLocaleString()}`,
  },
  render: (args) => (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Text className="text-xs text-muted-foreground">Monthly recurring revenue</Text>
      <AnimatedNumber {...args} />
      <Text className="text-xs text-success">+12.4% vs last month</Text>
    </View>
  ),
};

export const Live: Story = {
  render: (args) => {
    const [value, setValue] = useState(48273);
    useEffect(() => {
      const id = setInterval(() => setValue((v) => v + Math.floor(Math.random() * 500)), 2000);
      return () => clearInterval(id);
    }, []);
    return (
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text className="text-xs text-muted-foreground">Active users</Text>
        <AnimatedNumber {...args} value={value} duration={0.8} format={(n) => Math.round(n).toLocaleString()} />
      </View>
    );
  },
};
