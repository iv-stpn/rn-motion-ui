import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Text } from '../Text/text';
import { CardChoice, CardChoiceGroup } from './card-choice';

const meta = {
  title: 'Components/CardChoice',
  component: CardChoice,
  parameters: { layout: 'centered' },
  args: { selected: false, title: 'Monthly', subtitle: '$12/mo', onPress: fn() },
} satisfies Meta<typeof CardChoice>;

type Story = StoryObj<typeof meta>;

const ROW_WIDTH = 480;
const NARROW_WIDTH = 240;
const MONTHLY_TITLE = 'Monthly';
const MONTHLY_SUB = '$12/mo';
const YEARLY_TITLE = 'Yearly';
const YEARLY_SUB = '$120/yr';
const YEARLY_BADGE = 'Save 20%';
const SEAT_TEXT = 'Includes 1 seat';
const handlePress = fn();

export default meta;

export const Default: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', gap: 12, width: ROW_WIDTH }}>
      <CardChoice selected={true} onPress={handlePress} subtitle={MONTHLY_SUB} title={MONTHLY_TITLE} numeric={true} />
      <CardChoice
        selected={false}
        onPress={handlePress}
        subtitle={YEARLY_SUB}
        title={YEARLY_TITLE}
        badge={YEARLY_BADGE}
        numeric={true}
      />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const radio = await canvas.findByText(YEARLY_TITLE);
    await userEvent.click(radio);
    await expect(handlePress).toHaveBeenCalled();
  },
};

export const SingleSelect: Story = {
  render: () => {
    const [plan, setPlan] = useState('monthly');
    return (
      <CardChoiceGroup value={plan} onValueChange={setPlan} style={{ width: ROW_WIDTH }}>
        <CardChoice value="monthly" subtitle={MONTHLY_SUB} title={MONTHLY_TITLE} numeric={true} />
        <CardChoice value="yearly" subtitle={YEARLY_SUB} title={YEARLY_TITLE} badge={YEARLY_BADGE} numeric={true} />
      </CardChoiceGroup>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The shared indicator glides to whichever card matches the group value.
    await userEvent.click(await canvas.findByText(YEARLY_TITLE));
    await expect(await canvas.findByText(YEARLY_TITLE)).toBeVisible();
    await userEvent.click(await canvas.findByText(MONTHLY_TITLE));
    await expect(await canvas.findByText(MONTHLY_TITLE)).toBeVisible();
  },
};

export const WithChildren: Story = {
  render: () => (
    <View style={{ width: NARROW_WIDTH }}>
      <CardChoice selected={false} onPress={handlePress} subtitle={MONTHLY_SUB} title={MONTHLY_TITLE}>
        <Text className="text-muted-foreground text-xs">{SEAT_TEXT}</Text>
      </CardChoice>
    </View>
  ),
};
