import type { Meta, StoryObj } from '@storybook/react';
import { Text, View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const meta = {
  title: 'Components/Popover',
  component: Popover,
  parameters: { layout: 'centered' },
  // Render-only stories supply their own trees; this satisfies the required prop.
  args: { children: null },
  argTypes: {
    side: { control: 'select', options: ['top', 'bottom'] },
    align: { control: 'select', options: ['start', 'center', 'end'] },
  },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover side="bottom" align="start">
      <PopoverTrigger>Edit profile</PopoverTrigger>
      <PopoverContent>
        <View style={{ gap: 4 }}>
          <Text className="text-sm font-medium text-foreground">Dimensions</Text>
          <Text className="text-xs text-muted-foreground">Set the width and height for the layer.</Text>
        </View>
      </PopoverContent>
    </Popover>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Tapping the trigger opens the popover; its content mounts in the RN Modal.
    await userEvent.click(await canvas.findByText('Edit profile'));
    await expect(await screen.findByText('Dimensions')).toBeTruthy();
  },
};

export const TopCenter: Story = {
  render: () => (
    <Popover side="top" align="center">
      <PopoverTrigger>Show details</PopoverTrigger>
      <PopoverContent>
        <Text className="text-sm text-foreground">Opens above the trigger, centered.</Text>
      </PopoverContent>
    </Popover>
  ),
};

export const AlignEnd: Story = {
  render: () => (
    <Popover side="bottom" align="end">
      <PopoverTrigger>More options</PopoverTrigger>
      <PopoverContent>
        <Text className="text-sm text-foreground">Aligned to the trigger's end edge.</Text>
      </PopoverContent>
    </Popover>
  ),
};
