import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ArrowRight, Download, Trash2 } from '../../lib/icons';
import { Button } from './button';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Continue', variant: 'primary', size: 'md', onPress: fn() },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'outline'] },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
  },
} satisfies Meta<typeof Button>;

type Story = StoryObj<typeof meta>;

const SIZE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large' };
const CONTINUE_LABEL = 'Continue';
const DOWNLOAD_LABEL = 'Download';

export default meta;

export const Primary: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalled();
  },
};

export const Secondary: Story = { args: { variant: 'secondary', children: 'Download' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'Ghost' } };
export const Outline: Story = { args: { variant: 'outline', children: 'Outline' } };
export const Loading: Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Ripple: Story = { args: { ripple: true, children: 'Tap me' } };
export const Pill: Story = { args: { shape: 'pill', children: 'Pill shape' } };

export const Sizes: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Button {...args} size="sm">
        {SIZE_LABELS.sm}
      </Button>
      <Button {...args} size="md">
        {SIZE_LABELS.md}
      </Button>
      <Button {...args} size="lg">
        {SIZE_LABELS.lg}
      </Button>
    </View>
  ),
};

export const WithIcons: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Button {...args} variant="primary">
        {CONTINUE_LABEL}
        <ArrowRight size={16} color="#fafafa" />
      </Button>
      <Button {...args} variant="secondary">
        <Download size={16} color="#111111" />
        {DOWNLOAD_LABEL}
      </Button>
      <Button {...args} variant="secondary" size="icon" accessibilityLabel="Delete">
        <Trash2 size={16} color="#111111" />
      </Button>
    </View>
  ),
};
