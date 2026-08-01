import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
import { DirectionProvider } from '../../hooks/direction-provider';
import { Text } from '../Text/text';
import { Tabs, TabsContent, TabsList, type TabsProps, TabsTrigger } from './tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  parameters: { layout: 'centered' },
  // Render-only stories supply their own trees; this satisfies the required prop.
  args: { children: null },
  argTypes: {
    variant: { control: 'select', options: ['pill', 'underline', 'segment'] },
    contentAnimation: { control: 'select', options: ['fade', 'slide', 'dropIn'] },
  },
} satisfies Meta<typeof Tabs>;

type Story = StoryObj<typeof meta>;

type Variant = NonNullable<TabsProps['variant']>;
type ContentAnimation = NonNullable<TabsProps['contentAnimation']>;

const VARIANTS = ['pill', 'underline', 'segment'] as const satisfies readonly Variant[];
const CONTENT_ANIMATIONS = ['fade', 'slide', 'dropIn'] as const satisfies readonly ContentAnimation[];

const TAB_OVERVIEW = 'Overview';
const TAB_ACTIVITY = 'Activity';
const TAB_SETTINGS = 'Settings';
const OVERVIEW_SUMMARY = 'High-level summary.';
const ACTIVITY_EVENTS = 'Recent events.';
const SETTINGS_PREFS = 'Preferences.';
const PANELS = [
  { value: 'overview', label: TAB_OVERVIEW, body: OVERVIEW_SUMMARY, detail: 'Totals for the current billing period.' },
  { value: 'activity', label: TAB_ACTIVITY, body: ACTIVITY_EVENTS, detail: 'Everything that happened in the last 24 hours.' },
  { value: 'settings', label: TAB_SETTINGS, body: SETTINGS_PREFS, detail: 'Notifications, members and billing.' },
] as const;

/** Width of the modal-shaped sample — wide enough for a full-width slide to read as a page swap. */
const MODAL_WIDTH = 320;

type PanelTabsProps = {
  variant?: Variant;
  contentAnimation?: ContentAnimation;
  defaultValue?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Adds a second line per panel, so a sliding page has some body to it. */
  detailed?: boolean;
};

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function PanelTabs({ variant = 'pill', contentAnimation, defaultValue = 'overview', testID, style, detailed }: PanelTabsProps) {
  return (
    <Tabs contentAnimation={contentAnimation} defaultValue={defaultValue} style={style} testID={testID} variant={variant}>
      <TabsList>
        {PANELS.map((panel) => (
          <TabsTrigger key={panel.value} value={panel.value}>
            {panel.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {PANELS.map((panel) => (
        <TabsContent key={panel.value} value={panel.value}>
          <Text className="text-muted-foreground text-sm">{panel.body}</Text>
          {detailed ? <Text className="text-muted-foreground text-xs">{panel.detail}</Text> : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * The three panel animations, and the one sample where `slide` is meant to be
 * used. Each sample only animates on a tab switch, so these have to be clicked
 * to be seen — a static screenshot of them is three identical panels.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ContentAnimationSections() {
  return (
    <>
      {/* `fade` and `dropIn` are enter-only — the outgoing panel just unmounts, so
          what you're picking is how the incoming one arrives. `slide` is the one to
          watch both halves of: the panel you leave is pushed out the other way. */}
      <Section title="Content animations">
        <Variants direction="column">
          {CONTENT_ANIMATIONS.map((name) => (
            <Sample key={name} label={name}>
              <PanelTabs contentAnimation={name} />
            </Sample>
          ))}
        </Variants>
      </Section>

      {/* `slide` travels a full container width, so it needs a container to read
          against — a fixed width stands in for the modal or phone screen it's for. */}
      <Section title="Slide at modal width">
        <Sample label="segment · slide · 320 px">
          <PanelTabs contentAnimation="slide" detailed={true} style={{ width: MODAL_WIDTH }} variant="segment" />
        </Sample>
      </Section>
    </>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function TabsPlayground() {
  const [variant, setVariant] = useState<Variant>('pill');
  const [animation, setAnimation] = useState<ContentAnimation>('fade');
  const [withPanels, setWithPanels] = useState(true);
  const [tab, setTab] = useState('overview');

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Choice label="Content animation" onChange={setAnimation} options={CONTENT_ANIMATIONS} value={animation} />
        <Toggle label="Content panels" onChange={setWithPanels} value={withPanels} />
      </ControlCard>

      <View className="gap-2">
        <Tabs contentAnimation={animation} onValueChange={setTab} value={tab} variant={variant}>
          <TabsList>
            {PANELS.map((panel) => (
              <TabsTrigger key={panel.value} value={panel.value}>
                {panel.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {withPanels
            ? PANELS.map((panel) => (
                <TabsContent key={panel.value} value={panel.value}>
                  <Text className="text-muted-foreground text-sm">{panel.body}</Text>
                </TabsContent>
              ))
            : null}
        </Tabs>
        <Note testID="story-selected-tab">{`Selected: ${tab}`}</Note>
      </View>

      {/* The indicator is the whole point of the variants: a sliding pill, a
          sliding underline, or a segmented plate. Same tree, three treatments. */}
      <Section title="Variants">
        <Variants direction="column">
          {VARIANTS.map((name) => (
            <Sample key={name} label={name}>
              <Tabs defaultValue="overview" variant={name}>
                <TabsList>
                  {PANELS.map((panel) => (
                    <TabsTrigger key={panel.value} value={panel.value}>
                      {panel.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </Sample>
          ))}
        </Variants>
      </Section>

      <ContentAnimationSections />
    </Playground>
  );
}

const DIRECTION_STYLES = { ltr: { direction: 'ltr' }, rtl: { direction: 'rtl' } } as const;

type DirectionalTabsProps = { direction: 'ltr' | 'rtl'; animation?: ContentAnimation };

/** One Tabs tree under a stated writing direction, with everything addressable. */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function DirectionalTabs({ direction, animation }: DirectionalTabsProps) {
  return (
    <DirectionProvider value={direction}>
      <View style={DIRECTION_STYLES[direction]}>
        <Tabs contentAnimation={animation} defaultValue="overview" style={{ width: MODAL_WIDTH }} variant="segment">
          <TabsList testID={`${direction}-list`}>
            {PANELS.map((panel) => (
              <TabsTrigger key={panel.value} testID={`${direction}-trigger-${panel.value}`} value={panel.value}>
                {panel.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {PANELS.map((panel) => (
            <TabsContent key={panel.value} value={panel.value}>
              <Text className="text-muted-foreground text-sm">{panel.body}</Text>
            </TabsContent>
          ))}
        </Tabs>
      </View>
    </DirectionProvider>
  );
}

export default meta;

/** All three indicator treatments and all three panel animations, with or without
 *  content panels. The live set at the top is controlled, so the readout tracks
 *  whatever you select. */
export const Interactive: Story = { render: () => <TabsPlayground /> };

export const Pill: Story = {
  name: 'Demo: Switch tabs',
  render: () => <PanelTabs testID="tabs" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Switching tabs swaps the visible content panel.
    await expect(canvas.getByText(OVERVIEW_SUMMARY)).toBeInTheDocument();
    await userEvent.click(canvas.getByText(TAB_ACTIVITY));
    await expect(await canvas.findByText(ACTIVITY_EVENTS)).toBeInTheDocument();
  },
};

export const PreSelectedTab: Story = {
  name: 'Demo: Pre-selected (non-first tab)',
  render: () => <PanelTabs defaultValue="settings" testID="tabs" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Indicator should appear directly on the third tab — no slide-in from tab 1.
    await expect(canvas.getByText(SETTINGS_PREFS)).toBeInTheDocument();
  },
};

export const SlideBothDirections: Story = {
  name: 'Demo: Slide (both directions)',
  render: () => (
    <PanelTabs contentAnimation="slide" detailed={true} style={{ width: MODAL_WIDTH }} testID="tabs" variant="segment" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Forward then back: the panel travels a full width in from whichever side the
    // selection moved towards, and both directions have to land on the right content.
    // The panel is also clipped while it travels, so the assertions double as a check
    // that the clip doesn't hide the content it lands on.
    await userEvent.click(canvas.getByText(TAB_SETTINGS));
    await expect(await canvas.findByText(SETTINGS_PREFS)).toBeInTheDocument();
    await userEvent.click(canvas.getByText(TAB_OVERVIEW));
    await expect(await canvas.findByText(OVERVIEW_SUMMARY)).toBeInTheDocument();
    // The panel being pushed out stays mounted for the length of the push, so the
    // one thing worth pinning down is that it does leave: a push-out layer that
    // never unmounts would keep a stale panel (and its effects) alive for good.
    await waitFor(() => expect(canvas.queryByText(SETTINGS_PREFS)).toBeNull());
  },
};

/**
 * Tabs needs no direction-aware code, and this is what says so.
 *
 * Both moving parts are computed from *measured* geometry rather than from
 * declaration order: the indicator glides to the active trigger's `layout.x`,
 * and the slide direction is `to.x < from.x`. Layout `x` and `translateX` are
 * both physical on both platforms, so when the platform mirrors the trigger row
 * the measurements mirror with it and the arithmetic comes out right for free.
 *
 * That is worth pinning rather than trusting, because the obvious "fix" breaks
 * it: negating the indicator's `translateX` under RTL — which looks like
 * exactly the mirroring every other direction-aware component needs — flips an
 * offset that was already correct and lands the pill on the wrong tab. Verified
 * by mutation: that change fails this story and leaves every other Tabs test
 * passing, which is precisely why the RTL case needs its own.
 */
export const RightToLeft: Story = {
  name: 'Demo: Indicator tracks in RTL',
  render: () => (
    <View className="gap-6">
      <DirectionalTabs direction="ltr" />
      <DirectionalTabs direction="rtl" />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = async (testID: string) => (await canvas.findByTestId(testID)).getBoundingClientRect();
    // Indicator and trigger are separate boxes that must coincide; a pixel of
    // sub-pixel rounding between them is not a failure.
    const coincide = (a: DOMRect, b: DOMRect) => Math.abs(a.left - b.left) <= 1.5 && Math.abs(a.right - b.right) <= 1.5;

    // First, prove the harness actually flipped the layout — otherwise every
    // assertion below would pass just as well against an LTR canvas.
    const ltrList = await box('ltr-list');
    const rtlList = await box('rtl-list');
    const ltrFirst = await box('ltr-trigger-overview');
    const rtlFirst = await box('rtl-trigger-overview');
    expect(ltrFirst.left - ltrList.left).toBeLessThan(4); // LTR: first tab at the left edge
    expect(rtlList.right - rtlFirst.right).toBeLessThan(4); // RTL: first tab at the right edge

    // The indicator sits on the selected trigger in both directions.
    await waitFor(async () => expect(coincide(await box('ltr-list-indicator'), await box('ltr-trigger-overview'))).toBe(true));
    await waitFor(async () => expect(coincide(await box('rtl-list-indicator'), await box('rtl-trigger-overview'))).toBe(true));

    // …and follows the selection. In RTL the third tab is to the *left*, so this
    // also pins the direction of travel, not just the destination.
    await userEvent.click(await canvas.findByTestId('rtl-trigger-settings'));
    await waitFor(async () => expect(coincide(await box('rtl-list-indicator'), await box('rtl-trigger-settings'))).toBe(true), {
      timeout: 2000,
    });
    expect((await box('rtl-list-indicator')).left).toBeLessThan(rtlFirst.left);
  },
};
