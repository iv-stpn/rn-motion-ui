import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { FileText, Home, Plus, Settings, User } from '../../lib/icons';
import { Button } from '../Button/button';
import { type CommandItem, CommandPalette } from './command-palette';

const onSelect = fn();

const ITEMS: CommandItem[] = [
  { id: 'home', label: 'Go to Home', group: 'Navigation', icon: Home, hint: 'G H', onSelect },
  { id: 'profile', label: 'Open profile', group: 'Navigation', icon: User, hint: 'G P', onSelect },
  { id: 'settings', label: 'Settings', group: 'Navigation', icon: Settings, onSelect },
  { id: 'new-doc', label: 'Create document', group: 'Actions', icon: FileText, hint: '⌘ N', onSelect },
  { id: 'new-project', label: 'New project', group: 'Actions', icon: Plus, hint: '⌘ ⇧ N', onSelect },
];

const meta = {
  title: 'Components/CommandPalette',
  component: CommandPalette,
  parameters: { layout: 'centered' },
  args: { items: ITEMS, shortcut: 'k', onOpenChange: fn() },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

function PaletteDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onPress={() => setOpen(true)}>Open command palette</Button>
      <CommandPalette items={ITEMS} open={open} onOpenChange={setOpen} shortcut="j" />
    </>
  );
}

export const Default: Story = {
  render: () => <PaletteDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Tapping the trigger opens the palette; its content mounts in the RN Modal.
    await userEvent.click(await canvas.findByText('Open command palette'));
    await expect(await screen.findByText('Go to Home')).toBeTruthy();
    // Filtering the list narrows it to the matching row.
    const input = await screen.findByPlaceholderText('Type a command or search…');
    await userEvent.type(input, 'profile');
    await expect(await screen.findByText('Open profile')).toBeTruthy();
  },
};

export const Filtered: Story = {
  render: () => <PaletteDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Open command palette'));
    const item = await screen.findByText('Settings');
    await userEvent.click(item);
    await expect(onSelect).toHaveBeenCalled();
  },
};
