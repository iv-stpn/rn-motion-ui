import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useState } from 'react';
import { View } from 'react-native';
import { FileLine as FileText } from 'rn-motion-ui-icons/icons/file-line';
import { FolderLine as FolderClosed } from 'rn-motion-ui-icons/icons/folder-line';
import { LayoutGridLine as LayoutGrid } from 'rn-motion-ui-icons/icons/layout-grid-line';
import { LinkLine as Link } from 'rn-motion-ui-icons/icons/link-line';
import { NotificationLine as Bell } from 'rn-motion-ui-icons/icons/notification-line';
import { TableLine as Table } from 'rn-motion-ui-icons/icons/table-line';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Playground, Toggle } from '../../../__stories__/story-harness';
import { OVERLAY_OPTIONS, type OverlayType } from '../Overlay/overlay-type';
import { MorphingMenu, type MorphingMenuItem } from './morphing-menu';

const ITEMS: MorphingMenuItem[] = [
  { label: 'Doc', icon: FileText },
  { label: 'Board', icon: LayoutGrid },
  { label: 'Table', icon: Table },
  { label: 'Folder', icon: FolderClosed },
  { label: 'Reminder', icon: Bell },
  { label: 'Link', icon: Link },
];

const meta = {
  title: 'Menus/MorphingMenu',
  component: MorphingMenu,
  parameters: { layout: 'centered' },
  args: { items: ITEMS, onSelect: fn(), title: 'Create', triggerLabel: 'Create' },
} satisfies Meta<typeof MorphingMenu>;

type Story = StoryObj<typeof meta>;

function MorphingMenuDemo(props: ComponentProps<typeof MorphingMenu>) {
  return (
    <View className="min-h-[420px] items-center justify-center">
      <MorphingMenu {...props} />
    </View>
  );
}

function MorphingMenuPlayground() {
  const [elevationKey, setElevationKey] = useState<ElevationKey>('6');
  const [floating, setFloating] = useState(false);
  const [overlay, setOverlay] = useState<OverlayType>('none');
  const [closeOnOutside, setCloseOnOutside] = useState(true);

  return (
    <Playground>
      <ControlCard title="Options">
        <Toggle label="Floating" onChange={setFloating} value={floating} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
        <Choice label="Overlay" onChange={setOverlay} options={OVERLAY_OPTIONS} value={overlay} />
        <Toggle label="Close on outside" onChange={setCloseOnOutside} value={closeOnOutside} />
      </ControlCard>
      <View className="min-h-[420px] items-center justify-center">
        <MorphingMenu
          closeOnOutsidePress={closeOnOutside}
          elevation={ELEVATIONS[elevationKey]}
          floating={floating}
          items={ITEMS}
          overlay={overlay}
          title="Create"
          triggerLabel="Create"
        />
      </View>
    </Playground>
  );
}

export default meta;

export const Interactive: Story = {
  render: () => <MorphingMenuPlayground />,
};

export const Default: Story = {
  name: 'Demo: Open and select',
  render: (args) => <MorphingMenuDemo {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Tapping the trigger morphs the panel open; a grid item then fires onSelect.
    await userEvent.click(await canvas.findByRole('button', { name: 'Create' }));
    // Panel cells mount inside a Modal — use screen to query outside the canvas.
    const doc = await screen.findByRole('button', { name: 'Doc' });
    await userEvent.click(doc);
    await expect(args.onSelect).toHaveBeenCalledWith('Doc');
  },
};
