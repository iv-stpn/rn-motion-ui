import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Check, Copy, Moon, Send, Sparkles, Sun } from '../../lib/icons';
import { ActionSwapButton, type ActionSwapItem } from './action-swap';

const COPY_ITEMS: ActionSwapItem[] = [
  { id: 'copy', label: 'Copy link', icon: <Copy size={16} color="#111111" />, ariaLabel: 'Copy link' },
  { id: 'copied', label: 'Copied', icon: <Check size={16} color="#111111" />, ariaLabel: 'Copied' },
];

const SEND_ITEMS: ActionSwapItem[] = [
  { id: 'send', label: 'Send', icon: <Send size={16} color="#fafafa" />, ariaLabel: 'Send' },
  { id: 'sent', label: 'Sent', icon: <Sparkles size={16} color="#fafafa" />, ariaLabel: 'Sent' },
];

const THEME_ITEMS: ActionSwapItem[] = [
  { id: 'light', label: 'Light', icon: <Sun size={16} color="#111111" />, ariaLabel: 'Use light theme' },
  { id: 'dark', label: 'Dark', icon: <Moon size={16} color="#111111" />, ariaLabel: 'Use dark theme' },
];

const meta = {
  title: 'Components/ActionSwap',
  component: ActionSwapButton,
  parameters: { layout: 'centered' },
  args: { items: COPY_ITEMS, animation: 'blur', variant: 'secondary', size: 'md', onValueChange: fn() },
  argTypes: {
    animation: { control: 'select', options: ['blur', 'roll', 'cascade'] },
    variant: { control: 'select', options: ['primary', 'secondary', 'outline', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
  },
} satisfies Meta<typeof ActionSwapButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Blur: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    // Pressing cycles to the next item and reports it.
    await userEvent.click(button);
    await expect(args.onValueChange).toHaveBeenCalledWith('copied', expect.objectContaining({ id: 'copied' }));
  },
};

export const Roll: Story = { args: { items: SEND_ITEMS, animation: 'roll', variant: 'primary' } };

export const Cascade: Story = { args: { items: COPY_ITEMS, animation: 'cascade', variant: 'primary' } };

export const IconOnly: Story = {
  args: { items: THEME_ITEMS, variant: 'outline', size: 'icon', iconOnly: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onValueChange).toHaveBeenCalledWith('dark', expect.objectContaining({ id: 'dark' }));
  },
};

export const Animations: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <ActionSwapButton {...args} items={COPY_ITEMS} animation="blur" variant="secondary" />
      <ActionSwapButton {...args} items={SEND_ITEMS} animation="roll" variant="primary" />
      <ActionSwapButton {...args} items={COPY_ITEMS} animation="cascade" variant="outline" />
    </View>
  ),
};
