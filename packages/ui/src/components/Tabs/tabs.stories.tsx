import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { expect, userEvent, within } from 'storybook/test';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

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

const TAB_OVERVIEW = 'Overview';
const TAB_ACTIVITY = 'Activity';
const TAB_SETTINGS = 'Settings';
const OVERVIEW_SUMMARY = 'High-level summary.';
const ACTIVITY_EVENTS = 'Recent events.';
const SETTINGS_PREFS = 'Preferences.';
const SEGMENT_DAY = 'Day';
const SEGMENT_WEEK = 'Week';
const SEGMENT_MONTH = 'Month';
const FILTER_ALL = 'All';
const FILTER_OPEN = 'Open';
const FILTER_CLOSED = 'Closed';
const CONTROLLED_ONE = 'One';
const CONTROLLED_TWO = 'Two';
const SELECTED_PREFIX = 'Selected: ';

export default meta;

export const Pill: Story = {
  render: () => (
    <Tabs defaultValue="overview" variant="pill" testID="tabs">
      <TabsList>
        <TabsTrigger value="overview">{TAB_OVERVIEW}</TabsTrigger>
        <TabsTrigger value="activity">{TAB_ACTIVITY}</TabsTrigger>
        <TabsTrigger value="settings">{TAB_SETTINGS}</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <Text className="text-muted-foreground text-sm">{OVERVIEW_SUMMARY}</Text>
      </TabsContent>
      <TabsContent value="activity">
        <Text className="text-muted-foreground text-sm">{ACTIVITY_EVENTS}</Text>
      </TabsContent>
      <TabsContent value="settings">
        <Text className="text-muted-foreground text-sm">{SETTINGS_PREFS}</Text>
      </TabsContent>
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

export const Segment: Story = {
  render: () => (
    <Tabs defaultValue="day" variant="segment">
      <TabsList>
        <TabsTrigger value="day">{SEGMENT_DAY}</TabsTrigger>
        <TabsTrigger value="week">{SEGMENT_WEEK}</TabsTrigger>
        <TabsTrigger value="month">{SEGMENT_MONTH}</TabsTrigger>
      </TabsList>
    </Tabs>
  ),
};

export const Underline: Story = {
  render: () => (
    <Tabs defaultValue="all" variant="underline">
      <TabsList>
        <TabsTrigger value="all">{FILTER_ALL}</TabsTrigger>
        <TabsTrigger value="open">{FILTER_OPEN}</TabsTrigger>
        <TabsTrigger value="closed">{FILTER_CLOSED}</TabsTrigger>
      </TabsList>
    </Tabs>
  ),
};

export const PreSelectedTab: Story = {
  name: 'Pre-selected (non-first tab)',
  render: () => (
    <Tabs defaultValue="settings" variant="pill" testID="tabs">
      <TabsList>
        <TabsTrigger value="overview">{TAB_OVERVIEW}</TabsTrigger>
        <TabsTrigger value="activity">{TAB_ACTIVITY}</TabsTrigger>
        <TabsTrigger value="settings">{TAB_SETTINGS}</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <Text className="text-muted-foreground text-sm">{OVERVIEW_SUMMARY}</Text>
      </TabsContent>
      <TabsContent value="activity">
        <Text className="text-muted-foreground text-sm">{ACTIVITY_EVENTS}</Text>
      </TabsContent>
      <TabsContent value="settings">
        <Text className="text-muted-foreground text-sm">{SETTINGS_PREFS}</Text>
      </TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Indicator should appear directly on the third tab — no slide-in from tab 1.
    await expect(canvas.getByText(SETTINGS_PREFS)).toBeInTheDocument();
  },
};

export const Controlled: Story = {
  render: () => {
    const [tab, setTab] = useState('one');
    return (
      <View style={{ gap: 12 }}>
        <Tabs value={tab} onValueChange={setTab} variant="pill">
          <TabsList>
            <TabsTrigger value="one">{CONTROLLED_ONE}</TabsTrigger>
            <TabsTrigger value="two">{CONTROLLED_TWO}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Text className="text-muted-foreground text-xs">
          {SELECTED_PREFIX}
          {tab}
        </Text>
      </View>
    );
  },
};
