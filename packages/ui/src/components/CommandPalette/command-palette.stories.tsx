import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Section } from '../../__stories__/story-harness';
import { TRIGGER_KINDS, TriggerButton, type TriggerKind } from '../../__stories__/story-trigger';
import { FileText, Home, Plus, Settings, User } from '../../lib/icons';
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

type Story = StoryObj<typeof meta>;

const OPEN_LABEL = 'Open command palette';
const OPEN_NOTE = 'Open — type to filter, tap a row to run it.';
const CLOSED_NOTE = 'Closed — open it to search the command list.';
const SHORTCUT_NOTE = 'shortcut is kept for web parity; there is no window shortcut on native, so it is a no-op.';

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function PalettePlayground() {
  const [open, setOpen] = useState(false);
  const [triggerKind, setTriggerKind] = useState<TriggerKind>('button');
  const handleOpen = useCallback(() => setOpen(true), []);
  const openNote = open ? OPEN_NOTE : CLOSED_NOTE;

  return (
    <Playground style={{ minWidth: 340 }}>
      <Controls>
        <Choice label="Trigger" onChange={setTriggerKind} options={TRIGGER_KINDS} value={triggerKind} />
      </Controls>

      <Section>
        <TriggerButton kind={triggerKind} label={OPEN_LABEL} onPress={handleOpen} />
        <Note testID="story-open">{openNote}</Note>
      </Section>

      <Note>{SHORTCUT_NOTE}</Note>

      <CommandPalette items={ITEMS} onOpenChange={setOpen} open={open} shortcut="j" />
    </Playground>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
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
