import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Bell, ChevronDown, Moon, Settings, User } from '../../lib/icons';
import { useThemeColor } from '../../theme/use-theme-color';
import { Button } from '../Button/button';
import { Text } from '../Text/text';
import { AdaptiveDropdown } from './adaptive-dropdown';

const meta = {
  title: 'Components/AdaptiveDropdown',
  component: AdaptiveDropdown,
  parameters: { layout: 'centered' },
  // trigger and children are managed by each story's render fn; stubs satisfy the type checker
  args: { trigger: null, children: null },
} satisfies Meta<typeof AdaptiveDropdown>;

type Story = StoryObj<typeof meta>;

const ITEMS = [
  { label: 'Profile', icon: User },
  { label: 'Notifications', icon: Bell },
  { label: 'Appearance', icon: Moon },
  { label: 'Settings', icon: Settings },
] as const;

const MENU_LABEL = 'Menu';
const OPEN_LABEL = 'Open';
const LONG_LIST_LABEL = 'Long list';
const CONTROLLED_LABEL = 'Controlled';
const CLOSE_CALLBACK_TEXT = 'Content with a close callback.';
const CLOSE_LABEL = 'Close';
const ALIGN_END_LABEL = 'Align end';
const SELECT_ITEM_TITLE = 'Select item';

type MenuItemProps = { label: string; icon: typeof User };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function MenuItem({ label, icon: Icon }: MenuItemProps) {
  return (
    <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 }}>
      <Icon size={18} />
      <Text style={{ fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

type DefaultTriggerProps = { open: boolean; toggle: () => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function DefaultTrigger({ open, toggle }: DefaultTriggerProps) {
  // Emphasized foreground when open, muted when closed — both track the theme so
  // the open-state chevron stays legible on dark surfaces (a fixed dark hex vanished).
  const openColor = useThemeColor('foreground');
  const closedColor = useThemeColor('muted-foreground');
  return (
    <Button variant="outline" onPress={toggle} rightAdornment={<ChevronDown size={16} color={open ? openColor : closedColor} />}>
      {MENU_LABEL}
    </Button>
  );
}

// The render-prop `trigger` receives `{ open, toggle }`; these variants only need
// `toggle`. Defined at module scope (rather than inline arrows) so each story passes
// a stable function reference, matching DefaultTrigger.
type TriggerProps = { toggle: () => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function OpenTrigger({ toggle }: TriggerProps) {
  return (
    <Button variant="outline" onPress={toggle}>
      {OPEN_LABEL}
    </Button>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function LongListTrigger({ toggle }: TriggerProps) {
  return (
    <Button variant="outline" onPress={toggle}>
      {LONG_LIST_LABEL}
    </Button>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function ControlledTrigger({ toggle }: TriggerProps) {
  return (
    <Button variant="outline" onPress={toggle}>
      {CONTROLLED_LABEL}
    </Button>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function EndAlignedTrigger({ toggle }: TriggerProps) {
  return (
    <Button variant="outline" onPress={toggle}>
      {ALIGN_END_LABEL}
    </Button>
  );
}

export default meta;

/** Uncontrolled dropdown — manages its own open state. */
export const Default: Story = {
  render: () => (
    <AdaptiveDropdown trigger={DefaultTrigger}>
      {ITEMS.map((item) => (
        <MenuItem key={item.label} {...item} />
      ))}
    </AdaptiveDropdown>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Click the trigger to open the dropdown panel.
    await userEvent.click(await canvas.findByText(MENU_LABEL));
    // Panel content mounts in a Modal — use screen to query outside the canvas.
    await expect(await screen.findByText('Profile')).toBeTruthy();
    await expect(await screen.findByText('Notifications')).toBeTruthy();
  },
};

/** Header with title and close button. */
export const WithHeader: Story = {
  render: () => (
    <AdaptiveDropdown trigger={OpenTrigger} title="Options" showClose={true}>
      {ITEMS.map((item) => (
        <MenuItem key={item.label} {...item} />
      ))}
    </AdaptiveDropdown>
  ),
};

/** `scrollable` wraps content in a ScrollView (useful for long lists). */
export const Scrollable: Story = {
  render: () => (
    <AdaptiveDropdown trigger={LongListTrigger} title={SELECT_ITEM_TITLE} showClose={true} scrollable={true} maxHeight={320}>
      {Array.from({ length: 20 }, (_, i) => {
        const label = `Item ${i + 1}`;
        return (
          <Pressable key={label} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 15 }}>{label}</Text>
          </Pressable>
        );
      })}
    </AdaptiveDropdown>
  ),
};

/** Controlled open state. */
export const Controlled: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <View style={{ gap: 12, alignItems: 'center' }}>
        <Text className="text-muted-foreground" style={{ fontSize: 13 }}>{`open: ${String(open)}`}</Text>
        <AdaptiveDropdown open={open} onOpenChange={setOpen} trigger={ControlledTrigger}>
          {({ close }) => (
            <View style={{ padding: 16, gap: 8 }}>
              <Text className="text-muted-foreground">{CLOSE_CALLBACK_TEXT}</Text>
              <Button variant="outline" size="sm" onPress={close} style={{ alignSelf: 'flex-start' }}>
                {CLOSE_LABEL}
              </Button>
            </View>
          )}
        </AdaptiveDropdown>
      </View>
    );
  },
};

/** `align="end"` anchors the panel to the right edge of the trigger. */
export const EndAligned: Story = {
  render: () => (
    <AdaptiveDropdown align="end" trigger={EndAlignedTrigger}>
      {ITEMS.map((item) => (
        <MenuItem key={item.label} {...item} />
      ))}
    </AdaptiveDropdown>
  ),
};
