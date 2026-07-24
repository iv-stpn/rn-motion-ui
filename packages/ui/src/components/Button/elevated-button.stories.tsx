import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ArrowRight, Download } from '../../lib/icons';
import { Text } from '../Text/text';
import { ElevatedButton } from './elevated-button';

const meta = {
  title: 'Components/ElevatedButton',
  component: ElevatedButton,
  parameters: { layout: 'centered' },
  args: { children: 'Continue', variant: 'neutral', size: 'md', onPress: fn() },
  argTypes: {
    variant: {
      control: 'select',
      options: ['neutral', 'danger', 'success', 'warning', 'info', 'white', 'gray'],
      description: 'Fill colour. Coloured fills get the gloss + rim + shadow; white/gray are flat plates.',
    },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
    shape: { control: 'select', options: ['rounded', 'pill'] },
  },
} satisfies Meta<typeof ElevatedButton>;

type Story = StoryObj<typeof meta>;

const VARIANTS = ['neutral', 'danger', 'success', 'warning', 'info', 'white', 'gray'] as const;
const VARIANT_LABELS: Record<(typeof VARIANTS)[number], string> = {
  neutral: 'Neutral',
  danger: 'Danger',
  success: 'Success',
  warning: 'Warning',
  info: 'Info',
  white: 'White',
  gray: 'Gray',
};
const SIZE_LABELS = { sm: 'Small', md: 'Medium', lg: 'Large' };
const CONTINUE_LABEL = 'Continue';
const DOWNLOAD_LABEL = 'Download';
const pressedLabel = (n: number) => `Pressed ${n} times`;

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ElevatedButtonPlayground(args: ComponentProps<typeof ElevatedButton>) {
  const [count, setCount] = useState(0);
  const handlePress = useCallback(() => {
    setCount((n) => n + 1);
    args.onPress?.();
  }, [args.onPress]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <ElevatedButton {...args} onPress={handlePress} />
      <Text className="text-muted-foreground text-sm">{pressedLabel(count)}</Text>
    </View>
  );
}

export default meta;

export const Interactive: Story = {
  render: (args) => <ElevatedButtonPlayground {...args} />,
};

// The glossy filled chip: white sheen + 1px rim highlight + a drop shadow whose
// ring is the fill darkened toward black. Hover lifts the gloss (.16 → .24).
export const Neutral: Story = {
  name: 'Demo: Press to confirm',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalled();
  },
};

// A stroke plate (light surface + muted label + 1px border, no gloss) that
// darkens and drops its shadow on hover.
export const White: Story = { args: { variant: 'white', children: 'White' } };

// Geist-style secondary plate: fixed #F2F2F2 fill, #707070 label, a 1px neutral
// ring plus a hairline white top sheen. No gloss, no hover shift.
export const Gray: Story = { args: { variant: 'gray', children: 'Gray' } };

export const Loading: Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Ripple: Story = { args: { ripple: true, children: 'Tap me' } };
export const Pill: Story = { args: { shape: 'pill', children: 'Pill shape' } };

export const Sizes: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <ElevatedButton {...args} size="sm">
        {SIZE_LABELS.sm}
      </ElevatedButton>
      <ElevatedButton {...args} size="md">
        {SIZE_LABELS.md}
      </ElevatedButton>
      <ElevatedButton {...args} size="lg">
        {SIZE_LABELS.lg}
      </ElevatedButton>
    </View>
  ),
};

export const WithIcons: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <ElevatedButton {...args} variant="neutral">
        {CONTINUE_LABEL}
        <ArrowRight size={16} color="#fafafa" />
      </ElevatedButton>
      <ElevatedButton {...args} variant="white">
        <Download size={16} color="#707070" />
        {DOWNLOAD_LABEL}
      </ElevatedButton>
    </View>
  ),
};

// Every fill side by side. `white` and `gray` sit at the end as the flat plates.
export const AllVariants: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      {VARIANTS.map((variant) => (
        <ElevatedButton {...args} key={variant} variant={variant}>
          {VARIANT_LABELS[variant]}
        </ElevatedButton>
      ))}
    </View>
  ),
};
