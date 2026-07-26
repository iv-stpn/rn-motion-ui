import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Section, Toggle } from '../../__stories__/story-harness';
import { Text } from '../Text/text';
import { CardChoice, CardChoiceGroup, type CardChoiceGroupProps } from './card-choice';

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
const LIFETIME_TITLE = 'Lifetime';
const LIFETIME_SUB = '$480 once';
const SEAT_TEXT = 'Includes 1 seat';
const TEAM_TEXT = 'Unlimited seats, priority support';
const handlePress = fn();

type Orientation = NonNullable<CardChoiceGroupProps['orientation']>;

const ORIENTATIONS = ['horizontal', 'vertical'] as const satisfies readonly Orientation[];

// biome-ignore lint/style/useComponentExportOnlyModules: story helper shared by the playground and the Demo stories
function CardChoiceGroupDemo() {
  const [plan, setPlan] = useState('monthly');
  return (
    <CardChoiceGroup onValueChange={setPlan} style={{ width: ROW_WIDTH }} value={plan}>
      <CardChoice numeric={true} subtitle={MONTHLY_SUB} title={MONTHLY_TITLE} value="monthly" />
      <CardChoice badge={YEARLY_BADGE} numeric={true} subtitle={YEARLY_SUB} title={YEARLY_TITLE} value="yearly" />
    </CardChoiceGroup>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function CardChoicePlayground() {
  const [plan, setPlan] = useState('yearly');
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [badges, setBadges] = useState(true);
  const [details, setDetails] = useState(false);
  const [numeric, setNumeric] = useState(true);

  return (
    <Playground style={{ width: ROW_WIDTH }}>
      <Controls>
        <Choice label="Orientation" onChange={setOrientation} options={ORIENTATIONS} value={orientation} />
        <Toggle label="Badges" onChange={setBadges} value={badges} />
        <Toggle label="Extra content" onChange={setDetails} value={details} />
        <Toggle label="Tabular figures" onChange={setNumeric} value={numeric} />
      </Controls>

      {/* Inside a group there is exactly one dot: it measures each card's radio
          ring and glides between them, so the ring's own border/padding never
          has to be guessed at. */}
      <CardChoiceGroup onValueChange={setPlan} orientation={orientation} value={plan}>
        <CardChoice numeric={numeric} subtitle={MONTHLY_SUB} title={MONTHLY_TITLE} value="monthly">
          {details ? <Text className="text-muted-foreground text-xs">{SEAT_TEXT}</Text> : null}
        </CardChoice>
        <CardChoice
          badge={badges ? YEARLY_BADGE : undefined}
          numeric={numeric}
          subtitle={YEARLY_SUB}
          title={YEARLY_TITLE}
          value="yearly"
        >
          {details ? <Text className="text-muted-foreground text-xs">{TEAM_TEXT}</Text> : null}
        </CardChoice>
        <CardChoice numeric={numeric} subtitle={LIFETIME_SUB} title={LIFETIME_TITLE} value="lifetime" />
      </CardChoiceGroup>
      <Note testID="story-plan">{plan}</Note>

      <View style={{ height: 12 }} />
      {/* Standalone, each card owns its own dot — no shared indicator, so the
          selection is whatever `selected` says. */}
      <Section title="Standalone (selected / unselected)">
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <CardChoice numeric={true} onPress={handlePress} selected={true} subtitle={MONTHLY_SUB} title={MONTHLY_TITLE} />
          <CardChoice
            badge={YEARLY_BADGE}
            numeric={true}
            onPress={handlePress}
            selected={false}
            subtitle={YEARLY_SUB}
            title={YEARLY_TITLE}
          />
        </View>
      </Section>

      <Section title="With custom content">
        <View style={{ width: NARROW_WIDTH }}>
          <CardChoice onPress={handlePress} selected={false} subtitle={MONTHLY_SUB} title={MONTHLY_TITLE}>
            <Text className="text-muted-foreground text-xs">{SEAT_TEXT}</Text>
          </CardChoice>
        </View>
      </Section>
    </Playground>
  );
}

export default meta;

/** A controlled group of three plans plus the standalone form. Flip the
 *  orientation to see the shared dot re-measure and glide along the other axis. */
export const Interactive: Story = { render: () => <CardChoicePlayground /> };

export const Default: Story = {
  name: 'Demo: Select a card',
  render: () => (
    <View style={{ flexDirection: 'row', gap: 12, width: ROW_WIDTH }}>
      <CardChoice numeric={true} onPress={handlePress} selected={true} subtitle={MONTHLY_SUB} title={MONTHLY_TITLE} />
      <CardChoice
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
  render: () => <CardChoiceGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The shared indicator glides to whichever card matches the group value.
    await userEvent.click(await canvas.findByText(YEARLY_TITLE));
    await expect(await canvas.findByText(YEARLY_TITLE)).toBeVisible();
    await userEvent.click(await canvas.findByText(MONTHLY_TITLE));
    await expect(await canvas.findByText(MONTHLY_TITLE)).toBeVisible();
  },
};
