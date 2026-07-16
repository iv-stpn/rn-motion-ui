import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Switch } from './switch';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  parameters: { layout: 'centered' },
  args: { checked: false, label: 'Enable notifications', onCheckedChange: fn() },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('switch');
    await userEvent.click(toggle);
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  },
};

export const On: Story = { args: { checked: true, label: 'On' } };
export const Disabled: Story = { args: { checked: true, disabled: true, label: 'Disabled' } };

export const Interactive: Story = {
  render: (args) => {
    const [on, setOn] = useState(true);
    return (
      <View style={{ gap: 12 }}>
        <Switch {...args} checked={on} onCheckedChange={setOn} label="Enable notifications" />
        <Switch {...args} checked={false} onCheckedChange={() => {}} label="Off" />
        <Switch {...args} checked disabled onCheckedChange={() => {}} label="Disabled" />
      </View>
    );
  },
};
