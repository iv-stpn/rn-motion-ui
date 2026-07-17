import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { Button } from '../Button/button';
import { Drawer } from './drawer';

const meta = {
  title: 'Components/Drawer',
  component: Drawer,
  parameters: { layout: 'centered' },
  args: { open: false, onOpenChange: fn(), side: 'right', children: null },
  argTypes: {
    side: { control: 'select', options: ['left', 'right'] },
  },
} satisfies Meta<typeof Drawer>;

type Story = StoryObj<typeof meta>;

const OPEN_LABEL = 'Open drawer';
const DRAWER_TITLE = 'Drawer';

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function DrawerDemo({ side }: { side: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const openDrawer = useCallback(() => setOpen(true), []);
  return (
    <View style={{ gap: 12 }}>
      <Button onPress={openDrawer}>{OPEN_LABEL}</Button>
      <Drawer open={open} onOpenChange={setOpen} side={side} accessibilityLabel="Demo drawer">
        <View style={{ gap: 8, padding: 24 }}>
          <Text className="font-semibold text-foreground text-sm">{DRAWER_TITLE}</Text>
          <Text className="text-muted-foreground text-sm">{`Slides in from the ${side}. Tap outside to close.`}</Text>
        </View>
      </Drawer>
    </View>
  );
}

export default meta;

export const Right: Story = {
  render: () => <DrawerDemo side="right" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Tapping the trigger opens the drawer; its panel mounts in the RN Modal.
    await userEvent.click(await canvas.findByText(OPEN_LABEL));
    await expect(await screen.findByText(DRAWER_TITLE)).toBeTruthy();
  },
};

export const Left: Story = {
  render: () => <DrawerDemo side="left" />,
};
