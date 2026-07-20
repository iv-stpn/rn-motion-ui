import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Bell, ChevronDown, Moon, Settings, User } from '../../lib/icons';
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

type DefaultTriggerProps = { open: boolean };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function DefaultTrigger({ open }: DefaultTriggerProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
      }}
    >
      <Text style={{ fontWeight: '500' }}>{MENU_LABEL}</Text>
      <ChevronDown size={16} color={open ? '#111' : '#6b7280'} />
    </View>
  );
}

const TRIGGER_STYLE = {
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderWidth: 1,
  borderColor: '#e5e7eb',
  borderRadius: 8,
} as const;

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
    <AdaptiveDropdown
      trigger={
        <View style={TRIGGER_STYLE}>
          <Text style={{ fontWeight: '500' }}>{OPEN_LABEL}</Text>
        </View>
      }
      title="Options"
      showClose={true}
    >
      {ITEMS.map((item) => (
        <MenuItem key={item.label} {...item} />
      ))}
    </AdaptiveDropdown>
  ),
};

/** `scrollable` wraps content in a ScrollView (useful for long lists). */
export const Scrollable: Story = {
  render: () => (
    <AdaptiveDropdown
      trigger={
        <View style={TRIGGER_STYLE}>
          <Text style={{ fontWeight: '500' }}>{LONG_LIST_LABEL}</Text>
        </View>
      }
      title={SELECT_ITEM_TITLE}
      showClose={true}
      scrollable={true}
      maxHeight={320}
    >
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
        <Text style={{ color: '#6b7280', fontSize: 13 }}>{`open: ${String(open)}`}</Text>
        <AdaptiveDropdown
          open={open}
          onOpenChange={setOpen}
          trigger={
            <View style={TRIGGER_STYLE}>
              <Text style={{ fontWeight: '500' }}>{CONTROLLED_LABEL}</Text>
            </View>
          }
        >
          {({ close }) => (
            <View style={{ padding: 16, gap: 8 }}>
              <Text style={{ color: '#6b7280' }}>{CLOSE_CALLBACK_TEXT}</Text>
              <Pressable
                onPress={close}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 8,
                  alignSelf: 'flex-start',
                }}
              >
                <Text>{CLOSE_LABEL}</Text>
              </Pressable>
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
    <AdaptiveDropdown
      align="end"
      trigger={
        <View style={TRIGGER_STYLE}>
          <Text style={{ fontWeight: '500' }}>{ALIGN_END_LABEL}</Text>
        </View>
      }
    >
      {ITEMS.map((item) => (
        <MenuItem key={item.label} {...item} />
      ))}
    </AdaptiveDropdown>
  ),
};
