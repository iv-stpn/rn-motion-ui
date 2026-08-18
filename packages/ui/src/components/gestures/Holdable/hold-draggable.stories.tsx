/**
 * Stories for `HoldDraggable` — hold + drag in one gesture.
 *
 * `<HoldDraggable>` is `<Draggable trackPhase>` with the render-prop always on:
 * same four-phase timeline, same ghost, same `<DragManager>` integration. The
 * drag half is covered by draggable.stories.tsx; these stories focus on the hold
 * half and the render-prop child.
 *
 * **Web hold defaults.** The drag pointer transport defaults to `holdDelay: null`
 * on web — a long press there already means context menu or text selection. To
 * enable `onHold` on web, pass `behavior={{ holdDelay: 300 }}` (or use a touch
 * device). The play functions below do exactly that, and dispatch synthetic touch
 * pointer events.
 *
 * **Cursor mode.** `cursorMode` opts in to mouse left-button holds (and drags)
 * on web. When set, the pointer transport accepts mouse events and the HTML5
 * transport is disabled for this source. The "Cursor" story below exercises
 * the hold path with synthetic mouse pointer events.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Chat1Line as MessageCircle } from 'rn-motion-ui-icons/icons/chat-1-line';
import { CopyLine as Copy } from 'rn-motion-ui-icons/icons/copy-line';
import { ShareForwardLine as Share2 } from 'rn-motion-ui-icons/icons/share-forward-line';
import { expect, waitFor, within } from 'storybook/test';
import { ControlCard, Note, Playground, Toggle } from '../../../__stories__/story-harness';
import { HoldContextMenu, type HoldContextMenuItem } from '../../menus/HoldContextMenu/hold-context-menu';
import { Text } from '../../typography/Text/text';
import { HoldDraggable } from './hold-draggable';

/** The MIME the chip writes and a `<Dragzone>` would read. */
const MIME = 'application/x-story-hold-item';

const CHIP_TEST_ID = 'story-hold-draggable-chip';
const READOUT_TEST_ID = 'story-hold-draggable-readout';

type TouchPoint = { x?: number; y?: number };

/** Dispatch a synthetic touch pointer event directly on a DOM node. */
function touchPointer(node: Element, type: string, point: TouchPoint = {}) {
  node.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'touch',
      buttons: type === 'pointerdown' ? 1 : 0,
      clientX: point.x ?? 0,
      clientY: point.y ?? 0,
    }),
  );
}

/** Dispatch a synthetic mouse pointer event — for exercising `cursorMode`. */
function mousePointer(node: Element, type: string, point: TouchPoint = {}) {
  node.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: type === 'pointerdown' ? 1 : 0,
      clientX: point.x ?? 0,
      clientY: point.y ?? 0,
      pointerId: 1,
      pointerType: 'mouse',
    }),
  );
}

type HoldDragDemoProps = { cursorMode?: boolean; disabled?: boolean; showMenu?: boolean };

function chipClass(isHeld: boolean, isPressed: boolean) {
  if (isHeld) return 'rounded-xl border border-primary bg-primary/10 px-6 py-4';
  if (isPressed) return 'rounded-xl border border-border bg-surface-2 px-6 py-4 opacity-70';
  return 'rounded-xl border border-border bg-surface-2 px-6 py-4';
}

function chipLabel(isHeld: boolean, isPressed: boolean) {
  if (isHeld) return 'Held — move to drag';
  if (isPressed) return 'Armed…';
  return 'Hold or drag me';
}

/** A few actions for the hold context menu. */
const MENU_ITEMS: HoldContextMenuItem[] = [
  { icon: MessageCircle, id: 'reply', label: 'Reply' },
  { icon: Copy, id: 'copy', label: 'Copy' },
  { icon: Share2, id: 'share', label: 'Share' },
];

/**
 * A chip that logs each significant phase event to a readout.
 *
 * `behavior={{ holdDelay: 300 }}` is set explicitly so `onHold` fires on web —
 * the drag pointer transport defaults to `holdDelay: null` there.
 *
 * When `showMenu` is on the chip is wrapped in a `<HoldContextMenu>` with
 * `dragOptions` — hold opens the action panel, and a move past `escapeSlop`
 * after arming lifts a drag. On web the menu opens on right-click.
 */
function HoldDragDemo({ cursorMode = false, disabled = false, showMenu = false }: HoldDragDemoProps) {
  const [status, setStatus] = useState('Waiting');
  const [picked, setPicked] = useState('—');

  const handleHold = useCallback(() => setStatus('Held'), []);
  const handleEscape = useCallback(() => setStatus('Escaped (drag started)'), []);
  const handleDragStart = useCallback(() => setStatus('Dragging'), []);
  const handleDragEnd = useCallback(() => setStatus('Done'), []);
  const handleSelect = useCallback((item: HoldContextMenuItem) => {
    setPicked(String(item.label));
    setStatus(`Menu: ${String(item.label)}`);
  }, []);

  const chipBody = (
    <View className="rounded-xl border border-border bg-surface-2 px-6 py-4">
      <Text size="sm" weight="medium">
        Hold for menu · Move to drag
      </Text>
    </View>
  );

  return (
    <View className="items-start gap-3">
      {showMenu ? (
        <HoldContextMenu
          activateOn="hold"
          behavior={{ holdDelay: 300 }}
          dragOptions={{
            data: { [MIME]: 'item' },
            onDragEnd: handleDragEnd,
            onDragStart: handleDragStart,
          }}
          items={MENU_ITEMS}
          onHold={handleHold}
          onSelect={handleSelect}
          testID="story-hold-menu-chip"
        >
          {chipBody}
        </HoldContextMenu>
      ) : (
        <HoldDraggable
          // Enable hold on web: the drag transport defaults to holdDelay: null there.
          behavior={{ holdDelay: 300 }}
          cursorMode={cursorMode}
          data={{ [MIME]: 'item' }}
          disabled={disabled}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
          onHold={handleHold}
          onHoldEscape={handleEscape}
          testID={CHIP_TEST_ID}
        >
          {({ isHeld, isPressed }) => (
            <View className={chipClass(isHeld, isPressed)}>
              <Text size="sm" weight="medium">
                {chipLabel(isHeld, isPressed)}
              </Text>
            </View>
          )}
        </HoldDraggable>
      )}
      <Note testID={READOUT_TEST_ID}>{status}</Note>
      {showMenu ? <Note testID="story-hold-menu-picked">{`Picked: ${picked}`}</Note> : null}
      <Note>
        {showMenu
          ? 'Hold 300ms for the menu; move after arming to drag. Right-click on web.'
          : 'Hold 300ms for the menu path; move after 150ms to drag instead.'}
      </Note>
    </View>
  );
}

function HoldDragPlayground() {
  const [cursorMode, setCursorMode] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <Playground>
      <ControlCard title="Options">
        <Toggle label="Cursor mode" onChange={setCursorMode} value={cursorMode} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
        <Toggle label="Hold context menu" onChange={setShowMenu} value={showMenu} />
      </ControlCard>
      <HoldDragDemo cursorMode={cursorMode} disabled={disabled} showMenu={showMenu} />
    </Playground>
  );
}

const meta = {
  title: 'Gestures/HoldDraggable',
  component: HoldDraggable,
  parameters: { layout: 'centered' },
  args: { children: null, data: {} },
} satisfies Meta<typeof HoldDraggable>;

type Story = StoryObj<typeof meta>;

export default meta;

/** Every knob: phase callbacks, drag callbacks, and the `disabled` toggle. */
export const Interactive: Story = { render: () => <HoldDragPlayground /> };

/**
 * A hold that runs to completion — the drag path not taken.
 *
 * The pointer stays down past `holdDelay` without moving; `onHold` fires and the
 * chip enters the held visual state. Moving after this point would start a drag
 * with the escape threshold (`escapeSlop`) rather than the regular slop.
 */
export const Default: Story = {
  name: 'Demo: Hold fires onHold at 300ms (no drag)',
  render: () => <HoldDragDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByTestId(CHIP_TEST_ID);

    touchPointer(chip, 'pointerdown');
    // Hold past holdDelay (300ms).
    await new Promise((r) => setTimeout(r, 350));

    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Held');

    touchPointer(chip, 'pointerup');
    await new Promise((r) => setTimeout(r, 0));
  },
};

/**
 * The drag path out of an open hold context menu — and the close it forces.
 *
 * Hold 300ms and the menu opens (`onHold` reports 'Held'). A move past
 * `escapeSlop` after that lifts a drag: `onHoldEscape` closes the menu and
 * `onDragStart` fires in the same gesture. The trigger stays motionless through
 * that handover — its squeeze released when the menu opened, not now (the
 * `HoldContent` latch in hold-context-menu-trigger.tsx), so nothing pops back
 * to full size under the exiting panel.
 */
export const MenuEscapeToDrag: Story = {
  name: 'Behaviour: Move after the menu opens escapes into a drag',
  render: () => <HoldDragDemo showMenu={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The menu chip's testID sits on the measured wrapper; the pointer transport
    // listens on the HoldDraggable host inside it, so dispatch on the label and
    // let the events bubble up to it.
    // findAllByText: Draggable renders children twice (functional + offscreen
    // preview ghost) — pick the first (functional) copy.
    const chips = await canvas.findAllByText('Hold for menu · Move to drag');
    const chip = chips[0];
    if (!chip) throw new Error('no HoldDraggable chip rendered');

    touchPointer(chip, 'pointerdown');
    // Hold past holdDelay (300ms) — the menu opens and the hold reports.
    // findByText retries, so a busy frame cannot race the hold timer.
    await new Promise((r) => setTimeout(r, 350));
    await canvas.findByText('Held');

    // A shove past escapeSlop (24px on web): the drag lifts, the menu closes.
    touchPointer(chip, 'pointermove', { x: 60 });
    await canvas.findByText('Dragging');

    // The ghost's first frame sits over the source. A displaced seed in
    // `session.begin` (anything but the zero `move` would compute at the lift)
    // paints the first frame offset by the within-source grab position — 60px
    // here — and snaps back on the next move. The tolerance only absorbs the
    // few px the chip's own un-squeeze spring is still moving it.
    const copies = canvas.getAllByText('Hold for menu · Move to drag');
    await expect(copies).toHaveLength(2);
    const [chipRect, ghostRect] = copies.map((el) => el.getBoundingClientRect());
    await expect(Math.abs((chipRect?.x ?? 0) - (ghostRect?.x ?? 0))).toBeLessThan(10);
    await expect(Math.abs((chipRect?.y ?? 0) - (ghostRect?.y ?? 0))).toBeLessThan(10);

    touchPointer(chip, 'pointerup', { x: 60 });
    await canvas.findByText('Done');
  },
};

/**
 * With `cursorMode`, a mouse left-button press runs the same hold timeline a
 * touch press does. The synthetic mouse pointer events stay down past
 * `holdDelay` (300ms) and `onHold` fires. Right-click is still the browser's
 * own context menu.
 */
export const Cursor: Story = {
  name: 'Demo: cursorMode enables mouse-hold on web',
  render: () => <HoldDragDemo cursorMode={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByTestId(CHIP_TEST_ID);

    mousePointer(chip, 'pointerdown');
    // Hold past holdDelay (300ms).
    await new Promise((r) => setTimeout(r, 350));

    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Held');

    mousePointer(chip, 'pointerup');
    await new Promise((r) => setTimeout(r, 0));
  },
};

/**
 * `disabled` removes both transports: no hold fires and no drag starts, even
 * with a long touch press.
 */
export const Disabled: Story = {
  name: 'Behaviour: Disabled — neither hold nor drag fires',
  render: () => <HoldDragDemo disabled={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByTestId(CHIP_TEST_ID);

    touchPointer(chip, 'pointerdown');
    await new Promise((r) => setTimeout(r, 350));
    touchPointer(chip, 'pointerup');
    await new Promise((r) => setTimeout(r, 0));

    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Waiting');
  },
};

// ─── 100 draggables in a ScrollView ──────────────────────────────────────────
// A ScrollView full of hold-draggables. Holding one arms it for a drag (the
// 300ms hold upgrades the press), while a quick swipe on the gaps — or a mouse
// wheel — scrolls the list. The two coexist because the hold timer is what turns
// a press into a drag; anything shorter stays the ScrollView's.

const SCROLL_ITEM_COUNT = 100;
const SCROLL_ITEM_TEST_ID = 'story-hold-scroll-item';
const SCROLL_ITEM_TESTID_PATTERN = /^story-hold-scroll-item-/;
const SCROLL_VIEW_TEST_ID = 'story-hold-scroll-view';
const SCROLL_READOUT_TEST_ID = 'story-hold-scroll-readout';

const SCROLL_ITEMS = Array.from({ length: SCROLL_ITEM_COUNT }, (_, i) => ({ id: String(i), label: `Item ${i + 1}` }));

function ScrollViewDemo() {
  const [last, setLast] = useState('Waiting');

  const handleHold = useCallback((label: string) => setLast(`Held ${label}`), []);
  const handleEscape = useCallback((label: string) => setLast(`Drag ${label}`), []);

  return (
    <View className="flex-1">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-[#6b7280] text-[12px]">{`${SCROLL_ITEM_COUNT} draggables in a ScrollView`}</Text>
        <Text className="text-[#6b7280] text-[12px]" testID={SCROLL_READOUT_TEST_ID}>
          {last}
        </Text>
      </View>
      <ScrollView style={{ height: 420 }} contentContainerClassName="gap-2 p-4" testID={SCROLL_VIEW_TEST_ID}>
        {SCROLL_ITEMS.map((item) => (
          <HoldDraggable
            key={item.id}
            behavior={{ holdDelay: 300 }}
            data={{ [MIME]: item.id }}
            onHold={() => handleHold(item.label)}
            onHoldEscape={() => handleEscape(item.label)}
            testID={`${SCROLL_ITEM_TEST_ID}-${item.id}`}
          >
            {({ isHeld, isPressed }) => (
              <View className={chipClass(isHeld, isPressed)}>
                <Text size="sm" weight="medium">
                  {item.label}
                </Text>
              </View>
            )}
          </HoldDraggable>
        ))}
      </ScrollView>
      <Note>Hold a chip to arm it, move to drag. A quick swipe on the gaps scrolls instead.</Note>
    </View>
  );
}

export const InScrollView: Story = {
  name: 'Demo: 100 draggables in a ScrollView',
  render: () => <ScrollViewDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Every draggable mounts (a plain ScrollView renders all of them; only the
    // hold upgrades a press into a drag, so short swipes still scroll).
    const items = await canvas.findAllByTestId(SCROLL_ITEM_TESTID_PATTERN);
    expect(items.length).toBe(SCROLL_ITEM_COUNT);

    // The list actually scrolls — its content is taller than its viewport.
    const scroller = await canvas.findByTestId(SCROLL_VIEW_TEST_ID);
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);

    // Hold the first chip: the hold path fires even though it lives in a scroll.
    const first = await canvas.findByTestId(`${SCROLL_ITEM_TEST_ID}-0`);
    touchPointer(first, 'pointerdown');
    await new Promise((r) => setTimeout(r, 350));
    await expect(await canvas.findByTestId(SCROLL_READOUT_TEST_ID)).toHaveTextContent('Held Item 1');
    touchPointer(first, 'pointerup');
    await new Promise((r) => setTimeout(r, 0));

    // The tail of the list starts below the viewport and comes into view on scroll.
    const last = items[SCROLL_ITEM_COUNT - 1];
    if (!last) throw new Error('last draggable not rendered');
    const viewportBottom = scroller.getBoundingClientRect().bottom;
    expect(last.getBoundingClientRect().top).toBeGreaterThanOrEqual(viewportBottom);

    scroller.scrollTop = scroller.scrollHeight;
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
    await waitFor(() => {
      expect(last.getBoundingClientRect().top).toBeLessThan(viewportBottom);
    });
  },
};
