import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, userEvent, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Sample, Section, Toggle, Variants } from '../../__stories__/story-harness';
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
  },
} satisfies Meta<typeof Tabs>;

type Story = StoryObj<typeof meta>;

type Variant = NonNullable<TabsProps['variant']>;

const VARIANTS = ['pill', 'underline', 'segment'] as const satisfies readonly Variant[];

const TAB_OVERVIEW = 'Overview';
const TAB_ACTIVITY = 'Activity';
const TAB_SETTINGS = 'Settings';
const OVERVIEW_SUMMARY = 'High-level summary.';
const ACTIVITY_EVENTS = 'Recent events.';
const SETTINGS_PREFS = 'Preferences.';
const PANELS = [
  { value: 'overview', label: TAB_OVERVIEW, body: OVERVIEW_SUMMARY },
  { value: 'activity', label: TAB_ACTIVITY, body: ACTIVITY_EVENTS },
  { value: 'settings', label: TAB_SETTINGS, body: SETTINGS_PREFS },
] as const;

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function TabsPlayground() {
  const [variant, setVariant] = useState<Variant>('pill');
  const [withPanels, setWithPanels] = useState(true);
  const [tab, setTab] = useState('overview');

  return (
    <Playground>
      <Controls>
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Toggle label="Content panels" onChange={setWithPanels} value={withPanels} />
      </Controls>

      <View style={{ gap: 8 }}>
        <Tabs onValueChange={setTab} value={tab} variant={variant}>
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
        <Variants direction="column" gap={16}>
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
    </Playground>
  );
}

export default meta;

/** All three indicator treatments, with or without content panels. The live set
 *  at the top is controlled, so the readout tracks whatever you select. */
export const Interactive: Story = { render: () => <TabsPlayground /> };

export const Pill: Story = {
  name: 'Demo: Switch tabs',
  render: () => (
    <Tabs defaultValue="overview" testID="tabs" variant="pill">
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
        </TabsContent>
      ))}
    </Tabs>
  ),
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
  render: () => (
    <Tabs defaultValue="settings" testID="tabs" variant="pill">
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
        </TabsContent>
      ))}
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Indicator should appear directly on the third tab — no slide-in from tab 1.
    await expect(canvas.getByText(SETTINGS_PREFS)).toBeInTheDocument();
  },
};
