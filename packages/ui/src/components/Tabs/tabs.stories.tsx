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

export default meta;
type Story = StoryObj<typeof meta>;

export const Pill: Story = {
  render: () => (
    <Tabs defaultValue="overview" variant="pill" testID="tabs">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <Text className="text-sm text-muted-foreground">High-level summary.</Text>
      </TabsContent>
      <TabsContent value="activity">
        <Text className="text-sm text-muted-foreground">Recent events.</Text>
      </TabsContent>
      <TabsContent value="settings">
        <Text className="text-sm text-muted-foreground">Preferences.</Text>
      </TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Switching tabs swaps the visible content panel.
    await expect(canvas.getByText('High-level summary.')).toBeInTheDocument();
    await userEvent.click(canvas.getByText('Activity'));
    await expect(await canvas.findByText('Recent events.')).toBeInTheDocument();
  },
};

export const Segment: Story = {
  render: () => (
    <Tabs defaultValue="day" variant="segment">
      <TabsList>
        <TabsTrigger value="day">Day</TabsTrigger>
        <TabsTrigger value="week">Week</TabsTrigger>
        <TabsTrigger value="month">Month</TabsTrigger>
      </TabsList>
    </Tabs>
  ),
};

export const Underline: Story = {
  render: () => (
    <Tabs defaultValue="all" variant="underline">
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="open">Open</TabsTrigger>
        <TabsTrigger value="closed">Closed</TabsTrigger>
      </TabsList>
    </Tabs>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [tab, setTab] = useState('one');
    return (
      <View style={{ gap: 12 }}>
        <Tabs value={tab} onValueChange={setTab} variant="pill">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
        </Tabs>
        <Text className="text-xs text-muted-foreground">Selected: {tab}</Text>
      </View>
    );
  },
};
