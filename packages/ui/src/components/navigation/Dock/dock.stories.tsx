import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentType, useCallback, useState } from 'react';
import { View } from 'react-native';
import { CalendarLine as Calendar } from 'rn-motion-ui-icons/icons/calendar-line';
import { GitBranchLine as GitBranch } from 'rn-motion-ui-icons/icons/git-branch-line';
import { Home2Line as Home } from 'rn-motion-ui-icons/icons/home-2-line';
import { MailLine as Mail } from 'rn-motion-ui-icons/icons/mail-line';
import { MusicLine as Music } from 'rn-motion-ui-icons/icons/music-line';
import { Settings1Line as Settings } from 'rn-motion-ui-icons/icons/settings-1-line';
import { SparklesLine as Sparkles } from 'rn-motion-ui-icons/icons/sparkles-line';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkDockLabelMotion, expectDockAlignment } from '../../../__stories__/dock-motion-checks';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Note, Playground, Section, Toggle } from '../../../__stories__/story-harness';
import type { SurfaceElevation } from '../../../lib/elevated';
import { INTERACTIVE_HEIGHT } from '../../../lib/radius';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Dock, DockItem, DockSeparator } from './dock';

const meta = {
  title: 'Navigation/Dock',
  component: Dock,
  parameters: { layout: 'centered' },
  args: { children: null, size: 'lg' as const },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Dock>;

type Story = StoryObj<typeof meta>;

const ITEMS = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'mail', icon: Mail, label: 'Mail' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'music', icon: Music, label: 'Music' },
  { id: 'discover', icon: Sparkles, label: 'Discover' },
] as const;

/** Item pixel size per interactive size key (container height − 4 px). */
const ITEM_PX = {
  sm: INTERACTIVE_HEIGHT.sm - 4,
  md: INTERACTIVE_HEIGHT.md - 4,
  lg: INTERACTIVE_HEIGHT.lg - 4,
} as const;

const SIZE_LABEL = {
  sm: `sm (${INTERACTIVE_HEIGHT.sm}px)`,
  md: `md (${INTERACTIVE_HEIGHT.md}px)`,
  lg: `lg (${INTERACTIVE_HEIGHT.lg}px)`,
} as const;

const SIZES = [
  { value: 'sm', label: SIZE_LABEL.sm },
  { value: 'md', label: SIZE_LABEL.md },
  { value: 'lg', label: SIZE_LABEL.lg },
] as const;

type SizeKey = (typeof SIZES)[number]['value'];
type IconType = ComponentType<{ size?: number; color?: string }>;
type DockButtonProps = {
  id: string;
  label: string;
  icon: IconType;
  active: boolean;
  iconSize: number;
  onSelect: (id: string) => void;
};

// Its own component so each item's `onPress` is a stable per-id callback.

function DockButton({ id, label, icon: Icon, active, iconSize, onSelect }: DockButtonProps) {
  const color = useThemeColor('foreground');
  const handlePress = useCallback(() => onSelect(id), [onSelect, id]);
  return (
    <DockItem label={label} accessibilityLabel={label} active={active} onPress={handlePress}>
      <Icon color={color} size={iconSize} />
    </DockItem>
  );
}

type DockDemoProps = {
  size?: SizeKey;
  separator?: boolean;
  elevation?: SurfaceElevation;
  floating?: boolean;
  showLabels?: boolean;
  onSelect?: (id: string) => void;
};

function DockDemo({
  size = 'lg',
  separator = true,
  elevation = 0,
  floating = false,
  showLabels = false,
  onSelect,
}: DockDemoProps) {
  const [active, setActive] = useState('home');
  const color = useThemeColor('foreground');
  const itemPx = ITEM_PX[size];
  const iconSize = Math.round(itemPx * 0.5);

  const select = useCallback(
    (id: string) => {
      setActive(id);
      onSelect?.(id);
    },
    [onSelect],
  );
  const selectSettings = useCallback(() => select('settings'), [select]);

  return (
    <Dock size={size} elevation={elevation} floating={floating} showLabels={showLabels}>
      {ITEMS.map((item) => (
        <DockButton
          active={active === item.id}
          icon={item.icon}
          iconSize={iconSize}
          id={item.id}
          key={item.id}
          label={item.label}
          onSelect={select}
        />
      ))}
      {separator ? <DockSeparator /> : null}
      <DockItem label="Settings" accessibilityLabel="Settings" active={active === 'settings'} onPress={selectSettings}>
        <Settings color={color} size={iconSize} />
      </DockItem>
      {/* No `onPress`: the item renders as a plain View, so it never highlights. */}
      <DockItem label="Repository" accessibilityLabel="Repository">
        <GitBranch color={color} size={iconSize} />
      </DockItem>
    </Dock>
  );
}

function DockPlayground() {
  const [sizeKey, setSizeKey] = useState<SizeKey>('lg');
  const [separator, setSeparator] = useState(true);
  const [elevationKey, setElevationKey] = useState<ElevationKey>('0');
  const [floating, setFloating] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [selected, setSelected] = useState('home');

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Size" onChange={setSizeKey} options={SIZES} value={sizeKey} />
        <Toggle label="Show labels" onChange={setShowLabels} value={showLabels} />
        <Toggle label="Floating" onChange={setFloating} value={floating} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
        <Toggle label="Separator" onChange={setSeparator} value={separator} />
      </ControlCard>

      {/* The highlight is a single pill that measures each item's box and glides
          between them, so a size change moves both the pill and its travel. */}
      <View className="items-center gap-2">
        <DockDemo
          floating={floating}
          elevation={ELEVATIONS[elevationKey]}
          onSelect={setSelected}
          separator={separator}
          showLabels={showLabels}
          size={sizeKey}
        />
        <Note testID="story-selected">{selected}</Note>
      </View>

      <View className="h-3" />
      <Section title="Sizes">
        <View className="items-center gap-4">
          {SIZES.map((option) => (
            <DockDemo key={option.value} size={option.value} />
          ))}
        </View>
      </Section>
    </Playground>
  );
}

function MixedDockFixture() {
  const [labels, setLabels] = useState(false);
  return (
    <View className="items-center gap-4">
      <Toggle label="Show labels" value={labels} onChange={setLabels} />
      {SIZES.map(({ value }) => (
        <Dock key={value} size={value} showLabels={labels} testID={`mixed-${value}`}>
          {/* biome-ignore lint/complexity/noUselessFragments: verify compound items nested in a fragment */}
          <>
            <DockItem label="Home" testID={`mixed-${value}-home`}>
              H
            </DockItem>
            <DockSeparator />
            <DockItem active={true} testID={`mixed-${value}-custom`} style={{ width: 60, backgroundColor: '#abcdef' }}>
              C
            </DockItem>
          </>
        </Dock>
      ))}
    </View>
  );
}

export default meta;

/** One dock with a live selection readout, plus the size ladder. The last item has
 *  no `onPress`, so it stays a plain View and never takes the highlight. */
export const Interactive: Story = { render: () => <DockPlayground /> };

export const LabelMotion: Story = {
  render: () => <DockPlayground />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pill = (await canvas.findAllByTestId('dock-highlight'))[0];
    if (!pill) throw new Error('Dock highlight is missing');
    const shell = pill.parentElement?.parentElement;
    if (!shell) throw new Error('Dock shell is missing');
    const mail = within(shell).getByRole('button', { name: 'Mail' });
    await userEvent.click(mail);
    await expectDockAlignment(pill, mail);
    await checkDockLabelMotion(shell, mail, canvas.getByRole('switch', { name: 'Show labels' }));
    await expectDockAlignment(pill, mail);
    expect(shell.querySelector('[data-testid="dock-highlight"]')).toBe(pill);
    const settings = within(shell).getByRole('button', { name: 'Settings' });
    await userEvent.click(settings);
    await expectDockAlignment(pill, settings);
    const inactiveContent = mail.firstElementChild;
    if (!inactiveContent) throw new Error('Dock content is missing');
    await expect(Number(getComputedStyle(inactiveContent).opacity)).toBeCloseTo(0.5, 1);
  },
};

export const MixedItems: Story = {
  render: () => <MixedDockFixture />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('switch', { name: 'Show labels' }));
    await Promise.all(
      SIZES.map(async ({ value }) => {
        const custom = await canvas.findByTestId(`mixed-${value}-custom`);
        const pill = await canvas.findByTestId(`mixed-${value}-highlight`);
        await expectDockAlignment(pill, custom);
        expect(custom.getBoundingClientRect().width).toBe(60);
        expect(custom.getBoundingClientRect().height).toBe(ITEM_PX[value]);
        expect(getComputedStyle(custom).backgroundColor).toBe('rgb(171, 205, 239)');
        const home = canvas.getByTestId(`mixed-${value}-home`);
        await waitFor(() => expect(home.getBoundingClientRect().height).toBeGreaterThan(ITEM_PX[value]));
      }),
    );
  },
};

export const Default: Story = {
  name: 'Demo: Select an item',
  render: () => <DockDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const mail = await canvas.findByLabelText('Mail');
    await userEvent.click(mail);
    await expect(mail).toHaveAttribute('aria-selected', 'true');
  },
};
