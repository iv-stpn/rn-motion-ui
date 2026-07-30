import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../__stories__/story-elevations';
import { Choice, Controls, Note, Playground, Section, Toggle } from '../../__stories__/story-harness';
import { TRIGGER_KINDS, TriggerButton, type TriggerKind } from '../../__stories__/story-trigger';
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
const PLAIN_TRIGGER_LABEL = 'Open menu (plain node)';
const HINT = 'Hover the trigger on web, tap it on native. The Open switch drives and mirrors the menu state.';
// The counterpart to the plain-node section below: a trigger that is pressable in
// its own right swallows the press, so the wrapper's toggle never runs.
const TRIGGER_NOTE =
  "A pressable trigger claims the press, so the wrapper's toggle never fires — take `toggle` from the render prop and wire it to onPress. Pair it with `triggerIsPressable` so the wrapper drops its own button role and tab stop instead of nesting one control inside another. Hover still reaches the wrapper either way, so web hover-open is unaffected.";

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

/** What HoverMenu hands a render-prop trigger. */
type TriggerRenderProps = { open: boolean; toggle: () => void };
type PlainTriggerProps = { open: boolean };
type MenuContentProps = { close: () => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function PlainTrigger({ open }: PlainTriggerProps) {
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

type SwappableTriggerProps = TriggerRenderProps & { kind: TriggerKind };

// The playground's trigger: still the `{ open, toggle }` render prop, but the body
// is a `TriggerButton` so the Trigger chips can swap Button / ElevatedButton /
// GlossyButton / bare Pressable under one menu. Each of those is pressable in its
// own right, which is exactly why `onPress` has to be `toggle` — see TRIGGER_NOTE.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function SwappableTrigger({ kind, open, toggle }: SwappableTriggerProps) {
  return <TriggerButton buttonVariant="outline" kind={kind} label={open ? TRIGGER_OPEN : TRIGGER_CLOSED} onPress={toggle} />;
}

const renderPlainTrigger = (props: PlainTriggerProps) => <PlainTrigger open={props.open} />;
const renderContent = (props: MenuContentProps) => <MenuContent close={props.close} />;

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function HoverMenuPlayground() {
  const [align, setAlign] = useState<Align>('start');
  const [widthKey, setWidthKey] = useState<WidthKey>('200');
  const [offsetKey, setOffsetKey] = useState<OffsetKey>('4');
  const [delayKey, setDelayKey] = useState<DelayKey>('100');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('5');
  const [triggerKind, setTriggerKind] = useState<TriggerKind>('button');
  const [open, setOpen] = useState(false);

  const delay = Number(delayKey);
  const renderTrigger = useCallback(
    (props: TriggerRenderProps) => <SwappableTrigger kind={triggerKind} open={props.open} toggle={props.toggle} />,
    [triggerKind],
  );

  return (
    <Playground>
      <Controls>
        <Choice label="Align" onChange={setAlign} options={ALIGNS} value={align} />
        <Choice label="Width" onChange={setWidthKey} options={WIDTH_KEYS} value={widthKey} />
        <Choice label="Offset" onChange={setOffsetKey} options={OFFSETS} value={offsetKey} />
        <Choice label="Hover delay" onChange={setDelayKey} options={DELAYS} value={delayKey} />
        <Choice label="Trigger" onChange={setTriggerKind} options={TRIGGER_KINDS} value={triggerKind} />
        <Toggle label="Open" onChange={setOpen} value={open} />
      </Controls>

      <Section title="Elevation">
        <View className="items-start">
          <Choice onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
        </View>
      </Section>

      <Note>{HINT}</Note>

      <View className="items-start py-2">
        <HoverMenu
          align={align}
          closeDelay={delay}
          elevation={ELEVATIONS[elevationKey]}
          offset={Number(offsetKey)}
          onOpenChange={setOpen}
          open={open}
          openDelay={delay}
          trigger={renderTrigger}
          triggerIsPressable={true}
          width={WIDTHS[widthKey]}
        >
          {renderContent}
        </HoverMenu>
      </View>

      <Note>{TRIGGER_NOTE}</Note>

      <View className="h-3" />
      <Section title="Plain node trigger — uncontrolled, and the wrapper owns the press">
        <View className="items-start">
          <HoverMenu trigger={renderPlainTrigger} triggerAccessibilityLabel={PLAIN_TRIGGER_LABEL} width="trigger">
            {renderContent}
          </HoverMenu>
        </View>
      </Section>
    </Playground>
  );
}

const DEMO_TESTID = 'hover-menu-demo';
const DEMO_PANEL_TESTID = `${DEMO_TESTID}-panel`;

// Uncontrolled, plain-node trigger — the wrapper owns both the hover and the
// press, so the play function exercises the component's own state machine
// rather than the playground's `open` mirror.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function HoverMenuDemo() {
  return (
    <HoverMenu testID={DEMO_TESTID} trigger={renderPlainTrigger} triggerAccessibilityLabel={PLAIN_TRIGGER_LABEL} width="trigger">
      {renderContent}
    </HoverMenu>
  );
}

export default meta;

/** Align, width, offset, hover delay and elevation on a controlled menu, plus an uncontrolled one. */
export const Interactive: Story = {
  render: () => <HoverMenuPlayground />,
};

/**
 * Pins the full hover cycle: the panel opens on hover-in after `openDelay` and
 * — the half that has broken before — closes again on the *first* hover-out.
 *
 * react-native-web's `useHover` binds its `pointerleave` listener from inside
 * the `pointerenter` handler and never re-binds it when the prop identity
 * changes, so the hover-out handler captured at enter time is the one that runs
 * on leave. A handler closing over `open` was therefore captured while the menu
 * was still closed (hover opens on a timer, after enter), bailed out of its
 * `if (!open) return` guard, and left the menu stuck open until a second hover
 * happened to enter while already open. `handleHoverOut` reads `openRef`
 * instead; this asserts that one hover round-trip is enough.
 */
export const Default: Story = {
  name: 'Demo: Hover opens and closes it',
  render: () => <HoverMenuDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByTestId(DEMO_TESTID);
    await expect(canvas.queryByTestId(DEMO_PANEL_TESTID)).toBeNull();

    // The panel is a sibling in the same tree on web (position: fixed, no
    // portal), so it answers the canvas queries rather than needing `screen`.
    await userEvent.hover(trigger);
    await waitFor(() => expect(canvas.getByTestId(DEMO_PANEL_TESTID)).toBeInTheDocument());
    await expect(await canvas.findByText('Duplicate')).toBeInTheDocument();

    // closeDelay (150ms) then the 180ms exit animation before it unmounts.
    await userEvent.unhover(trigger);
    await waitFor(() => expect(canvas.queryByTestId(DEMO_PANEL_TESTID)).toBeNull(), { timeout: 2000 });
  },
};
