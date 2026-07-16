import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RangeSlider } from './range-slider';

const meta = {
  title: 'Components/RangeSlider',
  component: RangeSlider,
  parameters: { layout: 'centered' },
  args: { defaultValue: 40, min: 0, max: 100, step: 5, accessibilityLabel: 'Value', onValueChange: fn() },
  argTypes: {
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
    showTicks: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <View style={{ width: 320 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof RangeSlider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const slider = await canvas.findByRole('slider');
    await userEvent.click(slider);
    await expect(args.onValueChange).toHaveBeenCalled();
  },
};

export const NoTicks: Story = { args: { showTicks: false, step: 1 } };
export const Disabled: Story = { args: { disabled: true, defaultValue: 60 } };

export const Interactive: Story = {
  render: (args) => {
    const [value, setValue] = useState(40);
    return (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text className="text-sm text-muted-foreground">Drag the handle</Text>
          <Text className="text-sm text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
            {value}
          </Text>
        </View>
        <RangeSlider {...args} value={value} onValueChange={setValue} step={5} accessibilityLabel="Value" />
      </View>
    );
  },
};
