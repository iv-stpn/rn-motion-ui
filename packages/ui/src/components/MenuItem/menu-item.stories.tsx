import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { fn } from 'storybook/test';
import { Choice, ControlRow, Controls, Playground, Toggle } from '../../__stories__/story-harness';
import { Bell, ChevronRight, Copy, Moon, Pencil, Settings, ShieldCheck, Trash2, User } from '../../lib/icons';
import { Text } from '../Text/text';
import { MenuItem, type MenuItemIcon } from './menu-item';

const onPress = fn();

// theme-exempt: iOS-style decorative accent colours, not design-system surfaces
type IosEntry = { label: string; icon: MenuItemIcon; color: string };
const IOS_ITEMS: IosEntry[] = [
  { label: 'Account', icon: User, color: '#3b82f6' },
  { label: 'Notifications', icon: Bell, color: '#f59e0b' },
  { label: 'Appearance', icon: Moon, color: '#8b5cf6' },
  { label: 'Privacy & Security', icon: ShieldCheck, color: '#10b981' },
  { label: 'General', icon: Settings, color: '#6b7280' },
];

type DefaultEntry = { label: string; icon: MenuItemIcon };
const DEFAULT_ITEMS: DefaultEntry[] = [
  { label: 'Copy', icon: Copy },
  { label: 'Edit', icon: Pencil },
  { label: 'Delete', icon: Trash2 },
];

type HintChipProps = { hint: string };

// Hint chip matching CommandPalette's trailing hint style
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function HintChip({ hint }: HintChipProps) {
  return (
    <Text className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">{hint}</Text>
  );
}

const meta = {
  title: 'Components/MenuItem',
  component: MenuItem,
  parameters: { layout: 'centered' },
  args: { label: 'Menu item', onPress },
} satisfies Meta<typeof MenuItem>;

type Story = StoryObj<typeof meta>;

type TrailingKey = 'none' | 'hint' | 'chevron';
const TRAILING_OPTS = ['none', 'hint', 'chevron'] as const satisfies readonly TrailingKey[];

function trailingNode(key: TrailingKey) {
  if (key === 'hint') return <HintChip hint="⌘ K" />;
  if (key === 'chevron') return <ChevronRight size={14} />;
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function MenuItemPlayground() {
  const [active, setActive] = useState(false);
  const [showIcon, setShowIcon] = useState(true);
  const [iosMode, setIosMode] = useState(false);
  const [trailingKey, setTrailingKey] = useState<TrailingKey>('none');

  return (
    <Playground>
      <Controls>
        <ControlRow>
          <Choice label="Trailing" options={TRAILING_OPTS} value={trailingKey} onChange={setTrailingKey} />
        </ControlRow>
        <ControlRow>
          <Toggle label="Active" value={active} onChange={setActive} />
          <Toggle label="Icon" value={showIcon} onChange={setShowIcon} />
          <Toggle label="iOS style" value={iosMode} onChange={setIosMode} />
        </ControlRow>
      </Controls>
      <View className="w-64 py-1">
        <MenuItem
          label="Menu item"
          icon={showIcon ? User : undefined}
          active={active}
          trailing={trailingNode(trailingKey)}
          // theme-exempt: decorative iOS accent colour
          iconBackgroundColor={iosMode ? '#3b82f6' : undefined}
          onPress={onPress}
        />
      </View>
    </Playground>
  );
}

export default meta;

/** Active toggle, icon, iOS mode, and trailing variants in a single interactive panel. */
export const Interactive: Story = {
  render: () => <MenuItemPlayground />,
};

/** Default (CommandPalette) style — animated active highlight, 16 px themed icon. */
export const DefaultStyle: Story = {
  name: 'Default style',
  render: () => (
    <View className="w-64 gap-0.5 py-1">
      {DEFAULT_ITEMS.map((item, i) => (
        <MenuItem key={item.label} icon={item.icon} label={item.label} active={i === 0} onPress={onPress} />
      ))}
    </View>
  ),
};

/** iOS style — coloured rounded-square icon, taller row, active row highlighted. */
export const IOSStyle: Story = {
  name: 'iOS style',
  render: () => (
    <View className="w-64 gap-0.5 py-1">
      {IOS_ITEMS.map((item, i) => (
        <MenuItem
          key={item.label}
          icon={item.icon}
          label={item.label}
          active={i === 0}
          // theme-exempt: decorative iOS accent colour
          iconBackgroundColor={item.color}
          onPress={onPress}
        />
      ))}
    </View>
  ),
};

/** `trailing` — hint chip, chevron, or any ReactNode placed after the label. */
export const TrailingVariants: Story = {
  name: 'Trailing variants',
  render: () => (
    <View className="w-64 gap-0.5 py-1">
      <MenuItem icon={Copy} label="Copy" trailing={<HintChip hint="⌘ C" />} onPress={onPress} />
      <MenuItem icon={Pencil} label="Edit" trailing={<HintChip hint="⌘ E" />} onPress={onPress} />
      <MenuItem icon={Settings} label="Settings" trailing={<ChevronRight size={14} />} onPress={onPress} />
      <MenuItem icon={Trash2} label="Delete" onPress={onPress} />
    </View>
  ),
};

/**
 * `iconPlaceholder` — reserves the icon slot with a spacer to keep labels
 * horizontally aligned in lists that mix icon and icon-less rows.
 */
export const IconPlaceholder: Story = {
  name: 'Icon placeholder (mixed list)',
  render: () => (
    <View className="w-64 gap-0.5 py-1">
      <MenuItem icon={User} label="Profile" onPress={onPress} />
      <MenuItem iconPlaceholder={true} label="No icon, aligned" onPress={onPress} />
      <MenuItem icon={Settings} label="Settings" onPress={onPress} />
      <MenuItem iconPlaceholder={true} label="Another no-icon row" onPress={onPress} />
    </View>
  ),
};
