import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { FileLine } from 'rn-motion-ui-icons/icons/file-line';
import { Home1Line } from 'rn-motion-ui-icons/icons/home-1-line';
import { Settings1Line } from 'rn-motion-ui-icons/icons/settings-1-line';
import { StarLine } from 'rn-motion-ui-icons/icons/star-line';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Text } from '../../typography/Text/text';
import { MorphingSwitcher, type MorphingSwitcherItem } from './morphing-switcher';

const meta = {
  title: 'Display/MorphingSwitcher',
  component: MorphingSwitcher,
  parameters: { layout: 'fullscreen' },
  args: { items: [] },
} satisfies Meta<typeof MorphingSwitcher>;

type Story = StoryObj<typeof meta>;

// ── Helpers ──────────────────────────────────────────────────────────────────

type AppSurfaceProps = { children: ReactNode; hint: string };

function AppSurface({ children, hint }: AppSurfaceProps) {
  return (
    <View className="min-h-[380px] flex-1 bg-surface-1">
      <View className="border-border border-b px-5 py-3">
        <View className="h-2.5 w-24 rounded-full bg-surface-contrast-foreground/20" />
      </View>
      <View className="gap-3 p-5">
        <View className="h-2.5 w-3/4 rounded-full bg-surface-contrast-foreground/15" />
        <View className="h-2.5 w-1/2 rounded-full bg-surface-contrast-foreground/15" />
        <View className="h-20 w-full rounded-2xl bg-surface-contrast-foreground/[0.06]" />
        <Text className="text-muted-foreground text-sm">{hint}</Text>
      </View>
      {children}
    </View>
  );
}

const SPACES: readonly MorphingSwitcherItem[] = [
  { value: 'home', label: 'Home', icon: Home1Line },
  { value: 'files', label: 'All files', icon: FileLine },
  { value: 'favorites', label: 'Favorites', icon: StarLine },
  { value: 'settings', label: 'Settings', icon: Settings1Line },
];

// ── Stories ──────────────────────────────────────────────────────────────────

/** The pill shows the current item (icon + label + caret); it morphs into the item list. */
export const SwitchBetweenItems: Story = {
  name: 'Demo: switch between items',
  render: () => (
    <AppSurface hint="Tap the pill — it morphs into the full list of items. Picking one folds it back with the new value.">
      <View className="px-5">
        <MorphingSwitcher
          items={SPACES}
          defaultValue="home"
          accessibilityLabel="Switch space"
          triggerTestID="switcher-trigger"
          testID="switcher"
        />
      </View>
    </AppSurface>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The trigger pill shows the current item's label.
    const trigger = await canvas.findByTestId('switcher-trigger');
    await expect(within(trigger).getByText('Home')).toBeTruthy();
    // No item list while collapsed.
    await expect(screen.queryByText('All files')).toBeNull();

    // Tapping the pill morphs it into the full item list.
    await userEvent.click(trigger);
    await expect(await screen.findByText('All files')).toBeTruthy();
    await expect(await screen.findByText('Favorites')).toBeTruthy();
    await expect(await screen.findByText('Settings')).toBeTruthy();

    // The active item is highlighted; picking another folds the switcher back
    // and reports the new value.
    await userEvent.click(await screen.findByText('All files'));
    await expect(await canvas.findByTestId('switcher-trigger')).toBeTruthy();
    await expect(screen.queryByText('Favorites')).toBeNull();
    await expect(within(trigger).getByText('All files')).toBeTruthy();
  },
};

/** The switcher can be controlled from outside — the pane closes through the up-caret. */
export const Controlled: Story = {
  name: 'Demo: controlled',
  render: () => {
    function ControlledSwitcher() {
      const [value, setValue] = useState('home');
      const [open, setOpen] = useState(false);
      return (
        <AppSurface hint="The open state is controlled: the pane closes via its up-caret or an external toggle.">
          <View className="gap-3 px-5">
            <MorphingSwitcher
              items={SPACES}
              value={value}
              onValueChange={setValue}
              open={open}
              onOpenChange={setOpen}
              accessibilityLabel="Switch space"
              triggerTestID="controlled-trigger"
              testID="controlled"
            />
            <Text className="text-muted-foreground text-sm">Current: {value}</Text>
          </View>
        </AppSurface>
      );
    }
    return <ControlledSwitcher />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByTestId('controlled-trigger'));
    await expect(await screen.findByText('Favorites')).toBeTruthy();

    // The up-caret close control folds the pane back without selecting.
    await userEvent.click(await screen.findByTestId('controlled-close'));
    await expect(await canvas.findByTestId('controlled-trigger')).toBeTruthy();
    await expect(screen.queryByText('Settings')).toBeNull();
    // Nothing was selected.
    await expect(await canvas.findByText('Current: home')).toBeTruthy();
  },
};

/** A pane without a close control — selection is the only way out. */
export const NoCloseControl: Story = {
  name: 'Demo: no close control',
  render: () => (
    <AppSurface hint="closeIcon={null} — the pane has no close affordance; picking an item is the only way to fold it back.">
      <View className="px-5">
        <MorphingSwitcher
          items={SPACES}
          defaultValue="files"
          closeIcon={null}
          accessibilityLabel="Switch space"
          triggerTestID="noclose-trigger"
          testID="noclose"
        />
      </View>
    </AppSurface>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByTestId('noclose-trigger'));
    await expect(await screen.findByText('Settings')).toBeTruthy();
    // No close control rendered.
    await expect(screen.queryByTestId('noclose-close')).toBeNull();

    await userEvent.click(await screen.findByText('Settings'));
    await expect(await canvas.findByTestId('noclose-trigger')).toBeTruthy();
    await expect(screen.queryByText('Favorites')).toBeNull();
  },
};

/** Items without icons — the pill and rows render label-only. */
export const LabelOnly: Story = {
  name: 'Demo: label-only items',
  render: () => (
    <AppSurface hint="Items with no icon — the trigger shows label + caret only.">
      <View className="px-5">
        <MorphingSwitcher
          items={[
            { value: 'a', label: 'Option A' },
            { value: 'b', label: 'Option B' },
            { value: 'c', label: 'Option C' },
          ]}
          defaultValue="a"
          accessibilityLabel="Choose option"
          triggerTestID="labelonly-trigger"
          testID="labelonly"
        />
      </View>
    </AppSurface>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByTestId('labelonly-trigger'));
    await expect(await screen.findByText('Option C')).toBeTruthy();
    await userEvent.click(await screen.findByText('Option B'));
    await expect(await canvas.findByTestId('labelonly-trigger')).toBeTruthy();
    await expect(screen.queryByText('Option C')).toBeNull();
  },
};

export default meta;
