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
import { expect, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Section, Toggle } from '../../../__stories__/story-harness';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Dock, DockItem, DockSeparator } from './dock';

const meta = {
  title: 'Navigation/Dock',
  component: Dock,
  parameters: { layout: 'centered' },
  args: { children: null, size: 44 },
  argTypes: {
    size: { control: { type: 'number' } },
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

const SIZES = [
  { value: '36', label: '36px' },
  { value: '44', label: '44px' },
  { value: '56', label: '56px' },
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
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function DockButton({ id, label, icon: Icon, active, iconSize, onSelect }: DockButtonProps) {
  const color = useThemeColor('foreground');
  const handlePress = useCallback(() => onSelect(id), [onSelect, id]);
  return (
    <DockItem accessibilityLabel={label} active={active} onPress={handlePress}>
      <Icon color={color} size={iconSize} />
    </DockItem>
  );
}

type DockDemoProps = { size?: number; separator?: boolean; onSelect?: (id: string) => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function DockDemo({ size = 44, separator = true, onSelect }: DockDemoProps) {
  const [active, setActive] = useState('home');
  const color = useThemeColor('foreground');
  const iconSize = Math.round(size * 0.45);

  const select = useCallback(
    (id: string) => {
      setActive(id);
      onSelect?.(id);
    },
    [onSelect],
  );
  const selectSettings = useCallback(() => select('settings'), [select]);

  return (
    <Dock size={size}>
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
      <DockItem accessibilityLabel="Settings" active={active === 'settings'} onPress={selectSettings}>
        <Settings color={color} size={iconSize} />
      </DockItem>
      {/* No `onPress`: the item renders as a plain View, so it never highlights. */}
      <DockItem accessibilityLabel="Repository">
        <GitBranch color={color} size={iconSize} />
      </DockItem>
    </Dock>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function DockPlayground() {
  const [sizeKey, setSizeKey] = useState<SizeKey>('44');
  const [separator, setSeparator] = useState(true);
  const [selected, setSelected] = useState('home');

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Item size" onChange={setSizeKey} options={SIZES} value={sizeKey} />
        <Toggle label="Separator" onChange={setSeparator} value={separator} />
      </ControlCard>

      {/* The highlight is a single pill that measures each item's box and glides
          between them, so a size change moves both the pill and its travel. */}
      <View className="items-center gap-2">
        <DockDemo onSelect={setSelected} separator={separator} size={Number(sizeKey)} />
        <Note testID="story-selected">{selected}</Note>
      </View>

      <View className="h-3" />
      <Section title="Item sizes">
        <View className="items-center gap-4">
          {SIZES.map((option) => (
            <DockDemo key={option.value} size={Number(option.value)} />
          ))}
        </View>
      </Section>
    </Playground>
  );
}

export default meta;

/** One dock with a live selection readout, plus the size ladder. The last item has
 *  no `onPress`, so it stays a plain View and never takes the highlight. */
export const Interactive: Story = { render: () => <DockPlayground /> };

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
