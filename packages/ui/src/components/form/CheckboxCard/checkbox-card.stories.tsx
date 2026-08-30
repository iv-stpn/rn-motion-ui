import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Note, Playground, Section, Toggle } from '../../../__stories__/story-harness';
import { Text } from '../../typography/Text/text';
import { CheckboxCard, CheckboxCardGroup, type CheckboxCardGroupProps, type CheckboxCardProps } from './checkbox-card';

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
type Layout = NonNullable<CheckboxCardGroupProps['layout']>;
type Tone = NonNullable<CheckboxCardProps['tone']>;
type Variant = NonNullable<CheckboxCardProps['variant']>;

const ORIENTATIONS = ['horizontal', 'vertical'] as const satisfies readonly Orientation[];
// Two independent axes: `orientation` lays the cards out, `layout` lays each
// card's own contents out. Flip both in the playground to see they compose.
const LAYOUTS = ['stacked', 'inline'] as const satisfies readonly Layout[];
// The selection accent: `neutral` (primary) vs `info` (blue).
const TONES = ['neutral', 'info'] as const satisfies readonly Tone[];
// Whether the box + mark indicator shows, or the border alone carries selection.
const VARIANTS = ['checkbox', 'card'] as const satisfies readonly Variant[];

function CheckboxCardGroupDemo() {
  const [addons, setAddons] = useState<string[]>(['support']);
  return (
    <CheckboxCardGroup onValueChange={setAddons} style={{ width: ROW_WIDTH }} value={addons}>
      <CheckboxCard numeric={true} subtitle={SEATS_SUB} title={SEATS_TITLE} value="seats" />
      <CheckboxCard badge={SUPPORT_BADGE} numeric={true} subtitle={SUPPORT_SUB} title={SUPPORT_TITLE} value="support" />
    </CheckboxCardGroup>
  );
}

/** Inline cards in a vertical group — the settings-list shape the layout exists
 *  for: text on the left, box on the trailing edge, one row per option. */
function CheckboxCardInlineDemo() {
  const [addons, setAddons] = useState<string[]>([]);
  return (
    <CheckboxCardGroup
      layout="inline"
      onValueChange={setAddons}
      orientation="vertical"
      style={{ width: ROW_WIDTH }}
      value={addons}
    >
      <CheckboxCard numeric={true} subtitle={SEATS_SUB} title={SEATS_TITLE} value="seats" />
      <CheckboxCard badge={SUPPORT_BADGE} numeric={true} subtitle={SUPPORT_SUB} title={SUPPORT_TITLE} value="support" />
    </CheckboxCardGroup>
  );
}

function CheckboxCardPlayground() {
  const [addons, setAddons] = useState<string[]>(['support']);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [layout, setLayout] = useState<Layout>('stacked');
  const [tone, setTone] = useState<Tone>('neutral');
  const [variant, setVariant] = useState<Variant>('checkbox');
  const [badges, setBadges] = useState(true);
  const [details, setDetails] = useState(false);
  const [numeric, setNumeric] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [elevationKey, setElevationKey] = useState<ElevationKey>('3');
  const [floating, setFloating] = useState(false);

  return (
    <Playground className="w-120">
      <ControlCard title="Options">
        <Choice label="Orientation" onChange={setOrientation} options={ORIENTATIONS} value={orientation} />
        <Choice label="Layout" onChange={setLayout} options={LAYOUTS} value={layout} />
        <Choice label="Tone" onChange={setTone} options={TONES} value={tone} />
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Toggle label="Floating" onChange={setFloating} value={floating} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
        <Toggle label="Badges" onChange={setBadges} value={badges} />
        <Toggle label="Extra content" onChange={setDetails} value={details} />
        <Toggle label="Tabular figures" onChange={setNumeric} value={numeric} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
      </ControlCard>

      {/* Any number of cards can be checked, so each one animates its own box
          into the selected tone's accent. The group just owns the selected array. */}
      <CheckboxCardGroup
        floating={floating}
        elevation={ELEVATIONS[elevationKey]}
        isDisabled={disabled}
        layout={layout}
        onValueChange={setAddons}
        orientation={orientation}
        tone={tone}
        value={addons}
        variant={variant}
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
            floating={floating}
            elevation={ELEVATIONS[elevationKey]}
            isSelected={true}
            numeric={true}
            onSelectedChange={handleChange}
            subtitle={SEATS_SUB}
            title={SEATS_TITLE}
            tone={tone}
            variant={variant}
          />
          <CheckboxCard
            badge={SUPPORT_BADGE}
            floating={floating}
            elevation={ELEVATIONS[elevationKey]}
            isSelected={false}
            numeric={true}
            onSelectedChange={handleChange}
            subtitle={SUPPORT_SUB}
            title={SUPPORT_TITLE}
            tone={tone}
            variant={variant}
          />
        </View>
      </Section>

      <Section title="Disabled">
        <View className="flex-row gap-3">
          <CheckboxCard
            floating={floating}
            elevation={ELEVATIONS[elevationKey]}
            isDisabled={true}
            isSelected={true}
            numeric={true}
            onSelectedChange={handleChange}
            subtitle={SEATS_SUB}
            title={SEATS_TITLE}
            tone={tone}
            variant={variant}
          />
          <CheckboxCard
            floating={floating}
            elevation={ELEVATIONS[elevationKey]}
            isDisabled={true}
            isSelected={false}
            numeric={true}
            onSelectedChange={handleChange}
            subtitle={SUPPORT_SUB}
            title={SUPPORT_TITLE}
            tone={tone}
            variant={variant}
          />
        </View>
      </Section>

      <Section title="With custom content">
        <View style={{ width: NARROW_WIDTH }}>
          <CheckboxCard
            floating={floating}
            elevation={ELEVATIONS[elevationKey]}
            isSelected={false}
            onSelectedChange={handleChange}
            subtitle={SEATS_SUB}
            title={SEATS_TITLE}
            tone={tone}
            variant={variant}
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

export const Inline: Story = {
  name: 'Demo: Inline layout',
  render: () => <CheckboxCardInlineDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Moving the box to the trailing edge is presentation only: the card is
    // still one checkbox named by its title, and still toggles on press.
    const support = await canvas.findByRole('checkbox', { name: SUPPORT_TITLE });
    await expect(support).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(support);
    await expect(support).toHaveAttribute('aria-checked', 'true');
    // The badge follows the title inline rather than riding the box's row, but
    // it keeps its derived testID either way.
    await expect(await canvas.findByTestId('checkbox-card-group-card-support-badge')).toBeVisible();
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

export const CardVariant: Story = {
  name: 'Demo: Border-only (variant="card")',
  render: () => (
    <CheckboxCardGroup defaultValue={['support']} style={{ width: ROW_WIDTH }} variant="card">
      <CheckboxCard numeric={true} subtitle={SEATS_SUB} title={SEATS_TITLE} value="seats" />
      <CheckboxCard badge={SUPPORT_BADGE} numeric={true} subtitle={SUPPORT_SUB} title={SUPPORT_TITLE} value="support" />
    </CheckboxCardGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // variant="card" drops the box and its mark, so the derived -control/-check
    // testIDs never render and the border + tint carry selection alone.
    const support = await canvas.findByRole('checkbox', { name: SUPPORT_TITLE });
    await expect(support).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.queryByTestId('checkbox-card-group-card-support-control')).toBeNull();
    await expect(canvas.queryByTestId('checkbox-card-group-card-support-check')).toBeNull();
    // Toggling still works without the indicator.
    const seats = await canvas.findByRole('checkbox', { name: SEATS_TITLE });
    await userEvent.click(seats);
    await expect(seats).toHaveAttribute('aria-checked', 'true');
  },
};
