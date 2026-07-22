import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Text } from '../Text/text';
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

type Story = StoryObj<typeof meta>;

const EDIT_PROFILE = 'Edit profile';
const DIMENSIONS_TITLE = 'Dimensions';
const DIMENSIONS_DESC = 'Set the width and height for the layer.';
const SHOW_DETAILS = 'Show details';
const TOP_CENTER_DESC = 'Opens above the trigger, centered.';
const MORE_OPTIONS = 'More options';
const ALIGN_END_DESC = "Aligned to the trigger's end edge.";

export default meta;

export const Default: Story = {
  render: () => (
    <Popover side="bottom" align="start">
      <PopoverTrigger>{EDIT_PROFILE}</PopoverTrigger>
      <PopoverContent>
        <View style={{ gap: 4 }}>
          <Text className="font-medium text-foreground text-sm">{DIMENSIONS_TITLE}</Text>
          <Text className="text-muted-foreground text-xs">{DIMENSIONS_DESC}</Text>
        </View>
      </PopoverContent>
    </Popover>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Tapping the trigger opens the popover; its content mounts in the RN Modal.
    await userEvent.click(await canvas.findByText(EDIT_PROFILE));
    await expect(await screen.findByText(DIMENSIONS_TITLE)).toBeTruthy();
  },
};

export const TopCenter: Story = {
  render: () => (
    <Popover side="top" align="center">
      <PopoverTrigger>{SHOW_DETAILS}</PopoverTrigger>
      <PopoverContent>
        <Text className="text-foreground text-sm">{TOP_CENTER_DESC}</Text>
      </PopoverContent>
    </Popover>
  ),
};

export const AlignEnd: Story = {
  render: () => (
    <Popover side="bottom" align="end">
      <PopoverTrigger>{MORE_OPTIONS}</PopoverTrigger>
      <PopoverContent>
        <Text className="text-foreground text-sm">{ALIGN_END_DESC}</Text>
      </PopoverContent>
    </Popover>
  ),
};
