import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { Text } from '../Text/text';
import { Card } from './card';

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: { layout: 'centered' },
  args: { size: 'md', variant: 'border' },
  argTypes: {
    size: { control: 'select', options: ['compact', 'md', 'lg'] },
    variant: { control: 'select', options: ['border', 'filled'] },
  },
} satisfies Meta<typeof Card>;

type Story = StoryObj<typeof meta>;

const CARD_WIDTH = 280;
const DEFAULT_TITLE = 'Card title';
const DEFAULT_BODY = 'A container for grouping related content.';
const COMPACT_LABEL = 'Compact';
const MEDIUM_LABEL = 'Medium';
const LARGE_LABEL = 'Large';
const BORDER_LABEL = 'Border';
const FILLED_LABEL = 'Filled';

export default meta;

export const Default: Story = {
  render: (args) => (
    <Card {...args} style={{ width: CARD_WIDTH }}>
      <Text className="font-semibold text-base text-foreground">{DEFAULT_TITLE}</Text>
      <Text className="text-muted-foreground text-sm">{DEFAULT_BODY}</Text>
    </Card>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <View style={{ alignItems: 'stretch', flexDirection: 'column', gap: 12 }}>
      <Card {...args} size="compact" style={{ width: CARD_WIDTH }}>
        <Text className="font-semibold text-foreground text-sm">{COMPACT_LABEL}</Text>
      </Card>
      <Card {...args} size="md" style={{ width: CARD_WIDTH }}>
        <Text className="font-semibold text-foreground text-sm">{MEDIUM_LABEL}</Text>
      </Card>
      <Card {...args} size="lg" style={{ width: CARD_WIDTH }}>
        <Text className="font-semibold text-foreground text-sm">{LARGE_LABEL}</Text>
      </Card>
    </View>
  ),
};

export const Variants: Story = {
  render: (args) => (
    <View style={{ alignItems: 'stretch', flexDirection: 'column', gap: 12 }}>
      <Card {...args} variant="border" style={{ width: CARD_WIDTH }}>
        <Text className="font-semibold text-foreground text-sm">{BORDER_LABEL}</Text>
      </Card>
      <Card {...args} variant="filled" style={{ width: CARD_WIDTH }}>
        <Text className="font-semibold text-foreground text-sm">{FILLED_LABEL}</Text>
      </Card>
    </View>
  ),
};
