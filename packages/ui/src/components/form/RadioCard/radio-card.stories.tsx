import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Section, Toggle } from '../../../__stories__/story-harness';
import { Text } from '../../typography/Text/text';
import { RadioCard, RadioCardGroup, type RadioCardGroupProps, type RadioCardProps } from './radio-card';

type RadioCardVariant = NonNullable<RadioCardProps['variant']>;

const meta = {
  title: 'Form/RadioCard',
  component: RadioCard,
  parameters: { layout: 'centered' },
  args: { selected: false, title: 'Monthly', subtitle: '$12/mo', onPress: fn() },
} satisfies Meta<typeof RadioCard>;

type Story = StoryObj<typeof meta>;

const MONTHLY_TITLE = 'Monthly';
const MONTHLY_SUB = '$12/mo';
const YEARLY_TITLE = 'Yearly';
const YEARLY_SUB = '$120/yr';
const YEARLY_BADGE = 'Save 20%';
const LIFETIME_TITLE = 'Lifetime';
const LIFETIME_SUB = '$480 once';
const SEAT_TEXT = 'Includes 1 seat';
const TEAM_TEXT = 'Unlimited seats, priority support';
const handlePress = fn();

type Orientation = NonNullable<RadioCardGroupProps['orientation']>;

const ORIENTATIONS = ['horizontal', 'vertical'] as const satisfies readonly Orientation[];

const VARIANTS: RadioCardVariant[] = ['radio', 'card'];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper shared by the playground and the Demo stories
function RadioCardGroupDemo() {
  const [plan, setPlan] = useState('monthly');
  return (
    <RadioCardGroup onValueChange={setPlan} className="w-120" value={plan}>
      <RadioCard numeric={true} subtitle={MONTHLY_SUB} title={MONTHLY_TITLE} value="monthly" />
      <RadioCard badge={YEARLY_BADGE} numeric={true} subtitle={YEARLY_SUB} title={YEARLY_TITLE} value="yearly" />
    </RadioCardGroup>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function RadioCardPlayground() {
  const [plan, setPlan] = useState('yearly');
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [badges, setBadges] = useState(true);
  const [details, setDetails] = useState(false);
  const [numeric, setNumeric] = useState(true);
  const [variant, setVariant] = useState<RadioCardVariant>('radio');

  return (
    <Playground className="w-120">
      <ControlCard title="Options">
        <Choice label="Orientation" onChange={setOrientation} options={ORIENTATIONS} value={orientation} />
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Toggle label="Badges" onChange={setBadges} value={badges} />
        <Toggle label="Extra content" onChange={setDetails} value={details} />
        <Toggle label="Tabular figures" onChange={setNumeric} value={numeric} />
      </ControlCard>

      {/* Each card animates its own selection: the border and tint cross-fade
          and the dot fades and scales in place. Nothing travels between cards,
          so no geometry is measured. */}
      <RadioCardGroup onValueChange={setPlan} orientation={orientation} value={plan} variant={variant}>
        <RadioCard numeric={numeric} subtitle={MONTHLY_SUB} title={MONTHLY_TITLE} value="monthly">
          {details ? <Text className="text-muted-foreground text-xs">{SEAT_TEXT}</Text> : null}
        </RadioCard>
        <RadioCard
          badge={badges ? YEARLY_BADGE : undefined}
          numeric={numeric}
          subtitle={YEARLY_SUB}
          title={YEARLY_TITLE}
          value="yearly"
        >
          {details ? <Text className="text-muted-foreground text-xs">{TEAM_TEXT}</Text> : null}
        </RadioCard>
        <RadioCard numeric={numeric} subtitle={LIFETIME_SUB} title={LIFETIME_TITLE} value="lifetime" />
      </RadioCardGroup>
      <Note testID="story-plan">{plan}</Note>

      <View className="h-3" />
      {/* Standalone the card reads `selected` directly instead of a group value;
          the animation is the same. */}
      <Section title="Standalone (selected / unselected)">
        <View className="flex-row gap-3">
          <RadioCard
            numeric={true}
            onPress={handlePress}
            selected={true}
            subtitle={MONTHLY_SUB}
            title={MONTHLY_TITLE}
            variant={variant}
          />
          <RadioCard
            badge={YEARLY_BADGE}
            numeric={true}
            onPress={handlePress}
            selected={false}
            subtitle={YEARLY_SUB}
            title={YEARLY_TITLE}
            variant={variant}
          />
        </View>
      </Section>

      <Section title="With custom content">
        <View className="w-60">
          <RadioCard onPress={handlePress} selected={false} subtitle={MONTHLY_SUB} title={MONTHLY_TITLE} variant={variant}>
            <Text className="text-muted-foreground text-xs">{SEAT_TEXT}</Text>
          </RadioCard>
        </View>
      </Section>
    </Playground>
  );
}

export default meta;

/** A controlled group of three plans plus the standalone form. Switch cards to
 *  see the outgoing border and dot fade out as the incoming pair fades in. */
export const Interactive: Story = { render: () => <RadioCardPlayground /> };

export const Default: Story = {
  name: 'Demo: Select a card',
  render: () => (
    <View className="w-120 flex-row gap-3">
      <RadioCard numeric={true} onPress={handlePress} selected={true} subtitle={MONTHLY_SUB} title={MONTHLY_TITLE} />
      <RadioCard
        badge={YEARLY_BADGE}
        numeric={true}
        onPress={handlePress}
        selected={false}
        subtitle={YEARLY_SUB}
        title={YEARLY_TITLE}
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
  name: 'Demo: Switch selection',
  render: () => <RadioCardGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const monthly = await canvas.findByTestId('radio-card-group-card-monthly');
    const yearly = await canvas.findByTestId('radio-card-group-card-yearly');
    await expect(monthly).toHaveAttribute('aria-checked', 'true');

    // Selection is per-card state now — the checked flag moves between the cards
    // and each one cross-fades its own border and dot.
    await userEvent.click(yearly);
    await expect(yearly).toHaveAttribute('aria-checked', 'true');
    await expect(monthly).toHaveAttribute('aria-checked', 'false');
    await expect(await canvas.findByTestId('radio-card-group-card-yearly-dot')).toBeVisible();

    await userEvent.click(monthly);
    await expect(monthly).toHaveAttribute('aria-checked', 'true');
    await expect(yearly).toHaveAttribute('aria-checked', 'false');
  },
};
