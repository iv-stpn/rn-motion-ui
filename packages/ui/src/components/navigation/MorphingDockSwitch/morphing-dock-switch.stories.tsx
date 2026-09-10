import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { CalendarLine as Calendar } from 'rn-motion-ui-icons/icons/calendar-line';
import { Home2Line as Home } from 'rn-motion-ui-icons/icons/home-2-line';
import { MailLine as Mail } from 'rn-motion-ui-icons/icons/mail-line';
import { MusicLine as Music } from 'rn-motion-ui-icons/icons/music-line';
import { Settings1Line as Settings } from 'rn-motion-ui-icons/icons/settings-1-line';
import { SparklesLine as Sparkles } from 'rn-motion-ui-icons/icons/sparkles-line';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkDockLabelMotion, expectDockAlignment } from '../../../__stories__/dock-motion-checks';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Note, Playground, Section, Toggle } from '../../../__stories__/story-harness';
import { checkContentFallsWithPane, checkSwitcherClose } from '../../../__stories__/switcher-motion-checks';
import type { SurfaceElevation } from '../../../lib/elevated';
import { OVERLAY_OPTIONS, type OverlayType } from '../../menus/Overlay/overlay-type';
import { Text } from '../../typography/Text/text';
import { MorphingDockSwitch, type MorphingDockSwitchItem, type MorphingDockSwitchSize } from './morphing-dock-switch';

const meta = {
  title: 'Navigation/MorphingDockSwitch',
  component: MorphingDockSwitch,
  parameters: { layout: 'centered' },
  args: { items: [] },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof MorphingDockSwitch>;

type Story = StoryObj<typeof meta>;

const ITEMS: readonly MorphingDockSwitchItem[] = [
  { value: 'home', label: 'Home', icon: Home },
  { value: 'mail', label: 'Mail', icon: Mail },
  { value: 'calendar', label: 'Calendar', icon: Calendar },
  { value: 'music', label: 'Music', icon: Music },
  { value: 'discover', label: 'Discover', icon: Sparkles },
  { value: 'settings', label: 'Settings', icon: Settings },
];

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly MorphingDockSwitchSize[];
const SIZE_LABELS: Record<(typeof SIZES)[number], string> = { sm: 'Small', md: 'Medium', lg: 'Large' };

const DOCK_COUNTS = [
  { value: '3', label: '3 pinned' },
  { value: '4', label: '4 pinned' },
  { value: '6', label: 'All' },
] as const satisfies readonly { value: string; label: string }[];

type DockSwitchDemoProps = {
  size?: MorphingDockSwitchSize;
  dockCount?: number;
  elevation?: SurfaceElevation;
  floating?: boolean;
  showLabels?: boolean;
};

function DockSwitchDemo({
  size = 'lg',
  dockCount = 4,
  elevation = 0,
  floating = false,
  showLabels = false,
}: DockSwitchDemoProps) {
  const [value, setValue] = useState('home');
  return (
    <View className="items-center gap-3">
      <MorphingDockSwitch
        items={ITEMS}
        dockCount={dockCount}
        showLabels={showLabels}
        value={value}
        onValueChange={setValue}
        size={size}
        elevation={elevation}
        floating={floating}
        accessibilityLabel="Switch destination"
        triggerTestID="demo-trigger"
        testID="demo"
      />
      <Note testID="story-selected">{value}</Note>
    </View>
  );
}

function DockSwitchPlayground() {
  const [size, setSize] = useState<MorphingDockSwitchSize>('lg');
  const [dockCount, setDockCount] = useState<'3' | '4' | '6'>('4');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('0');
  const [floating, setFloating] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [glass, setGlass] = useState(false);
  const [overlay, setOverlay] = useState<OverlayType>('none');
  const [closeOnOutside, setCloseOnOutside] = useState(true);
  const [value, setValue] = useState('home');

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Size" onChange={setSize} options={SIZES} value={size} />
        <Choice label="Dock items" onChange={setDockCount} options={DOCK_COUNTS} value={dockCount} />
        <Toggle label="Show labels" onChange={setShowLabels} value={showLabels} />
        <Toggle label="Floating" onChange={setFloating} value={floating} />
        <Toggle label="Glass" onChange={setGlass} value={glass} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
        <Choice label="Overlay" onChange={setOverlay} options={OVERLAY_OPTIONS} value={overlay} />
        <Toggle label="Close on outside" onChange={setCloseOnOutside} value={closeOnOutside} />
      </ControlCard>

      <Note testID="story-selected">{`Selected: ${value}`}</Note>

      <View className="relative">
        {glass ? (
          <>
            <View
              className="absolute"
              style={{ top: 0, left: 0, width: 56, height: 56, borderRadius: 28, backgroundColor: '#3b82f6' }}
            />
            <View
              className="absolute"
              style={{ top: 6, right: 0, width: 64, height: 64, borderRadius: 32, backgroundColor: '#ec4899' }}
            />
            <View
              className="absolute"
              style={{ top: 16, left: 96, width: 40, height: 40, borderRadius: 20, backgroundColor: '#f59e0b' }}
            />
          </>
        ) : null}
        <MorphingDockSwitch
          items={ITEMS}
          dockCount={Number(dockCount)}
          showLabels={showLabels}
          value={value}
          onValueChange={setValue}
          size={size}
          elevation={ELEVATIONS[elevationKey]}
          floating={floating}
          blurRadius={glass ? 24 : 0}
          opacity={glass ? 0.5 : 1}
          rim={glass}
          overlay={overlay}
          closeOnOutsidePress={closeOnOutside}
          accessibilityLabel="Switch destination"
          triggerTestID="playground-trigger"
          testID="playground"
        />
      </View>

      <View className="h-3" />
      <Section title="Sizes">
        <View className="items-center gap-4">
          {SIZES.map((name) => (
            <View key={name} className="items-center gap-1">
              <Text size="xs" className="text-muted-foreground">
                {SIZE_LABELS[name]}
              </Text>
              <DockSwitchDemo size={name} />
            </View>
          ))}
        </View>
      </Section>
    </Playground>
  );
}

export default meta;

/** Drive the size, pinned-dock count, glass, and elevation with the controls — the
 *  same dock re-styles in place, keeping whatever value you last picked. */
export const Interactive: Story = {
  render: () => <DockSwitchPlayground />,
};

export const LabelMotion: Story = {
  render: () => <DockSwitchPlayground />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = await canvas.findByTestId('playground');
    for (const glass of [false, true]) {
      // biome-ignore lint/performance/noAwaitInLoops: exercise the same mounted control in solid then glass mode
      if (glass) await userEvent.click(canvas.getByRole('switch', { name: 'Glass' }));
      const shell = await canvas.findByTestId('playground-shell');
      const pill = await canvas.findByTestId('playground-highlight');
      const mail = canvas.getByTestId('playground-item-mail');
      await userEvent.click(mail);
      await expectDockAlignment(pill, mail);
      await checkDockLabelMotion(shell, mail, canvas.getByRole('switch', { name: 'Show labels' }));
      await expectDockAlignment(pill, mail);
      expect(canvas.getByTestId('playground-highlight')).toBe(pill);
      await expectDockAlignment(root, shell);
    }
    const footprint = root.getBoundingClientRect();
    await userEvent.click(canvas.getByTestId('playground-trigger'));
    const settings = await canvas.findByTestId('playground-item-settings');
    expect(root.getBoundingClientRect().height).toBeCloseTo(footprint.height, 0);
    await userEvent.click(settings);
    await waitFor(() => expect(canvas.queryByTestId('playground-highlight')).toBeNull());
    await userEvent.click(await canvas.findByTestId('playground-trigger'));
    await expect(await canvas.findByTestId('playground-header')).toHaveAccessibleName('Settings');
    await userEvent.click(canvas.getByTestId('playground-header'));
    await expect(await canvas.findByTestId('playground-trigger')).toHaveAttribute('aria-expanded', 'false');
  },
};

/** One dock with a live selection readout, plus the size ladder. The double caret
 *  opens the full switcher. */
export const Default: Story = {
  name: 'Demo: pick a docked item',
  render: () => (
    <View className="items-center gap-3">
      <DockSwitchDemo />
      <Text size="xs" className="text-muted-foreground">
        Tap an icon to select it; tap the double caret to open the full list.
      </Text>
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The pinned dock icons are present; the overflow items are not.
    await expect(await canvas.findByLabelText('Mail')).toBeTruthy();
    await expect(canvas.queryByText('Settings')).toBeNull();

    // Selecting a docked icon promotes it to active.
    await userEvent.click(await canvas.findByLabelText('Mail'));
    await expect(await canvas.findByTestId('story-selected')).toHaveTextContent('mail');
  },
};

/** The double caret opens the dock into a vertical switcher; picking an overflow
 *  item folds it back with the new value. */
export const OpenSwitcher: Story = {
  name: 'Demo: open the switcher',
  render: () => <DockSwitchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The dock is collapsed — overflow items are hidden.
    await expect(canvas.queryByText('Settings')).toBeNull();

    // Open the switcher via the double-caret button.
    await userEvent.click(await canvas.findByTestId('demo-trigger'));

    // Every item now shows its label, including the overflow items the dock hid.
    await expect(await canvas.findByText('Discover')).toBeTruthy();
    await expect(await canvas.findByText('Settings')).toBeTruthy();

    // Picking an overflow item folds the switcher back and reports the new value.
    await userEvent.click(await canvas.findByText('Settings'));
    await expect(await canvas.findByTestId('story-selected')).toHaveTextContent('settings');
    await waitFor(() => expect(canvas.queryByText('Discover')).toBeNull());
  },
};

/** Regression: identical selected-row geometry and phased close, anchored upward. */
export const CloseMotion: Story = {
  render: () => (
    <View className="fixed bottom-6 left-10">
      <MorphingDockSwitch items={ITEMS} defaultValue="mail" dockCount={4} testID="motion-dock" triggerTestID="motion-trigger" />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = await canvas.findByTestId('motion-dock');
    await userEvent.click(await canvas.findByTestId('motion-trigger'));
    const selected = await canvas.findByTestId('motion-dock-header');
    const home = await canvas.findByTestId('motion-dock-item-home');
    const selectedRow = canvas.getByTestId('motion-dock-row-mail');
    await waitFor(() => expect(Number(getComputedStyle(selectedRow).opacity)).toBeCloseTo(1, 3));
    const rows = ITEMS.map((item) => canvas.getByTestId(`motion-dock-row-${item.value}`));
    const tops = rows.map((row) => row.getBoundingClientRect().top);
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    expect(tops[0]).toBeLessThan(root.getBoundingClientRect().top);
    expect(selected.getBoundingClientRect().height).toBeCloseTo(home.getBoundingClientRect().height, 1);
    expect(getComputedStyle(selected).fontSize).toBe(getComputedStyle(home).fontSize);
    expect(selected.querySelectorAll('svg')).toHaveLength(1);
    const homeIcon = home.querySelector('svg');
    if (!homeIcon) throw new Error('Missing destination icon');
    expect(selected.querySelector('svg')?.getBoundingClientRect().width).toBeCloseTo(homeIcon.getBoundingClientRect().width, 1);
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected.querySelector('.bg-surface-selected')).not.toBeNull();
    await userEvent.hover(home);
    await waitFor(() => expect(selected.querySelector('.bg-surface-selected')).toBeNull());
    // Closes the dock by re-picking the active row; the list has to come down with
    // the pane's top edge, thinning out as it falls, rather than dissolving in place
    // and leaving an emptied shell to collapse alone.
    await checkContentFallsWithPane(root, 'home', selected);
    await userEvent.click(await canvas.findByTestId('motion-trigger'));
    // The pane (and the header in it) remounts on reopen, so the node closed above
    // is detached — the second pass needs the fresh one or its click lands on nothing.
    await checkSwitcherClose(root, await canvas.findByTestId('motion-dock-header'), ['home', 'settings']);
    await expect(await canvas.findByTestId('motion-trigger')).toHaveAttribute('aria-expanded', 'false');
  },
};

/** The frosted-glass shell — `blurRadius` frosts the dock and pane over a
 *  colourful backdrop, `opacity` thins the tint, and `rim` draws the edge light. */
export const Frosted: Story = {
  render: () => (
    <View className="relative h-[220px] items-center justify-center overflow-hidden rounded-2xl">
      <View
        className="absolute"
        style={{ top: 24, left: 24, width: 96, height: 96, borderRadius: 48, backgroundColor: '#3b82f6' }}
      />
      <View
        className="absolute"
        style={{ right: 28, bottom: 24, width: 112, height: 112, borderRadius: 56, backgroundColor: '#ec4899' }}
      />
      <View
        className="absolute"
        style={{ top: 56, right: 48, width: 64, height: 64, borderRadius: 32, backgroundColor: '#f59e0b' }}
      />
      <MorphingDockSwitch
        items={ITEMS}
        dockCount={4}
        defaultValue="home"
        blurRadius={24}
        opacity={0.5}
        rim={true}
        elevation={3}
        accessibilityLabel="Switch destination"
        triggerTestID="frosted-trigger"
        testID="frosted"
      />
    </View>
  ),
};
