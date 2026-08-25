import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { FileLine } from 'rn-motion-ui-icons/icons/file-line';
import { Home1Line } from 'rn-motion-ui-icons/icons/home-1-line';
import { Settings1Line } from 'rn-motion-ui-icons/icons/settings-1-line';
import { StarLine } from 'rn-motion-ui-icons/icons/star-line';
import { expect, fireEvent, screen, userEvent, waitFor, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Note, Toggle } from '../../../__stories__/story-harness';
import { Text } from '../../typography/Text/text';
import {
  MorphingSwitcher,
  type MorphingSwitcherItem,
  type MorphingSwitcherSize,
  type MorphingSwitcherVariant,
} from './morphing-switcher';

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

// ── Playground ───────────────────────────────────────────────────────────────

const VARIANTS = ['select', 'switcher'] as const;
const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly MorphingSwitcherSize[];
const SIZE_LABELS: Record<(typeof SIZES)[number], string> = { sm: 'Small', md: 'Medium', lg: 'Large' };

/** The same spaces stripped of their icons — the `Item icons` toggle swaps the two sets. */
const PLAIN_SPACES: readonly MorphingSwitcherItem[] = SPACES.map(({ value, label }) => ({ value, label }));

const PLAYGROUND_HINT =
  'select is a pill that hugs its label; switcher is a full-width bar with stacked carets. Either way the trigger stays mounted and becomes the active row of the open list. Elevation sets the resting float — the shell lifts two rungs higher while open.';

function MorphingSwitcherPlayground() {
  const [variant, setVariant] = useState<MorphingSwitcherVariant>('switcher');
  const [size, setSize] = useState<MorphingSwitcherSize>('md');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('3');
  const [floating, setFloating] = useState(false);
  const [withIcons, setWithIcons] = useState(true);
  const [closeCaret, setCloseCaret] = useState(true);
  const [value, setValue] = useState('home');

  return (
    <AppSurface hint={PLAYGROUND_HINT}>
      <View className="gap-3 px-5">
        <ControlCard title="Options">
          <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
          <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
          <Toggle label="Floating" onChange={setFloating} value={floating} />
          <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
          <Toggle label="Item icons" onChange={setWithIcons} value={withIcons} />
          {/* `closeIcon` only reaches the trigger in `select` — `switcher` always keeps its stacked carets. */}
          {variant === 'select' ? <Toggle label="Close caret" onChange={setCloseCaret} value={closeCaret} /> : null}
        </ControlCard>

        {/* Above the switcher: the open pane overlays whatever sits below it. */}
        <Note testID="story-selected-space">{`Selected: ${value}`}</Note>

        <MorphingSwitcher
          items={withIcons ? SPACES : PLAIN_SPACES}
          value={value}
          onValueChange={setValue}
          variant={variant}
          size={size}
          elevation={ELEVATIONS[elevationKey]}
          floating={floating}
          closeIcon={closeCaret ? undefined : null}
          accessibilityLabel="Switch space"
          triggerTestID="playground-trigger"
          testID="playground"
        />
      </View>
    </AppSurface>
  );
}

// ── Stories ──────────────────────────────────────────────────────────────────

/** Drive the variant, the item icons, and the close caret with the controls — the same
 *  switcher re-styles in place, keeping whatever value you last picked. */
export const Interactive: Story = {
  render: () => <MorphingSwitcherPlayground />,
};

/** The three heights side by side — sm/md/lg stand at the shared interactive
 *  ramp, so a switcher lines up with a Button or IconButton of the same size. */
export const AllSizes: Story = {
  render: () => (
    <AppSurface hint="Three sizes on the shared interactive ramp (24 / 32 / 40px).">
      <View className="gap-3 px-5">
        {SIZES.map((name) => (
          <View key={name} className="gap-1">
            <Text size="xs" className="text-muted-foreground">
              {SIZE_LABELS[name]}
            </Text>
            <MorphingSwitcher
              items={SPACES}
              defaultValue="home"
              variant="select"
              size={name}
              accessibilityLabel={`${SIZE_LABELS[name]} space`}
              triggerTestID={`allsizes-${name}-trigger`}
              testID={`allsizes-${name}`}
            />
          </View>
        ))}
      </View>
    </AppSurface>
  ),
};

/** The pill shows the current item (icon + label + caret); it morphs into the item list. */
export const SwitchBetweenItems: Story = {
  name: 'Demo: switch between items',
  render: () => (
    <AppSurface hint="Tap the pill — it morphs into the full list of items. Picking one folds it back with the new value.">
      <View className="px-5">
        <MorphingSwitcher
          items={SPACES}
          defaultValue="home"
          variant="select"
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
    // The trigger persists through the morph — it now shows the new value.
    const closedTrigger = await canvas.findByTestId('switcher-trigger');
    await expect(screen.queryByText('Favorites')).toBeNull();
    await expect(within(closedTrigger).getByText('All files')).toBeTruthy();
  },
};

/** The switcher can be controlled from outside — the trigger toggles the pane. */
export const Controlled: Story = {
  name: 'Demo: controlled',
  render: () => {
    function ControlledSwitcher() {
      const [value, setValue] = useState('home');
      const [open, setOpen] = useState(false);
      return (
        <AppSurface hint="The open state is controlled: the trigger (now the active header) toggles the pane closed.">
          <View className="gap-3 px-5">
            <MorphingSwitcher
              items={SPACES}
              value={value}
              onValueChange={setValue}
              open={open}
              onOpenChange={setOpen}
              variant="select"
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
    // The full-window outside-press backdrop is mounted while open.
    await expect(await screen.findByTestId('controlled-backdrop')).toBeTruthy();

    // Re-tapping the open trigger folds the pane back — it only LOOKS disabled
    // (opacity-40) but stays pressable, so the selected item dismisses on re-tap.
    await userEvent.click(await canvas.findByTestId('controlled-trigger'));
    await waitFor(() => expect(screen.queryByText('Settings')).toBeNull());
    // Nothing was selected.
    await expect(await canvas.findByText('Current: home')).toBeTruthy();

    // An outside press (the backdrop) closes it too, without selecting.
    await userEvent.click(await canvas.findByTestId('controlled-trigger'));
    await expect(await screen.findByText('Favorites')).toBeTruthy();
    await userEvent.click(await screen.findByTestId('controlled-backdrop'));
    await waitFor(() => expect(screen.queryByText('Settings')).toBeNull());
    await expect(await canvas.findByText('Current: home')).toBeTruthy();
  },
};

/** `closeIcon={null}` drops the open trigger's caret — the trigger still dismisses on re-tap. */
export const NoCloseControl: Story = {
  name: 'Demo: no close caret',
  render: () => (
    <AppSurface hint="closeIcon={null} — the open trigger has no trailing caret; it only looks disabled, so re-tapping it or picking an item folds the pane back.">
      <View className="px-5">
        <MorphingSwitcher
          items={SPACES}
          defaultValue="files"
          closeIcon={null}
          variant="select"
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
    // No trailing caret / close affordance on the open trigger.
    await expect(screen.queryByTestId('noclose-close')).toBeNull();

    // Selecting an item still folds the switcher back.
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
          variant="select"
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

/** Full-width bar: the trigger becomes the active row and the current item is not repeated. */
export const SwitcherVariant: Story = {
  name: 'Demo: full-width switcher',
  render: () => (
    <AppSurface hint="A full-width bar with stacked carets — the trigger becomes the active row and the current item isn't repeated below.">
      <View className="px-5">
        <MorphingSwitcher
          variant="switcher"
          items={SPACES}
          defaultValue="home"
          accessibilityLabel="Switch space"
          triggerTestID="switcher-variant-trigger"
          testID="switcher-variant"
        />
      </View>
    </AppSurface>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByTestId('switcher-variant-trigger');
    await expect(within(trigger).getByText('Home')).toBeTruthy();
    // Collapsed — nothing but the current item is visible.
    await expect(screen.queryByText('All files')).toBeNull();

    // Open from the trigger itself; the current item is lifted out of the list.
    await userEvent.click(trigger);
    await expect(await screen.findByText('All files')).toBeTruthy();
    await expect(await screen.findByText('Favorites')).toBeTruthy();
    await expect(await screen.findByText('Settings')).toBeTruthy();
    // The current item has no list row of its own — the trigger is that row.
    await expect(screen.queryByTestId('switcher-variant-item-home')).toBeNull();

    // The trigger only LOOKS disabled while open — re-tapping it (the selected
    // item's row) folds the switcher back, and the backdrop covers the window.
    await expect(await screen.findByTestId('switcher-variant-backdrop')).toBeTruthy();
    await userEvent.click(trigger);
    await waitFor(() => expect(screen.queryByText('Favorites')).toBeNull());

    // An outside press (the document listener / backdrop) also closes it.
    await userEvent.click(trigger);
    await expect(await screen.findByText('All files')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByText('Favorites')).toBeNull());
  },
};

/** Selecting an item from the full-width switcher folds it back with the new value. */
export const SwitcherVariantSelect: Story = {
  name: 'Demo: full-width switcher selection',
  render: () => (
    <AppSurface hint="Picking a row from the full-width switcher folds it back and lifts the new value into the trigger.">
      <View className="px-5">
        <MorphingSwitcher
          variant="switcher"
          items={SPACES}
          defaultValue="home"
          accessibilityLabel="Switch space"
          triggerTestID="switcher-select-trigger"
          testID="switcher-select"
        />
      </View>
    </AppSurface>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('switcher-select-trigger'));
    await expect(await screen.findByText('Favorites')).toBeTruthy();

    // Selecting a non-current item closes and promotes it to the trigger.
    await userEvent.click(await screen.findByText('Favorites'));
    const trigger = await canvas.findByTestId('switcher-select-trigger');
    await expect(within(trigger).getByText('Favorites')).toBeTruthy();
    await expect(screen.queryByText('Settings')).toBeNull();
  },
};

export default meta;
