/**
 * Stories for `Holdable` — the hold-only press primitive.
 *
 * These run under react-native-web, so the web pointer transport fires: pointer
 * events filtered to `pointerType === 'touch'`. A mouse press does nothing on
 * purpose — a held mouse already means right-click on desktop — and the plays
 * below dispatch synthetic touch pointer events to exercise the timeline.
 *
 * Set `cursorMode` to allow a mouse left-button press to run the same timeline
 * a touch press does. The "Cursor" story below exercises this path with
 * synthetic mouse pointer events.
 *
 * The four-phase timeline:
 *   `pending` → (armDelay 150ms) → `active` (isPressed) → (holdDelay 300ms) → `hold` (isHeld + onHold)
 *
 * A cancel or release ends the press quietly at any point — `onHoldEscape` is a
 * drag's crossing out of a fired hold, and a bare `<Holdable>` has nothing to
 * drag, so it never reports one.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { ControlCard, Note, Playground, Toggle } from '../../../__stories__/story-harness';
import { Text } from '../../typography/Text/text';
import { Holdable } from './holdable';

const CHIP_TEST_ID = 'story-holdable-chip';
const READOUT_TEST_ID = 'story-holdable-readout';

/** Dispatch a synthetic touch pointer event directly on a DOM node. */
function touchPointer(node: Element, type: string, pointerId = 1) {
  node.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: 'touch',
      buttons: type === 'pointerdown' ? 1 : 0,
    }),
  );
}

/** Dispatch a synthetic mouse pointer event — for exercising `cursorMode`. */
function mousePointer(node: Element, type: string, pointerId = 1) {
  node.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: type === 'pointerdown' ? 1 : 0,
      pointerId,
      pointerType: 'mouse',
    }),
  );
}

type HoldDemoProps = { cursorMode?: boolean; disabled?: boolean };

function chipClass(isHeld: boolean, isPressed: boolean) {
  if (isHeld) return 'rounded-xl border border-primary bg-primary/10 px-6 py-4';
  if (isPressed) return 'rounded-xl border border-border bg-surface-2 px-6 py-4 opacity-70';
  return 'rounded-xl border border-border bg-surface-2 px-6 py-4';
}

function chipLabel(isHeld: boolean, isPressed: boolean) {
  if (isHeld) return 'Held — release to dismiss';
  if (isPressed) return 'Armed…';
  return 'Hold me';
}

/**
 * A Holdable chip that logs each phase transition to a readout below it.
 *
 * The visual state matches the phase: unstyled in `pending`, slightly dimmed in
 * `active` (armed), and highlighted in `hold`.
 */
function HoldDemo({ cursorMode = false, disabled = false }: HoldDemoProps) {
  const [status, setStatus] = useState('Waiting');

  const handleActive = useCallback(() => setStatus('Armed'), []);
  const handleHold = useCallback(() => setStatus('Held'), []);
  const handleEscape = useCallback(() => setStatus('Escaped'), []);

  return (
    <View className="items-start gap-3">
      <Holdable
        cursorMode={cursorMode}
        disabled={disabled}
        onActive={handleActive}
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
      </Holdable>
      <Note testID={READOUT_TEST_ID}>{status}</Note>
      <Note>Touch-hold: armed at 150ms, fires at 300ms.</Note>
    </View>
  );
}

function HoldPlayground() {
  const [cursorMode, setCursorMode] = useState(false);
  const [disabled, setDisabled] = useState(false);

  return (
    <Playground>
      <ControlCard title="Options">
        <Toggle label="Cursor mode" onChange={setCursorMode} value={cursorMode} />
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
      </ControlCard>
      <HoldDemo cursorMode={cursorMode} disabled={disabled} />
    </Playground>
  );
}

const meta = {
  title: 'Gestures/Holdable',
  component: Holdable,
  parameters: { layout: 'centered' },
  // children is supplied per story; the stub satisfies the type checker.
  args: { children: null },
} satisfies Meta<typeof Holdable>;

type Story = StoryObj<typeof meta>;

export default meta;

/** Every knob: the phase callbacks and the `disabled` toggle. */
export const Interactive: Story = { render: () => <HoldPlayground /> };

/**
 * A hold that runs to completion. The synthetic touch pointer stays down past
 * `holdDelay` and `onHold` fires; the render-prop child shows the visual
 * transition from armed to held.
 */
export const Default: Story = {
  name: 'Demo: Hold fires onHold at 300ms',
  render: () => <HoldDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByTestId(CHIP_TEST_ID);

    touchPointer(chip, 'pointerdown');
    // Hold past holdDelay (300ms) — the timeline fires onHold at 300ms.
    await new Promise((r) => setTimeout(r, 350));

    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Held');

    touchPointer(chip, 'pointerup');
    await new Promise((r) => setTimeout(r, 0));
  },
};

/**
 * A hold cancelled after `armDelay` but before `holdDelay`.
 *
 * The pointer goes down and the arm fires at 150ms (`isPressed` flips true).
 * Then `pointercancel` arrives — a scroll taking the press — and the timeline
 * simply ends: both timers are cleared, so no hold fires late, and
 * `onHoldEscape` stays silent. The escape is a drag's crossing out of a hold
 * that already fired; a bare `<Holdable>` has nothing to drag, so it never
 * reports one — see `UseHoldableOptions.onHoldEscape`.
 */
export const Escape: Story = {
  name: 'Behaviour: Cancel after arm ends the press quietly',
  render: () => <HoldDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByTestId(CHIP_TEST_ID);

    touchPointer(chip, 'pointerdown');
    // Past armDelay (150ms) but before holdDelay (300ms). findByText retries,
    // so a busy frame cannot race the arm timer.
    await canvas.findByText('Armed…');
    touchPointer(chip, 'pointercancel');
    // Wait past where the hold would have fired: the cancel cleared the timer,
    // so nothing arrives late.
    await new Promise((r) => setTimeout(r, 250));

    // The readout still shows the last event that fired — the arm. No 'Held',
    // no 'Escaped'; the chip itself is back at rest.
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Armed');
    await expect(await canvas.findByText('Hold me')).toBeVisible();
  },
};

/**
 * With `cursorMode`, a mouse left-button press runs the same hold timeline a
 * touch press does. The synthetic mouse pointer events stay down past
 * `holdDelay` (300ms) and `onHold` fires; the chip shows the held visual state.
 * Right-click is still the browser's own context menu.
 */
export const Cursor: Story = {
  name: 'Demo: cursorMode enables mouse-hold on web',
  render: () => <HoldDemo cursorMode={true} />,
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
 * `disabled` removes the pointer transport entirely: no listener fires and no
 * phase transition is reported, regardless of how long the pointer is held down.
 */
export const Disabled: Story = {
  name: 'Behaviour: Disabled — hold fires nothing',
  render: () => <HoldDemo disabled={true} />,
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
