import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { FileLine as FileText } from 'rn-motion-ui-icons/icons/file-line';
import { FolderLine as FolderClosed } from 'rn-motion-ui-icons/icons/folder-line';
import { LayoutGridLine as LayoutGrid } from 'rn-motion-ui-icons/icons/layout-grid-line';
import { LinkLine as Link } from 'rn-motion-ui-icons/icons/link-line';
import { NotificationLine as Bell } from 'rn-motion-ui-icons/icons/notification-line';
import { TableLine as Table } from 'rn-motion-ui-icons/icons/table-line';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Playground, Toggle } from '../../../__stories__/story-harness';
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
  title: 'Menus/BloomMenu',
  component: BloomMenu,
  parameters: { layout: 'centered' },
  args: { items: ITEMS, onSelect: fn(), title: 'Create', triggerLabel: 'Create' },
} satisfies Meta<typeof BloomMenu>;

type Story = StoryObj<typeof meta>;

function BloomMenuDemo(props: ComponentProps<typeof BloomMenu>) {
  return (
    <View className="min-h-[420px] items-center justify-center">
      <BloomMenu {...props} />
    </View>
  );
}

function BloomMenuPlayground() {
  const [elevationKey, setElevationKey] = useState<ElevationKey>('0');
  const [floating, setFloating] = useState(false);

  return (
    <Playground>
      <ControlCard title="Options">
        <Toggle label="Floating" onChange={setFloating} value={floating} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
      </ControlCard>
      <View className="min-h-[420px] items-center justify-center">
        <BloomMenu floating={floating} elevation={ELEVATIONS[elevationKey]} items={ITEMS} title="Create" triggerLabel="Create" />
      </View>
    </Playground>
  );
}

export default meta;

export const Interactive: Story = {
  render: () => <BloomMenuPlayground />,
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
