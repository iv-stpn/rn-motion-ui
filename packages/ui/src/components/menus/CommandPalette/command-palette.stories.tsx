import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { AddLine as Plus } from 'rn-motion-ui-icons/icons/add-line';
import { FileLine as FileText } from 'rn-motion-ui-icons/icons/file-line';
import { Home2Line as Home } from 'rn-motion-ui-icons/icons/home-2-line';
import { Settings1Line as Settings } from 'rn-motion-ui-icons/icons/settings-1-line';
import { User2Line as User } from 'rn-motion-ui-icons/icons/user-2-line';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { Playground } from '../../../__stories__/story-harness';
import { TriggerButton, TriggerControls, useTriggerState } from '../../../__stories__/story-trigger';
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
  title: 'Menus/CommandPalette',
  component: CommandPalette,
  parameters: { layout: 'centered' },
  args: { items: ITEMS, shortcut: 'k', onOpenChange: fn() },
} satisfies Meta<typeof CommandPalette>;

type Story = StoryObj<typeof meta>;

const OPEN_LABEL = 'Open command palette';

function PalettePlayground() {
  const [open, setOpen] = useState(false);
  const trigger = useTriggerState();
  const handleOpen = useCallback(() => setOpen(true), []);

  return (
    <Playground className="min-w-[340px]">
      <TriggerControls state={trigger} />
      <TriggerButton
        kind={trigger.kind}
        size={trigger.size}
        shape={trigger.shape}
        floating={trigger.floating}
        label={OPEN_LABEL}
        onPress={handleOpen}
      />
      <CommandPalette items={ITEMS} onOpenChange={setOpen} open={open} shortcut="j" />
    </Playground>
  );
}

function PaletteDemo() {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);
  return (
    <>
      <TriggerButton label={OPEN_LABEL} onPress={openPalette} />
      <CommandPalette items={ITEMS} open={open} onOpenChange={setOpen} shortcut="j" />
    </>
  );
}

export default meta;

/** Swap the launch style, then search and run a command. */
export const Interactive: Story = {
  render: () => <PalettePlayground />,
};

export const Default: Story = {
  name: 'Demo: Type to filter',
  render: () => <PaletteDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Tapping the trigger opens the palette; its content mounts in the RN Modal.
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_LABEL }));
    await expect(await screen.findByText('Go to Home')).toBeTruthy();
    // Filtering the list narrows it to the matching row.
    const input = await screen.findByPlaceholderText('Type a command or search…');
    await userEvent.type(input, 'profile');
    await expect(await screen.findByText('Open profile')).toBeTruthy();
  },
};

export const Filtered: Story = {
  name: 'Demo: Select a command',
  render: () => <PaletteDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_LABEL }));
    const item = await screen.findByText('Settings');
    await userEvent.click(item);
    await expect(onSelect).toHaveBeenCalled();
  },
};
