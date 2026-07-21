import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { StarRating } from './star-rating';

const meta = {
  title: 'Components/StarRating',
  component: StarRating,
  parameters: { layout: 'centered' },
  args: { onValueChange: undefined },
} satisfies Meta<typeof StarRating>;

type Story = StoryObj<typeof meta>;
export default meta;

export const Default: Story = {};

export const WithValue: Story = { args: { showValue: true } };

export const Sizes: Story = {
  render: () => (
    <View style={{ gap: 16, alignItems: 'flex-start' }}>
      <StarRating size="sm" showValue={true} defaultValue={3} />
      <StarRating size="md" showValue={true} defaultValue={3} />
      <StarRating size="lg" showValue={true} defaultValue={3} />
    </View>
  ),
};

export const ReadOnly: Story = {
  render: () => (
    <View style={{ gap: 12, alignItems: 'flex-start' }}>
      <StarRating readOnly={true} value={3} />
      <StarRating readOnly={true} value={3.7} showValue={true} />
      <StarRating readOnly={true} value={4.3} showValue={true} max={10} />
    </View>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [rating, setRating] = useState(0);
    return <StarRating value={rating} onValueChange={setRating} showValue={true} />;
  },
};

export const NoClear: Story = { args: { allowClear: false, defaultValue: 3 } };

export const MaxTen: Story = { args: { max: 10, showValue: true } };
