import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Note, Playground, Section, Toggle } from '../../../__stories__/story-harness';
import { TriggerButton, TriggerControls, type TriggerState, useTriggerState } from '../../../__stories__/story-trigger';
import { Bell, Copy, Pencil, Share, Trash2 } from '../../../lib/icons';
import { Text } from '../../typography/Text/text';
import { Menu } from '../Menu/menu';
import type { MenuItemIcon } from '../MenuItem/menu-item';
import { HoverMenu, type HoverMenuProps } from './hover-menu';

const meta = {
  title: 'Menus/HoverMenu',
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

type MenuItemDef = { id: string; label: string; icon: MenuItemIcon };

const ITEMS: MenuItemDef[] = [
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'edit', label: 'Edit', icon: Pencil },
  { id: 'share', label: 'Share', icon: Share },
  { id: 'duplicate', label: 'Duplicate', icon: Copy },
  { id: 'delete', label: 'Delete', icon: Trash2 },
];

/** What HoverMenu hands a render-prop trigger. */
type TriggerRenderProps = { open: boolean; toggle: () => void };
type PlainTriggerProps = { open: boolean };

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

type SwappableTriggerProps = TriggerRenderProps & Pick<TriggerState, 'kind' | 'size' | 'shape'>;

// The playground's trigger: still the `{ open, toggle }` render prop, but the body
// is a `TriggerButton` so the Trigger chips can swap Button / ElevatedButton /
// GlossyButton / bare Pressable under one menu. Each of those is pressable in its
// own right, which is exactly why `onPress` has to be `toggle` — see TRIGGER_NOTE.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function SwappableTrigger({ kind, size, shape, open, toggle }: SwappableTriggerProps) {
  return (
    <TriggerButton
      buttonVariant="outline"
      kind={kind}
      size={size}
      shape={shape}
      label={open ? TRIGGER_OPEN : TRIGGER_CLOSED}
      onPress={toggle}
    />
  );
}

const renderPlainTrigger = (props: PlainTriggerProps) => <PlainTrigger open={props.open} />;

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function HoverMenuPlayground() {
  const [align, setAlign] = useState<Align>('start');
  const [widthKey, setWidthKey] = useState<WidthKey>('200');
  const [offsetKey, setOffsetKey] = useState<OffsetKey>('4');
  const [delayKey, setDelayKey] = useState<DelayKey>('100');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('5');
  const trigger = useTriggerState();
  const [open, setOpen] = useState(false);

  const delay = Number(delayKey);
  const renderTrigger = useCallback(
    (props: TriggerRenderProps) => (
      <SwappableTrigger kind={trigger.kind} size={trigger.size} shape={trigger.shape} open={props.open} toggle={props.toggle} />
    ),
    [trigger.kind, trigger.size, trigger.shape],
  );

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Align" onChange={setAlign} options={ALIGNS} value={align} />
        <Choice label="Width" onChange={setWidthKey} options={WIDTH_KEYS} value={widthKey} />
        <Choice label="Offset" onChange={setOffsetKey} options={OFFSETS} value={offsetKey} />
        <Choice label="Hover delay" onChange={setDelayKey} options={DELAYS} value={delayKey} />
        <Toggle label="Open" onChange={setOpen} value={open} />
      </ControlCard>

      <ControlCard title="Elevation">
        <Choice onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
      </ControlCard>

      <TriggerControls state={trigger} />

      <Note>{HINT}</Note>

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
        <Menu entries={ITEMS} />
      </HoverMenu>

      <Note>{TRIGGER_NOTE}</Note>

      <View className="h-3" />
      <Section title="Plain node trigger — uncontrolled, and the wrapper owns the press">
        <View className="items-start">
          <HoverMenu trigger={renderPlainTrigger} triggerAccessibilityLabel={PLAIN_TRIGGER_LABEL} width="trigger">
            <Menu entries={ITEMS} />
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
      <Menu entries={ITEMS} />
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

    // closeDelay (150ms) then the shared 200ms menu exit before it unmounts.
    await userEvent.unhover(trigger);
    await waitFor(() => expect(canvas.queryByTestId(DEMO_PANEL_TESTID)).toBeNull(), { timeout: 2000 });
  },
};
