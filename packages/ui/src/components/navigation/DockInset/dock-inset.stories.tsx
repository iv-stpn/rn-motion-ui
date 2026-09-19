import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { FileFill } from 'rn-motion-ui-icons/icons/file-fill';
import { Home2Line } from 'rn-motion-ui-icons/icons/home-2-line';
import { Settings1Line } from 'rn-motion-ui-icons/icons/settings-1-line';
import { expect, within } from 'storybook/test';
import { Note, Playground, Sample, Section } from '../../../__stories__/story-harness';
import { MorphingDockSwitch, type MorphingDockSwitchItem } from '../MorphingDockSwitch/morphing-dock-switch';
import { DockInsetProvider, useDockInset } from './dock-inset';

const meta = {
  title: 'Navigation/DockInset',
  component: DockInsetProvider,
  parameters: { layout: 'centered' },
  args: { children: null },
} satisfies Meta<typeof DockInsetProvider>;

type Story = StoryObj<typeof meta>;

const ITEMS = [
  { value: 'home', label: 'Home', icon: Home2Line },
  { value: 'files', label: 'Files', icon: FileFill },
  { value: 'settings', label: 'Settings', icon: Settings1Line },
] satisfies readonly MorphingDockSwitchItem[];

type WithTestID = { testID: string };

/** A bottom-anchored "FAB" that clears the dock by the reported inset. */
function ClearanceFAB({ testID }: WithTestID) {
  const inset = useDockInset();
  return <View testID={testID} className="absolute right-4 h-12 w-12 rounded-full bg-primary" style={{ bottom: inset + 16 }} />;
}

/** Renders the live clearance value for the story's readout. */
function ClearanceReadout({ testID }: WithTestID) {
  return <Note testID={testID}>{useDockInset()}</Note>;
}

function DockInsetPlayground() {
  return (
    <Playground>
      <Section title="Dock + bottom-anchored control">
        <View className="relative h-96 w-80 justify-end">
          <ClearanceFAB testID="story-dock-fab" />
          <MorphingDockSwitch items={ITEMS} testID="story-dock" />
        </View>
        <ClearanceReadout testID="story-dock-inset" />
      </Section>
    </Playground>
  );
}

export default meta;

/** A dock reports its resting clearance; the FAB reads it back and lifts itself clear. */
export const Interactive: Story = {
  render: () => (
    <DockInsetProvider>
      <DockInsetPlayground />
    </DockInsetProvider>
  ),
};

/** Without a provider the hook reads 0, so a consumer never breaks on its own. */
export const NoProvider: Story = {
  render: () => (
    <Sample label="unwrapped">
      <ClearanceReadout testID="story-noprovider-inset" />
    </Sample>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const readout = await canvas.findByTestId('story-noprovider-inset');
    await expect(readout.textContent).toBe('0');
  },
};
