import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Note, Playground, Section, Toggle } from '../../../__stories__/story-harness';
import { Text } from '../../typography/Text/text';
import { CheckboxCard, CheckboxCardGroup, type CheckboxCardGroupProps } from './checkbox-card';

const meta = {
  title: 'Form/CheckboxCard',
  component: CheckboxCard,
  parameters: { layout: 'centered' },
  args: { isSelected: false, title: 'Priority support', subtitle: '$29/mo', onSelectedChange: fn() },
} satisfies Meta<typeof CheckboxCard>;

type Story = StoryObj<typeof meta>;

const ROW_WIDTH = 480;
const NARROW_WIDTH = 240;
const SEATS_TITLE = 'Extra seats';
const SEATS_SUB = '$4/mo each';
const SUPPORT_TITLE = 'Priority support';
const SUPPORT_SUB = '$29/mo';
const SUPPORT_BADGE = 'Popular';
const AUDIT_TITLE = 'Audit log';
const AUDIT_SUB = '$12/mo';
const SEATS_TEXT = 'Add teammates at any time';
const SUPPORT_TEXT = '24/7 response, 1 h SLA';
const handleChange = fn();

type Orientation = NonNullable<CheckboxCardGroupProps['orientation']>;

const ORIENTATIONS = ['horizontal', 'vertical'] as const satisfies readonly Orientation[];

function CheckboxCardGroupDemo() {
  const [addons, setAddons] = useState<string[]>(['support']);
  return (
    <CheckboxCardGroup onValueChange={setAddons} style={{ width: ROW_WIDTH }} value={addons}>
      <CheckboxCard numeric={true} subtitle={SEATS_SUB} title={SEATS_TITLE} value="seats" />
      <CheckboxCard badge={SUPPORT_BADGE} numeric={true} subtitle={SUPPORT_SUB} title={SUPPORT_TITLE} value="support" />
    </CheckboxCardGroup>
  );
}

function CheckboxCardPlayground() {
  const [addons, setAddons] = useState<string[]>(['support']);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [badges, setBadges] = useState(true);
  const [details, setDetails] = useState(false);
  const [numeric, setNumeric] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [elevationKey, setElevationKey] = useState<ElevationKey>('3');
  const [elevated, setElevated] = useState(true);

  return (
    <Playground className="w-120">
      <ControlCard title="Options">
        <Choice label="Orientation" onChange={setOrientation} options={ORIENTATIONS} value={orientation} />
        <Toggle label="Elevated" onChange={setElevated} value={elevated} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
        <Toggle label="Badges" onChange={setBadges} value={badges} />
        <Toggle label="Extra content" onChange={setDetails} value={details} />
        <Toggle label="Tabular figures" onChange={setNumeric} value={numeric} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
      </ControlCard>

      {/* Any number of cards can be checked, so each one animates its own box
          into the `info` accent. The group just owns the selected array. */}
      <CheckboxCardGroup
        elevated={elevated}
        elevation={ELEVATIONS[elevationKey]}
        isDisabled={disabled}
        onValueChange={setAddons}
        orientation={orientation}
        value={addons}
      >
        <CheckboxCard numeric={numeric} subtitle={SEATS_SUB} title={SEATS_TITLE} value="seats">
          {details ? <Text className="text-muted-foreground text-xs">{SEATS_TEXT}</Text> : null}
        </CheckboxCard>
        <CheckboxCard
          badge={badges ? SUPPORT_BADGE : undefined}
          numeric={numeric}
          subtitle={SUPPORT_SUB}
          title={SUPPORT_TITLE}
          value="support"
        >
          {details ? <Text className="text-muted-foreground text-xs">{SUPPORT_TEXT}</Text> : null}
        </CheckboxCard>
        <CheckboxCard numeric={numeric} subtitle={AUDIT_SUB} title={AUDIT_TITLE} value="audit" />
      </CheckboxCardGroup>
      <Note testID="story-addons">{addons.length > 0 ? addons.join(', ') : 'none'}</Note>

      <View className="h-3" />
      {/* Standalone, the card owns its state through isSelected/onSelectedChange
          — there is no group array to read from. */}
      <Section title="Standalone (checked / unchecked)">
        <View className="flex-row gap-3">
          <CheckboxCard
            elevated={elevated}
            elevation={ELEVATIONS[elevationKey]}
            isSelected={true}
            numeric={true}
            onSelectedChange={handleChange}
            subtitle={SEATS_SUB}
            title={SEATS_TITLE}
          />
          <CheckboxCard
            badge={SUPPORT_BADGE}
            elevated={elevated}
            elevation={ELEVATIONS[elevationKey]}
            isSelected={false}
            numeric={true}
            onSelectedChange={handleChange}
            subtitle={SUPPORT_SUB}
            title={SUPPORT_TITLE}
          />
        </View>
      </Section>

      <Section title="Disabled">
        <View className="flex-row gap-3">
          <CheckboxCard
            elevated={elevated}
            elevation={ELEVATIONS[elevationKey]}
            isDisabled={true}
            isSelected={true}
            numeric={true}
            onSelectedChange={handleChange}
            subtitle={SEATS_SUB}
            title={SEATS_TITLE}
          />
          <CheckboxCard
            elevated={elevated}
            elevation={ELEVATIONS[elevationKey]}
            isDisabled={true}
            isSelected={false}
            numeric={true}
            onSelectedChange={handleChange}
            subtitle={SUPPORT_SUB}
            title={SUPPORT_TITLE}
          />
        </View>
      </Section>

      <Section title="With custom content">
        <View style={{ width: NARROW_WIDTH }}>
          <CheckboxCard
            elevated={elevated}
            elevation={ELEVATIONS[elevationKey]}
            isSelected={false}
            onSelectedChange={handleChange}
            subtitle={SEATS_SUB}
            title={SEATS_TITLE}
          >
            <Text className="text-muted-foreground text-xs">{SEATS_TEXT}</Text>
          </CheckboxCard>
        </View>
      </Section>
    </Playground>
  );
}

export default meta;

/** Drive the group with the controls; the sections below hold the standalone,
 *  disabled and custom-content forms. Checking several cards at once is the
 *  point — unlike `RadioCard`, selecting one card leaves the others alone. */
export const Interactive: Story = { render: () => <CheckboxCardPlayground /> };

export const Default: Story = {
  name: 'Demo: Check a card',
  render: () => (
    <View className="flex-row gap-3" style={{ width: ROW_WIDTH }}>
      <CheckboxCard isSelected={true} numeric={true} onSelectedChange={handleChange} subtitle={SEATS_SUB} title={SEATS_TITLE} />
      <CheckboxCard
        badge={SUPPORT_BADGE}
        isSelected={false}
        numeric={true}
        onSelectedChange={handleChange}
        subtitle={SUPPORT_SUB}
        title={SUPPORT_TITLE}
      />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Each card answers `checkbox` and is named by its title, so the a11y
    // contract is queryable rather than eyeballed.
    const card = await canvas.findByRole('checkbox', { name: SUPPORT_TITLE });
    await userEvent.click(card);
    await expect(handleChange).toHaveBeenCalledWith(true);
  },
};

export const MultiSelect: Story = {
  name: 'Demo: Check several, then uncheck',
  render: () => <CheckboxCardGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const seats = await canvas.findByRole('checkbox', { name: SEATS_TITLE });
    const support = await canvas.findByRole('checkbox', { name: SUPPORT_TITLE });
    // Support starts checked; adding seats keeps it checked — that's the whole
    // difference from the radio group, where selecting one clears the other.
    await userEvent.click(seats);
    await expect(seats).toHaveAttribute('aria-checked', 'true');
    await expect(support).toHaveAttribute('aria-checked', 'true');
    // Clicking a checked card removes it from the array rather than doing nothing.
    await userEvent.click(support);
    await expect(support).toHaveAttribute('aria-checked', 'false');
    await expect(seats).toHaveAttribute('aria-checked', 'true');
  },
};
