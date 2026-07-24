import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ArrowRight, Download, Trash2 } from '../../lib/icons';
import { Text } from '../Text/text';
import { Button } from './button';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Continue', variant: 'primary', size: 'md', onPress: fn() },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'outline', 'danger', 'outlineDanger', 'ghostDanger', 'ghostPrimary'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
  },
} satisfies Meta<typeof Button>;

type Story = StoryObj<typeof meta>;

const SIZE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large' };
const CONTINUE_LABEL = 'Continue';
const DOWNLOAD_LABEL = 'Download';
const pressedLabel = (n: number) => `Pressed ${n} times`;

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ButtonPlayground(args: ComponentProps<typeof Button>) {
  const [count, setCount] = useState(0);
  const handlePress = useCallback(() => {
    setCount((n) => n + 1);
    args.onPress?.();
  }, [args.onPress]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Button {...args} onPress={handlePress} />
      <Text className="text-muted-foreground text-sm">{pressedLabel(count)}</Text>
    </View>
  );
}

export default meta;

export const Interactive: Story = {
  render: (args) => <ButtonPlayground {...args} />,
};

export const Primary: Story = {
  name: 'Demo: Press to confirm',
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
