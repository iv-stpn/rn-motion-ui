import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { Button } from '../Button/button';
import { BottomSheet } from './bottom-sheet';

const meta = {
  title: 'Components/BottomSheet',
  component: BottomSheet,
  parameters: { layout: 'centered' },
  args: { open: false, onOpenChange: fn(), snapPoints: [0.4, 0.85], defaultSnap: 0 },
} satisfies Meta<typeof BottomSheet>;

type Story = StoryObj<typeof meta>;

const ITEMS = ['Share', 'Duplicate', 'Move to folder', 'Rename', 'Archive', 'Delete'];

const OPEN_LABEL = 'Open bottom sheet';

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function BottomSheetDemo() {
  const [open, setOpen] = useState(false);
  const openSheet = useCallback(() => setOpen(true), []);
  return (
    <View style={{ gap: 12 }}>
      <Button onPress={openSheet}>{OPEN_LABEL}</Button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        snapPoints={[0.4, 0.85]}
        title="Quick actions"
        description="Tap the handle to expand. Tap outside to dismiss."
      >
        <View className="flex-col">
          {ITEMS.map((item) => (
            <View key={item} className="border-border border-b py-3">
              <Text className="text-foreground text-sm">{item}</Text>
            </View>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

export default meta;

export const Default: Story = {
  render: () => <BottomSheetDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Tapping the trigger opens the sheet; its content mounts in the RN Modal.
    await userEvent.click(await canvas.findByText(OPEN_LABEL));
    await expect(await screen.findByText('Quick actions')).toBeTruthy();
  },
};
