import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Bell, FileText, FolderClosed, LayoutGrid, Link, Table } from '../../lib/icons';
import { BloomMenu, type BloomMenuItem } from './bloom-menu';

const ITEMS: BloomMenuItem[] = [
  { label: 'Doc', icon: FileText },
  { label: 'Board', icon: LayoutGrid },
  { label: 'Table', icon: Table },
  { label: 'Folder', icon: FolderClosed },
  { label: 'Reminder', icon: Bell },
  { label: 'Link', icon: Link },
];

const meta = {
  title: 'Components/BloomMenu',
  component: BloomMenu,
  parameters: { layout: 'centered' },
  args: { items: ITEMS, onSelect: fn(), title: 'Create', triggerLabel: 'Create' },
} satisfies Meta<typeof BloomMenu>;

type Story = StoryObj<typeof meta>;

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function BloomMenuDemo(props: ComponentProps<typeof BloomMenu>) {
  return (
    <View style={{ minHeight: 420, alignItems: 'center', justifyContent: 'center' }}>
      <BloomMenu {...props} />
    </View>
  );
}

export default meta;

export const Interactive: Story = {
  render: (args) => <BloomMenuDemo {...args} />,
};

export const Default: Story = {
  name: 'Demo: Open and select',
  render: (args) => <BloomMenuDemo {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Tapping the trigger blooms the panel open; a grid item then fires onSelect.
    await userEvent.click(await canvas.findByRole('button', { name: 'Create' }));
    const doc = await canvas.findByRole('button', { name: 'Doc' });
    await userEvent.click(doc);
    await expect(args.onSelect).toHaveBeenCalledWith('Doc');
  },
};
