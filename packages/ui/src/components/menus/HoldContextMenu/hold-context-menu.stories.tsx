/**
 * Stories for `HoldContextMenu`, the hold-to-lift action menu ported from
 * react-native-hold-menu.
 *
 * These run under react-native-web, which is the platform where the component
 * deliberately does something else: right-click opens a plain dropdown, and the
 * hold, the lift and the dim are all native-only. So the demo's `play` pins both
 * halves of that — a long press that must do *nothing*, and a right-click that
 * must open the panel with no lifted copy behind it.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Note, Playground, Sample, Toggle, Variants } from '../../../__stories__/story-harness';
import { cn } from '../../../lib/cn';
import { Copy, MessageCircle, Pin, Share2, Trash2 } from '../../../lib/icons';
import { Text } from '../../typography/Text/text';
import {
  HoldContextMenu,
  type HoldContextMenuActivation,
  type HoldContextMenuItem,
  type HoldContextMenuMotion,
} from './hold-context-menu';

const INCOMING = 'Ported the hold menu — right-click me here, hold me on a phone.';
const OUTGOING = 'Same panel, anchored to the other edge.';
const REPLY = 'Reply';
const FORWARD = 'Forward';
const HEADING = 'Message';
/** Names the trigger for assistive tech — a bubble of text is not a label. */
const BUBBLE_LABEL = 'Message from Ada';
/** The component's default `menuAccessibilityLabel` and `closeAccessibilityLabel`. */
const MENU_LABEL = 'Actions';
const CLOSE_MENU = 'Close menu';
const HINT = 'Right-click a bubble here. On iOS and Android, hold it.';
const HINT_DETAIL =
  'Web gets a dropdown anchored to the bubble. Native lifts the bubble off a dimmed page and floats the panel beside it.';
const GESTURE_NOTE =
  'Activate on: “hold” is a right-click on web; “tap” and “double-tap” read the same with a mouse, so those stay on the press.';
const NATIVE_ONLY_NOTE = 'Close on tap and Pin item in place only do something where the item lifts — native.';
const MOTION_NOTE =
  'Motion: “shared” is the preset AdaptiveDropdown, HoverMenu and Popover also open on; “ios-pop” is the scale-out this component shipped with. Reduced motion cuts all three to a fade.';

/** Past the 300 ms default `holdDuration`, with room for the responder to settle. */
const LONG_PRESS_MS = 700;

const DEMO_TEST_ID = 'story-hold-demo';

const ACTIVATIONS = ['hold', 'tap', 'double-tap'] as const;
const SIDES = ['auto', 'top', 'bottom'] as const;
const ALIGNS = ['auto', 'start', 'center', 'end'] as const;
const WIDTHS = ['200', '240', '300'] as const;
const MOTIONS = ['shared', 'ios-pop', 'gentle'] as const;

type Side = (typeof SIDES)[number];
type Align = (typeof ALIGNS)[number];
type WidthKey = (typeof WIDTHS)[number];
type MotionKey = (typeof MOTIONS)[number];

/**
 * What `motion` can do to the panel.
 *
 * `shared` is `undefined` — the package-wide preset every anchored menu opens on,
 * which is the point of the prop having a default worth keeping. `ios-pop` is
 * upstream react-native-hold-menu's own entrance: a hard scale out of the corner
 * with no slide, which is the animation this component shipped with before the
 * four menus were standardised.
 */
const MOTION_PRESETS: Record<MotionKey, HoldContextMenuMotion | undefined> = {
  gentle: {
    enter: { type: 'spring', damping: 22, mass: 1.1, stiffness: 140 },
    exit: { type: 'timing', duration: 320 },
    offset: 16,
  },
  'ios-pop': { offset: 0, scale: 0.6 },
  shared: undefined,
};

type ItemOptions = { heading: boolean; separator: boolean; disabled: boolean };

/** The message menu every story shares, minus whichever rows are toggled off. */
function buildItems({ heading, separator, disabled }: ItemOptions): HoldContextMenuItem[] {
  return [
    ...(heading ? [{ heading: true, id: 'heading', label: HEADING }] : []),
    { icon: MessageCircle, id: 'reply', label: REPLY },
    { icon: Copy, id: 'copy', label: 'Copy' },
    { icon: Pin, id: 'pin', label: 'Pin', separator },
    { disabled, icon: Share2, id: 'forward', label: FORWARD },
    { destructive: true, icon: Trash2, id: 'delete', label: 'Delete' },
  ];
}

const DEMO_ITEMS = buildItems({ disabled: true, heading: true, separator: true });

type BubbleProps = { children: ReactNode; outgoing?: boolean };

/** A chat bubble — the shape this interaction was built for. */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function Bubble({ children, outgoing = false }: BubbleProps) {
  return (
    <View
      className={cn('max-w-[260px] rounded-2xl px-4 py-2.5', outgoing ? 'rounded-br-md bg-info' : 'rounded-bl-md bg-surface-3')}
    >
      <Text className={outgoing ? 'text-info-foreground' : 'text-foreground'} size="sm">
        {children}
      </Text>
    </View>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper co-located with its stories
function HoldContextMenuPlayground() {
  const [activateOn, setActivateOn] = useState<HoldContextMenuActivation>('hold');
  const [side, setSide] = useState<Side>('auto');
  const [align, setAlign] = useState<Align>('auto');
  const [widthKey, setWidthKey] = useState<WidthKey>('240');
  const [motionKey, setMotionKey] = useState<MotionKey>('shared');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('6');
  const [heading, setHeading] = useState(true);
  const [separator, setSeparator] = useState(true);
  const [disabled, setDisabled] = useState(true);
  const [disableMove, setDisableMove] = useState(false);
  const [closeOnTap, setCloseOnTap] = useState(true);
  const [picked, setPicked] = useState('—');

  const items = useMemo(() => buildItems({ disabled, heading, separator }), [disabled, heading, separator]);
  const handleSelect = useCallback((item: HoldContextMenuItem) => setPicked(String(item.label)), []);

  // One object, spread into both bubbles: the pair exists to show the automatic
  // side/align picking against opposite screen edges, not to vary the menu.
  const menuProps = {
    activateOn,
    align,
    closeOnTap,
    disableMove,
    elevation: ELEVATIONS[elevationKey],
    items,
    menuWidth: Number(widthKey),
    motion: MOTION_PRESETS[motionKey],
    onSelect: handleSelect,
    side,
  };

  return (
    <Playground className="min-w-[340px]">
      <ControlCard title="Panel">
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
        <Choice label="Side" onChange={setSide} options={SIDES} value={side} />
        <Choice label="Align" onChange={setAlign} options={ALIGNS} value={align} />
        <Choice label="Width" onChange={setWidthKey} options={WIDTHS} value={widthKey} />
        <Choice label="Motion" onChange={setMotionKey} options={MOTIONS} value={motionKey} />
      </ControlCard>

      <ControlCard title="Gesture">
        <Choice label="Activate on" onChange={setActivateOn} options={ACTIVATIONS} value={activateOn} />
        <Toggle label="Close on tap" onChange={setCloseOnTap} value={closeOnTap} />
        <Toggle label="Pin item in place" onChange={setDisableMove} value={disableMove} />
      </ControlCard>

      <ControlCard title="Rows">
        <Toggle label="Heading" onChange={setHeading} value={heading} />
        <Toggle label="Separator" onChange={setSeparator} value={separator} />
        <Toggle label="Disabled row" onChange={setDisabled} value={disabled} />
      </ControlCard>

      <Variants align="stretch" direction="column">
        <Sample label="Incoming">
          <HoldContextMenu {...menuProps} accessibilityLabel={BUBBLE_LABEL} testID="story-hold-incoming">
            <Bubble>{INCOMING}</Bubble>
          </HoldContextMenu>
        </Sample>
        <Sample align="flex-end" label="Outgoing">
          <HoldContextMenu {...menuProps} accessibilityLabel="Your reply" className="self-end" testID="story-hold-outgoing">
            <Bubble outgoing={true}>{OUTGOING}</Bubble>
          </HoldContextMenu>
        </Sample>
      </Variants>

      <Note testID="story-picked">{`Picked: ${picked}`}</Note>
      <Note>{HINT}</Note>
      <Note>{HINT_DETAIL}</Note>
      <Note>{GESTURE_NOTE}</Note>
      <Note>{NATIVE_ONLY_NOTE}</Note>
      <Note>{MOTION_NOTE}</Note>
    </Playground>
  );
}

/**
 * Press and hold `node` past the long-press threshold.
 *
 * On web this is expected to do nothing — the assertion it supports is that a
 * hold is *not* an activation there. It still has to be a faithful hold, or the
 * assertion would pass for the wrong reason.
 *
 * Raw MouseEvents rather than `userEvent.pointer`: react-native-web's responder
 * system listens on `mousedown`/`mouseup`, and user-event's drag-select
 * emulation fires a `selectionchange` the responder reads as a terminated
 * gesture — which cancels the press before the long-press timer fires.
 */
async function longPress(node: Element): Promise<void> {
  const fire = (type: string) => node.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, cancelable: true }));
  fire('mousedown');
  await new Promise((resolve) => setTimeout(resolve, LONG_PRESS_MS));
  fire('mouseup');
  // RNW cancels the click that follows a dispatched long press; the gesture is
  // already delivered by then, so the event is sent for fidelity, not effect.
  fire('click');
}

const meta = {
  title: 'Menus/HoldContextMenu',
  component: HoldContextMenu,
  parameters: { layout: 'centered' },
  // children is supplied per story; a stub satisfies the type checker.
  args: { children: null, items: DEMO_ITEMS },
} satisfies Meta<typeof HoldContextMenu>;

type Story = StoryObj<typeof meta>;

export default meta;

/** Every knob in one canvas: gesture, side, align, width, elevation, row kinds, travel. */
export const Interactive: Story = { render: () => <HoldContextMenuPlayground /> };

/**
 * The default gesture, per platform: hold on native, right-click here.
 *
 * This story runs under react-native-web, so it pins the web contract — and the
 * first thing it asserts is a negative. A long press does nothing: the component
 * hands `Pressable` no press handler at all on web, so a held left button falls
 * through to whatever the children do with it. The right-click is the whole
 * gesture, and it is the keyboard path too, since browsers raise `contextmenu`
 * for Shift+F10 and the ContextMenu key on the focused trigger.
 *
 * What opens is a dropdown: no dim, no lifted copy, the bubble stays exactly
 * where it is. The lift is asserted absent rather than merely unmentioned —
 * `children` rendering twice is the one thing a consumer would feel.
 */
export const Default: Story = {
  name: 'Demo: Right-click to open the menu',
  args: { accessibilityLabel: BUBBLE_LABEL, onSelect: fn(), testID: DEMO_TEST_ID },
  render: (args) => (
    <View className="items-center gap-4">
      <HoldContextMenu {...args}>
        <Bubble>{INCOMING}</Bubble>
      </HoldContextMenu>
      <Note>{HINT}</Note>
    </View>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole('button', { name: BUBBLE_LABEL });
    await expect(trigger).not.toHaveAttribute('aria-expanded', 'true');

    // Inert on web: the hold gesture is native-only, and nothing mounts.
    await longPress(trigger);
    await expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.pointer({ target: trigger, keys: '[MouseRight]' });

    // The overlay mounts in a Modal, so it answers `screen`, not the canvas.
    const menu = await screen.findByRole('menu', { name: MENU_LABEL });
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // A dropdown, not a lift: the bubble is still the one in the page, there is
    // no second copy of it, and the scrim behind the panel paints nothing.
    await expect(screen.queryByTestId(`${DEMO_TEST_ID}-lifted`)).toBeNull();
    await expect(trigger).toBeVisible();
    const backdrop = await screen.findByTestId(`${DEMO_TEST_ID}-backdrop`);
    await expect(getComputedStyle(backdrop).backgroundColor).toBe('rgba(0, 0, 0, 0)');

    // The heading is a caption, not a command: still readable, but never offered
    // as something to activate.
    await expect(within(menu).getByText(HEADING)).toBeInTheDocument();
    await expect(within(menu).queryByRole('menuitem', { name: HEADING })).toBeNull();
    // A disabled row stays announced, and says that it is disabled — dimming
    // alone would leave it looking live to a screen reader.
    await expect(await screen.findByRole('menuitem', { name: FORWARD })).toHaveAttribute('aria-disabled', 'true');

    // Picking a row runs the action and takes the whole overlay with it.
    await userEvent.click(await screen.findByRole('menuitem', { name: REPLY }));
    await waitFor(() => expect(args.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'reply' })));
    // The Modal is released once the exit springs settle, so the dialog leaving
    // is the real close — the panel unmounting is only the first half of it.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 2000 });
    await expect(trigger).not.toHaveAttribute('aria-expanded', 'true');

    // Click-outside is the other way out, and the scrim carries a real button
    // role and name so it is reachable without a pointer.
    await userEvent.pointer({ target: trigger, keys: '[MouseRight]' });
    await screen.findByRole('menu', { name: MENU_LABEL });
    await userEvent.click(await screen.findByRole('button', { name: CLOSE_MENU }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 2000 });
  },
};
