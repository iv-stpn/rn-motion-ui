import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Check, Copy, Moon, Send, Sparkles, Sun } from '../../lib/icons';
import { useThemeColor } from '../../theme/use-theme-color';
import { type ActionSwapAnimation, ActionSwapButton, type ActionSwapButtonProps, type ActionSwapItem } from './action-swap';

// Icons default to the `foreground` theme token when no `color` is passed, so
// leaving these uncoloured keeps them legible on the secondary/outline variants
// in both light and dark mode. The `primary` variant fills the button with
// `primary`, which equals `foreground` in both themes — a default-coloured icon
// would vanish against it — so the primary stories below resolve
// `primary-foreground` (the same token the label uses) instead.
const COPY_ITEMS: ActionSwapItem[] = [
  { id: 'copy', label: 'Copy link', icon: <Copy size={16} />, ariaLabel: 'Copy link' },
  { id: 'copied', label: 'Copied', icon: <Check size={16} />, ariaLabel: 'Copied' },
];

const THEME_ITEMS: ActionSwapItem[] = [
  { id: 'light', label: 'Light', icon: <Sun size={16} />, ariaLabel: 'Use light theme' },
  { id: 'dark', label: 'Dark', icon: <Moon size={16} />, ariaLabel: 'Use dark theme' },
];

/** A `primary`-variant item set with `primary-foreground` icons (dark-mode-sensitive). */
function usePrimaryItems(kind: 'send' | 'copy'): ActionSwapItem[] {
  const color = useThemeColor('primary-foreground');
  if (kind === 'send')
    return [
      { id: 'send', label: 'Send', icon: <Send size={16} color={color} />, ariaLabel: 'Send' },
      { id: 'sent', label: 'Sent', icon: <Sparkles size={16} color={color} />, ariaLabel: 'Sent' },
    ];
  return [
    { id: 'copy', label: 'Copy link', icon: <Copy size={16} color={color} />, ariaLabel: 'Copy link' },
    { id: 'copied', label: 'Copied', icon: <Check size={16} color={color} />, ariaLabel: 'Copied' },
  ];
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper rendered by the Roll/Cascade stories
function PrimarySwap({
  kind,
  animation,
  ...rest
}: { kind: 'send' | 'copy'; animation: ActionSwapAnimation } & ActionSwapButtonProps) {
  const items = usePrimaryItems(kind);
  return <ActionSwapButton {...rest} items={items} animation={animation} variant="primary" />;
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper rendered by the Animations story
function AnimationsGallery(props: ActionSwapButtonProps) {
  const send = usePrimaryItems('send');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <ActionSwapButton {...props} items={COPY_ITEMS} animation="blur" variant="secondary" />
      <ActionSwapButton {...props} items={send} animation="roll" variant="primary" />
      <ActionSwapButton {...props} items={COPY_ITEMS} animation="cascade" variant="outline" />
    </View>
  );
}

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

type Story = StoryObj<typeof meta>;
export default meta;

export const Blur: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    // Pressing cycles to the next item and reports it.
    await userEvent.click(button);
    await expect(args.onValueChange).toHaveBeenCalledWith('copied', expect.objectContaining({ id: 'copied' }));
  },
};

export const Roll: Story = {
  render: (args) => <PrimarySwap {...args} kind="send" animation="roll" />,
};

export const Cascade: Story = {
  render: (args) => <PrimarySwap {...args} kind="copy" animation="cascade" />,
};

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
  render: (args) => <AnimationsGallery {...args} />,
};
