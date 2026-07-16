import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Checkbox } from './checkbox';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  parameters: { layout: 'centered' },
  args: { checked: false, label: 'Accept terms and conditions', onCheckedChange: fn() },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const box = await canvas.findByRole('checkbox');
    await userEvent.click(box);
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  },
};

export const Checked: Story = { args: { checked: true } };
export const Indeterminate: Story = { args: { checked: true, indeterminate: true, label: 'Select all (partial)' } };
export const Disabled: Story = { args: { checked: true, disabled: true, label: 'Disabled' } };

export const Interactive: Story = {
  render: (args) => {
    const [terms, setTerms] = useState(true);
    const [updates, setUpdates] = useState(false);
    return (
      <View style={{ gap: 12 }}>
        <Checkbox {...args} checked={terms} onCheckedChange={setTerms} label="Accept terms and conditions" />
        <Checkbox {...args} checked={updates} onCheckedChange={setUpdates} label="Email me product updates" />
      </View>
    );
  },
};
