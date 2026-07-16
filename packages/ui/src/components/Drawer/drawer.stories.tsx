import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
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

export default meta;
type Story = StoryObj<typeof meta>;

function DrawerDemo({ side }: { side: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      <Button onPress={() => setOpen(true)}>Open drawer</Button>
      <Drawer open={open} onOpenChange={setOpen} side={side} accessibilityLabel="Demo drawer">
        <View style={{ gap: 8, padding: 24 }}>
          <Text className="text-sm font-semibold text-foreground">Drawer</Text>
          <Text className="text-sm text-muted-foreground">Slides in from the {side}. Tap outside to close.</Text>
        </View>
      </Drawer>
    </View>
  );
}

export const Right: Story = {
  render: () => <DrawerDemo side="right" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Tapping the trigger opens the drawer; its panel mounts in the RN Modal.
    await userEvent.click(await canvas.findByText('Open drawer'));
    await expect(await screen.findByText('Drawer')).toBeTruthy();
  },
};

export const Left: Story = {
  render: () => <DrawerDemo side="left" />,
};
