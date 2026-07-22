import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { Text } from './text';

const meta = {
  title: 'Components/Text',
  component: Text,
  parameters: { layout: 'centered' },
  args: { weight: 'normal', size: 'base', children: 'The quick brown fox jumps over the lazy dog' },
  argTypes: {
    weight: { control: 'select', options: ['normal', 'medium', 'semibold', 'bold'] },
    size: { control: 'select', options: ['xs', 'sm', 'base', 'lg', 'xl', '2xl'] },
    numeric: { control: 'boolean' },
  },
} satisfies Meta<typeof Text>;

type Story = StoryObj<typeof meta>;

const WEIGHTS = ['normal', 'medium', 'semibold', 'bold'] as const;
const SIZES = ['xs', 'sm', 'base', 'lg', 'xl', '2xl'] as const;
const PANGRAM = 'The quick brown fox jumps over the lazy dog';
const AMOUNTS = ['$1,234.50', '$42.00', '$999.99', '$12,345.67'];
const PROPORTIONAL_LABEL = 'proportional';
const NUMERIC_LABEL = 'numeric';

export default meta;

export const Default: Story = {};

export const Weights: Story = {
  render: (args) => (
    <View style={{ gap: 16, alignItems: 'flex-start' }}>
      {WEIGHTS.map((weight) => (
        <View key={weight} style={{ gap: 4 }}>
          <Text {...args} weight={weight} size="2xl">
            {PANGRAM}
          </Text>
          <Text size="xs" className="text-muted-foreground">
            {weight}
          </Text>
        </View>
      ))}
    </View>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <View style={{ gap: 12, alignItems: 'flex-start' }}>
      {SIZES.map((size) => (
        <Text {...args} key={size} size={size}>
          {PANGRAM}
        </Text>
      ))}
    </View>
  ),
};

export const Numeric: Story = {
  render: (args) => (
    <View style={{ gap: 24, flexDirection: 'row' }}>
      <View style={{ gap: 6, alignItems: 'flex-start' }}>
        <Text {...args} size="xs" className="text-muted-foreground" numeric={false}>
          {PROPORTIONAL_LABEL}
        </Text>
        {AMOUNTS.map((amount) => (
          <Text {...args} key={amount} size="2xl" numeric={false}>
            {amount}
          </Text>
        ))}
      </View>
      <View style={{ gap: 6, alignItems: 'flex-start' }}>
        <Text {...args} size="xs" className="text-muted-foreground" numeric={true}>
          {NUMERIC_LABEL}
        </Text>
        {AMOUNTS.map((amount) => (
          <Text {...args} key={amount} size="2xl" numeric={true}>
            {amount}
          </Text>
        ))}
      </View>
    </View>
  ),
};
