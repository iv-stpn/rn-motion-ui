import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../__stories__/story-elevations';
import { Choice, Controls, Note, Playground, Section, Toggle } from '../../__stories__/story-harness';
import { Bell, Copy, Pencil, Share, Trash2 } from '../../lib/icons';
import { Text } from '../Text/text';
import { HoverMenu, type HoverMenuProps } from './hover-menu';

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
const HINT = 'Hover the trigger on web, tap it on native. The Open switch drives and mirrors the menu state.';

type Align = NonNullable<HoverMenuProps['align']>;
const ALIGNS = ['start', 'end'] as const satisfies readonly Align[];

const WIDTHS = { '200': 200, '260': 260, Trigger: 'trigger' } as const satisfies Record<string, HoverMenuProps['width']>;
type WidthKey = keyof typeof WIDTHS;
const WIDTH_KEYS = ['200', '260', 'Trigger'] as const satisfies readonly WidthKey[];

const OFFSETS = ['0', '4', '16'] as const;
type OffsetKey = (typeof OFFSETS)[number];

// One value feeds both openDelay and closeDelay — the pair reads as a single
// "how eager is the hover" knob.
const DELAYS = [
  { value: '0', label: 'Instant' },
  { value: '100', label: 'Default' },
  { value: '350', label: 'Slow' },
] as const;
type DelayKey = (typeof DELAYS)[number]['value'];

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
  const containerClass = `flex-row items-center gap-2 rounded-full border px-4 py-2 ${open ? 'border-primary bg-primary' : 'border-border bg-surface-3'}`;
  const textClass = open ? 'font-medium text-primary-foreground text-sm' : 'font-medium text-foreground text-sm';
  const label = open ? TRIGGER_OPEN : TRIGGER_CLOSED;
  return (
    <View className={containerClass}>
      <Text className={textClass}>{label}</Text>
    </View>
  );
}

// `w-full` rather than a fixed width so the panel's own width — including
// `width="trigger"` — is what shows.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function MenuContent({ close }: MenuContentProps) {
  return (
    <View className="w-full py-1">
      {ITEMS.map((item) => (
        <Pressable className="flex-row items-center gap-3 px-3 py-2 active:opacity-60" key={item.id} onPress={close}>
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
function HoverMenuPlayground() {
  const [align, setAlign] = useState<Align>('start');
  const [widthKey, setWidthKey] = useState<WidthKey>('200');
  const [offsetKey, setOffsetKey] = useState<OffsetKey>('4');
  const [delayKey, setDelayKey] = useState<DelayKey>('100');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('5');
  const [open, setOpen] = useState(false);

  const delay = Number(delayKey);

  return (
    <Playground>
      <Controls>
        <Choice label="Align" onChange={setAlign} options={ALIGNS} value={align} />
        <Choice label="Width" onChange={setWidthKey} options={WIDTH_KEYS} value={widthKey} />
        <Choice label="Offset" onChange={setOffsetKey} options={OFFSETS} value={offsetKey} />
        <Choice label="Hover delay" onChange={setDelayKey} options={DELAYS} value={delayKey} />
        <Toggle label="Open" onChange={setOpen} value={open} />
      </Controls>

      <Section title="Elevation">
        <View style={{ alignItems: 'flex-start' }}>
          <Choice onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
        </View>
      </Section>

      <Note>{HINT}</Note>

      <View style={{ alignItems: 'flex-start', paddingVertical: 8 }}>
        <HoverMenu
          align={align}
          closeDelay={delay}
          elevation={ELEVATIONS[elevationKey]}
          offset={Number(offsetKey)}
          onOpenChange={setOpen}
          open={open}
          openDelay={delay}
          trigger={renderTrigger}
          width={WIDTHS[widthKey]}
        >
          {renderContent}
        </HoverMenu>
      </View>

      <View style={{ height: 12 }} />
      <Section title="Uncontrolled — keeps its own open state">
        <View style={{ alignItems: 'flex-start' }}>
          <HoverMenu trigger={renderTrigger} width="trigger">
            {renderContent}
          </HoverMenu>
        </View>
      </Section>
    </Playground>
  );
}

export default meta;

/** Align, width, offset, hover delay and elevation on a controlled menu, plus an uncontrolled one. */
export const Interactive: Story = {
  render: () => <HoverMenuPlayground />,
};
