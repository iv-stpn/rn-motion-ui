import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Bell, Copy, Pencil, Share, Trash2 } from '../../lib/icons';
import { Text } from '../Text/text';
import { HoverMenu } from './hover-menu';

const meta = {
  title: 'Components/HoverMenu',
  component: HoverMenu,
  parameters: { layout: 'centered' },
  // Each story's render supplies real trigger/children; stubs satisfy the type checker.
  args: {
    trigger: 'Open menu',
    children: 'Menu content',
  },
} satisfies Meta<typeof HoverMenu>;

type Story = StoryObj<typeof meta>;

const TRIGGER_CLOSED = 'Open menu';
const TRIGGER_OPEN = 'Close menu';

type MenuItemDef = { id: string; label: string; icon: ReactNode };

const ITEMS: MenuItemDef[] = [
  { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
  { id: 'edit', label: 'Edit', icon: <Pencil size={18} /> },
  { id: 'share', label: 'Share', icon: <Share size={18} /> },
  { id: 'duplicate', label: 'Duplicate', icon: <Copy size={18} /> },
  { id: 'delete', label: 'Delete', icon: <Trash2 size={18} /> },
];

type TriggerProps = { open: boolean };
type MenuContentProps = { close: () => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function Trigger({ open }: TriggerProps) {
  const containerClass = `flex-row items-center gap-2 rounded-full border px-4 py-2 ${open ? 'border-primary bg-primary' : 'border-border bg-card'}`;
  const textClass = open ? 'font-medium text-primary-foreground text-sm' : 'font-medium text-foreground text-sm';
  const label = open ? TRIGGER_OPEN : TRIGGER_CLOSED;
  return (
    <View className={containerClass}>
      <Text className={textClass}>{label}</Text>
    </View>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function MenuContent({ close }: MenuContentProps) {
  return (
    <View className="w-48 py-1">
      {ITEMS.map((item) => (
        <Pressable key={item.id} onPress={close} className="flex-row items-center gap-3 px-3 py-2 active:opacity-60">
          {item.icon}
          <Text className="text-foreground text-sm">{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const renderTrigger = (props: TriggerProps) => <Trigger open={props.open} />;
const renderContent = (props: MenuContentProps) => <MenuContent close={props.close} />;

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function ControlledHoverMenu() {
  const [open, setOpen] = useState(false);
  return (
    <View className="p-8">
      <HoverMenu open={open} onOpenChange={setOpen} trigger={renderTrigger}>
        {renderContent}
      </HoverMenu>
    </View>
  );
}

export default meta;

export const Default: Story = {
  render: () => (
    <View className="p-8">
      <HoverMenu trigger={renderTrigger}>{renderContent}</HoverMenu>
    </View>
  ),
};

export const Controlled: Story = {
  render: () => <ControlledHoverMenu />,
};
