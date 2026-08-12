import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Playground } from '../../../__stories__/story-harness';
import { TriggerButton, TriggerControls, useTriggerState } from '../../../__stories__/story-trigger';
import { Text } from '../../typography/Text/text';
import { Drawer } from './drawer';

const meta = {
  title: 'Menus/Drawer',
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

type DrawerSide = 'left' | 'right';
const SIDES = ['left', 'right'] as const satisfies readonly DrawerSide[];

function DrawerPlayground() {
  const [side, setSide] = useState<DrawerSide>('left');
  const [open, setOpen] = useState(false);
  const trigger = useTriggerState();
  const handleOpen = useCallback(() => setOpen(true), []);

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Side" onChange={setSide} options={SIDES} value={side} />
      </ControlCard>

      <TriggerControls state={trigger} />

      <TriggerButton kind={trigger.kind} size={trigger.size} shape={trigger.shape} label={OPEN_LABEL} onPress={handleOpen} />

      <Drawer open={open} onOpenChange={setOpen} side={side} accessibilityLabel="Demo drawer">
        <View className="gap-2 p-6">
          <Text className="font-semibold text-foreground text-sm">{DRAWER_TITLE}</Text>
          <Text className="text-muted-foreground text-sm">{`Slides in from the ${side}. Tap outside to close.`}</Text>
        </View>
      </Drawer>
    </Playground>
  );
}

type DrawerDemoProps = { side: DrawerSide };

function DrawerDemo({ side }: DrawerDemoProps) {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);
  return (
    <View className="gap-3">
      <TriggerButton label={OPEN_LABEL} onPress={handleOpen} />
      <Drawer open={open} onOpenChange={setOpen} side={side} accessibilityLabel="Demo drawer">
        <View className="gap-2 p-6">
          <Text className="font-semibold text-foreground text-sm">{DRAWER_TITLE}</Text>
          <Text className="text-muted-foreground text-sm">{`Slides in from the ${side}. Tap outside to close.`}</Text>
        </View>
      </Drawer>
    </View>
  );
}

export default meta;

export const Interactive: Story = {
  render: () => <DrawerPlayground />,
};

export const Right: Story = {
  name: 'Demo: Open the drawer',
  render: () => <DrawerDemo side="right" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Tapping the trigger opens the drawer; its panel mounts in the RN Modal.
    await userEvent.click(await canvas.findByText(OPEN_LABEL));
    await expect(await screen.findByText(DRAWER_TITLE)).toBeTruthy();
  },
};
