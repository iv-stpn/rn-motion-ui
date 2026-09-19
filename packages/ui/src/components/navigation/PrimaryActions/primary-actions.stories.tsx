import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { FileFill } from 'rn-motion-ui-icons/icons/file-fill';
import { Home2Line } from 'rn-motion-ui-icons/icons/home-2-line';
import { LinkLine } from 'rn-motion-ui-icons/icons/link-line';
import { ScanLine } from 'rn-motion-ui-icons/icons/scan-line';
import { Settings1Line } from 'rn-motion-ui-icons/icons/settings-1-line';
import { Upload2Line } from 'rn-motion-ui-icons/icons/upload-2-line';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Playground, Sample, Section } from '../../../__stories__/story-harness';
import { DockInsetProvider } from '../DockInset/dock-inset';
import { MorphingDockSwitch, type MorphingDockSwitchItem } from '../MorphingDockSwitch/morphing-dock-switch';
import { type PrimaryActionItem, PrimaryActions } from './primary-actions';

const meta = {
  title: 'Navigation/PrimaryActions',
  component: PrimaryActions,
  parameters: { layout: 'centered' },
  args: {
    actions: [
      { id: 'new-file', label: 'New file', icon: FileFill },
      { id: 'upload', label: 'Upload', icon: Upload2Line },
      { id: 'import-link', label: 'Import link', icon: LinkLine },
      { id: 'scan', label: 'Scan', icon: ScanLine },
    ] satisfies readonly PrimaryActionItem[],
    onAction: fn(),
  },
} satisfies Meta<typeof PrimaryActions>;

type Story = StoryObj<typeof meta>;

const ACTIONS = [
  { id: 'new-file', label: 'New file', icon: FileFill },
  { id: 'upload', label: 'Upload', icon: Upload2Line },
  { id: 'import-link', label: 'Import link', icon: LinkLine },
  { id: 'scan', label: 'Scan', icon: ScanLine },
] satisfies readonly PrimaryActionItem[];

const DOCK_ITEMS = [
  { value: 'home', label: 'Home', icon: Home2Line },
  { value: 'files', label: 'Files', icon: FileFill },
  { value: 'settings', label: 'Settings', icon: Settings1Line },
] satisfies readonly MorphingDockSwitchItem[];

export default meta;

/** At/above the breakpoint the actions become a header row — icon cluster on web
 *  (`auto`), labelled row when forced — each action on the `${testID}-item-<id>`
 *  testID shared with the FAB form. */
export const Desktop: Story = {
  render: ({ onAction }) => (
    <Playground>
      <Section title="Icon cluster (auto → icons on web)">
        <PrimaryActions actions={ACTIONS} breakpoint="base" onAction={onAction} testID="story-icons" />
      </Section>
      <Section title="Labelled row">
        <PrimaryActions actions={ACTIONS} breakpoint="base" desktopMode="labels" onAction={onAction} testID="story-labels" />
      </Section>
    </Playground>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const upload = await canvas.findByTestId('story-icons-item-upload');
    await userEvent.click(upload);
    await expect(args.onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'upload' }));
  },
};

/** Below the breakpoint the actions fold into a MorphingFAB whose pane lists the
 *  same `${testID}-item-<id>` rows. */
export const Mobile: Story = {
  render: () => (
    <Sample label="below the breakpoint — a FAB, not a header row">
      <View className="relative h-80 w-72">
        <PrimaryActions actions={ACTIONS} breakpoint={9999} testID="story-mobile" />
      </View>
    </Sample>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByTestId('story-mobile-trigger');
    await userEvent.click(trigger);
    const upload = await canvas.findByTestId('story-mobile-item-upload');
    await expect(upload).toBeInTheDocument();
  },
};

/** The FAB reads the dock's measured clearance and lifts itself clear of it. */
export const WithDock: Story = {
  render: () => (
    <DockInsetProvider>
      <Playground>
        <Section title="Dock + primary actions">
          <View className="relative h-96 w-80 justify-end">
            <PrimaryActions actions={ACTIONS} breakpoint={9999} testID="story-dock-actions" />
            <MorphingDockSwitch items={DOCK_ITEMS} testID="story-dock" />
          </View>
        </Section>
      </Playground>
    </DockInsetProvider>
  ),
};
