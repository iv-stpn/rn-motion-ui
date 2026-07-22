import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { useMountEffect } from '../../hooks/use-mount-effect';
import { Text } from '../Text/text';
import { AnimatedNumber } from './animated-number';

const meta = {
  title: 'Components/AnimatedNumber',
  component: AnimatedNumber,
  parameters: { layout: 'centered' },
  args: {
    value: 129_480,
    duration: 1.2,
    startOnView: true,
    className: 'text-4xl font-semibold text-foreground',
  },
  argTypes: {
    duration: { control: { type: 'range', min: 0.2, max: 4, step: 0.1 } },
    startOnView: { control: 'boolean' },
  },
} satisfies Meta<typeof AnimatedNumber>;

type Story = StoryObj<typeof meta>;

const MRR_LABEL = 'Monthly recurring revenue';
const MRR_DELTA = '+12.4% vs last month';
const ACTIVE_USERS_LABEL = 'Active users';
const formatCount = (n: number) => Math.round(n).toLocaleString();

export default meta;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The final value is exposed as the accessible label regardless of the roll.
    await expect(await canvas.findByLabelText('129,480')).toBeInTheDocument();
  },
};

export const Currency: Story = {
  args: {
    value: 129_480,
    format: (n: number) => `$${Math.round(n).toLocaleString()}`,
  },
  render: (args) => (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Text className="text-muted-foreground text-xs">{MRR_LABEL}</Text>
      <AnimatedNumber {...args} />
      <Text className="text-success text-xs">{MRR_DELTA}</Text>
    </View>
  ),
};

export const Live: Story = {
  render: (args) => {
    const [value, setValue] = useState(48_273);
    useMountEffect(() => {
      const id = setInterval(() => setValue((v) => v + Math.floor(Math.random() * 500)), 2000);
      return () => clearInterval(id);
    });
    return (
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text className="text-muted-foreground text-xs">{ACTIVE_USERS_LABEL}</Text>
        <AnimatedNumber {...args} value={value} duration={0.8} format={formatCount} />
      </View>
    );
  },
};
