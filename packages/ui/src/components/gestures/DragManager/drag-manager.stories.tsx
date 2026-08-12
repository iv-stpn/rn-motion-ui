/**
 * Stories for `DragManager` — the optional coordinator over a subtree of drags.
 *
 * Optional is the word that shapes these stories. A `<Draggable>`/`<Dragzone>` pair
 * already works with no manager anywhere in the tree, so each story here is one of the
 * things that need a *place in the tree* to mean anything: a default group for
 * everything beneath, a boundary drags cannot cross, one vantage point on every drag
 * in a subtree, and a handle that reaches the drag in flight from outside it.
 *
 * The chips and zones below declare no `groups` of their own. That is deliberate —
 * everything they refuse here, they refuse because of a manager above them.
 *
 * They run under react-native-web, so the drags are real HTML5 drags dispatched by
 * hand; see `story-drag.ts`. Inheritance and isolation are settled in the store off
 * measured boxes, so a native pan reaches the same verdicts through the same code.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { expect, userEvent, within } from 'storybook/test';
import { centerOf, dragOnto, fireDrag, liftDrag, newDragTransfer } from '../../../__stories__/story-drag';
import { Action, ControlCard, Note, Playground, Toggle } from '../../../__stories__/story-harness';
import { Text } from '../../typography/Text/text';
import { Draggable } from '../Draggable/draggable';
import { Dragzone } from '../Dragzone/dragzone';
import type { DragEndEvent, DragGroups, DragManagerHandle, DragzoneDropEvent, DragzoneRenderState } from '../drag.types';
import { DragManager } from './drag-manager';

const MIME = 'application/x-story-card';

const CHIP_TEST_ID = 'story-manager-chip';
const ZONE_TEST_ID = 'story-manager-zone';
const READOUT_TEST_ID = 'story-manager-readout';
const LIFECYCLE_TEST_ID = 'story-manager-lifecycle';
const HANDLE_TEST_ID = 'story-manager-handle';

// Hoisted so a `groups` prop keeps one identity across renders: a fresh array every
// render would churn the registration for nothing.
const LEFT_GROUP: DragGroups = ['left'];
const RIGHT_GROUP: DragGroups = ['right'];

const HINT = 'Each board takes its own card. Turn on either knob to stop a card crossing to the other one.';

/** Dropped, and the moves counted — at least one, and never a render per move. */
const DROPPED_AFTER_MOVES = /^end canceled=false moves=[1-9]/;

type ChipProps = { label: string; onDragEnd?: (event: DragEndEvent) => void };

/**
 * A source that declares no groups of its own, on purpose.
 *
 * Which is the point of the stories below: what it may reach comes from the manager
 * above it, so the same component is a left-board card or a right-board card
 * depending only on where it is mounted.
 */
function Chip({ label, onDragEnd }: ChipProps) {
  return (
    <Draggable
      accessibilityLabel={label}
      accessibilityRole="button"
      data={{ [MIME]: label }}
      onDragEnd={onDragEnd}
      testID={`${CHIP_TEST_ID}-${label}`}
    >
      <View className="rounded-md border border-border bg-surface-2 px-3 py-1.5">
        <Text size="sm">{label}</Text>
      </View>
    </Draggable>
  );
}

/** The zone's standing, as one word a play function can assert on. */
function stateLabel(state: DragzoneRenderState): 'over' | 'eligible' | 'idle' {
  if (state.isOver) return 'over';
  if (state.isEligible) return 'eligible';
  return 'idle';
}

type SlotProps = { label: string };

/** A zone that declares no groups either — same reason as {@link Chip}. */
function Slot({ label }: SlotProps) {
  return (
    <Dragzone
      className="min-w-[130px] rounded-lg border border-border border-dashed p-3"
      eligibleClassName="border-info"
      overClassName="border-info bg-info/10"
      testID={`${ZONE_TEST_ID}-${label}`}
    >
      {(state) => (
        <View className="gap-1">
          <Text size="sm" weight="medium">
            {label}
          </Text>
          <Text className="text-muted-foreground" size="xs" testID={`${ZONE_TEST_ID}-${label}-state`}>
            {stateLabel(state)}
          </Text>
        </View>
      )}
    </Dragzone>
  );
}

type BoardProps = {
  groups: DragGroups;
  isolate: boolean;
  label: string;
  onDragEnd?: (event: DragEndEvent) => void;
  onDrop: (board: string, event: DragzoneDropEvent) => void;
};

/**
 * A card, a slot, and a manager over both — the whole unit of these stories.
 *
 * Nothing inside declares a group or knows about the other board. The manager is the
 * only place that says what this subtree is, which is what makes two of them side by
 * side either one system or two depending on a single prop.
 */
function Board({ groups, isolate, label, onDragEnd, onDrop }: BoardProps) {
  return (
    <DragManager
      className="gap-2 rounded-xl border border-border p-3"
      groups={groups}
      isolate={isolate}
      onDrop={(event) => onDrop(label, event)}
    >
      <Text className="text-muted-foreground" size="xs" weight="medium">
        {label}
      </Text>
      <Chip label={`${label}-card`} onDragEnd={onDragEnd} />
      <Slot label={`${label}-slot`} />
    </DragManager>
  );
}

type TwoBoardsProps = { isolate?: boolean; split?: boolean };

/**
 * Two boards, and the two independent ways to keep a card from crossing between them.
 *
 * `split` gives them different groups: advisory, readable, and the thing you reach for
 * first. `isolate` makes the boundary structural instead — the cards may share a group
 * with the whole app and still not leave. Both are on the manager, neither is on a
 * card or a slot, and either one alone is enough.
 */
function TwoBoards({ isolate = false, split = false }: TwoBoardsProps) {
  const [status, setStatus] = useState('Nothing yet');

  // The manager is told which board it is, rather than reading it off the event:
  // `zoneId` is the store's own handle, a `useId` value and no kind of name.
  const took = useCallback((board: string, { transfer }: DragzoneDropEvent) => {
    setStatus(`${board} observed ${transfer.getData(MIME)}`);
  }, []);

  return (
    <View className="w-[520px] max-w-full gap-3">
      <View className="flex-row flex-wrap gap-3">
        <Board groups={LEFT_GROUP} isolate={isolate} label="Left" onDrop={took} />
        <Board groups={split ? RIGHT_GROUP : LEFT_GROUP} isolate={isolate} label="Right" onDrop={took} />
      </View>
      <Note testID={READOUT_TEST_ID}>{status}</Note>
      <Note>{HINT}</Note>
    </View>
  );
}

/** The two boards plus the two knobs that separate them. */
function BoardsPlayground() {
  const [isolate, setIsolate] = useState(false);
  const [split, setSplit] = useState(false);

  return (
    <Playground>
      <ControlCard title="Boundaries">
        <Toggle label="Isolate each board" onChange={setIsolate} value={isolate} />
        <Toggle label="Different groups" onChange={setSplit} value={split} />
      </ControlCard>
      <TwoBoards isolate={isolate} split={split} />
    </Playground>
  );
}

/**
 * One manager watching a drag that is lifted under a nested one.
 *
 * Both see it. A manager's callbacks cover its whole subtree rather than just the
 * children it can point at, so the outer one is a single place to log, persist, or
 * undo every move on a screen — without every board inside it wiring itself up.
 */
function LifecycleDemo() {
  const [log, setLog] = useState('idle');
  // Counted on a ref: moves arrive at pointer rate, and a render each would be the
  // one thing the move channel exists to prevent.
  const moves = useRef(0);

  return (
    <DragManager
      className="w-[420px] max-w-full gap-3"
      onDragEnd={({ canceled }) => setLog(`end canceled=${canceled} moves=${moves.current}`)}
      onDragMove={() => {
        moves.current += 1;
      }}
      onDragStart={() => {
        moves.current = 0;
        setLog('start');
      }}
    >
      <DragManager className="flex-row gap-3 rounded-xl border border-border p-3">
        <Chip label="nested-card" />
        <Slot label="nested-slot" />
      </DragManager>
      <Note testID={LIFECYCLE_TEST_ID}>{log}</Note>
    </DragManager>
  );
}

/**
 * The ref: `cancelDrag` and `getActiveDrag`, from a manager rather than a source.
 *
 * The difference is reach. A `<Draggable>`'s handle can only speak for itself, while
 * a manager's speaks for whatever is in flight beneath it — so this is how a screen
 * abandons a drag on a route change or a lost connection, without holding a ref to
 * every card that might be the one moving.
 */
function HandleDemo() {
  const ref = useRef<DragManagerHandle>(null);
  const [readout, setReadout] = useState('not asked yet');
  const [ended, setEnded] = useState('nothing yet');

  const inspect = useCallback(async () => {
    // `refreshZones` first, because the honest answer to "what is in flight" is the one
    // measured against where the zones are now — a list that recycled its rows since
    // the lift has moved its boxes without a layout pass to say so.
    await ref.current?.refreshZones();
    const drag = ref.current?.getActiveDrag() ?? null;
    setReadout(`active=${drag !== null}`);
  }, []);

  return (
    <DragManager className="w-[420px] max-w-full gap-3" ref={ref}>
      <Chip label="held-card" onDragEnd={({ canceled }) => setEnded(`canceled=${canceled}`)} />
      <View className="flex-row gap-2">
        <Action label="Inspect" onPress={inspect} />
        <Action label="Cancel drag" onPress={() => ref.current?.cancelDrag()} />
      </View>
      <Note testID={HANDLE_TEST_ID}>{readout}</Note>
      <Note testID={READOUT_TEST_ID}>{ended}</Note>
    </DragManager>
  );
}

const meta = {
  title: 'Gestures/DragManager',
  component: DragManager,
  parameters: { layout: 'centered' },
  // children is supplied per story; the stub satisfies the type checker.
  args: { children: null },
} satisfies Meta<typeof DragManager>;

type Story = StoryObj<typeof meta>;

export default meta;

/** The state line a `Slot` renders — the zone's own verdict, queried by name. */
const stateOf = (canvas: ReturnType<typeof within>, label: string) => canvas.findByTestId(`${ZONE_TEST_ID}-${label}-state`);

/** Both knobs, and the manager-level callbacks reporting what each one changes. */
export const Interactive: Story = { render: () => <BoardsPlayground /> };

/**
 * Neither the card nor the slot names a group. The manager above them does, so the
 * boards are two systems by inheritance alone — and the refusal is visible at the
 * lift, before the pointer has gone anywhere.
 */
export const InheritedGroups: Story = {
  name: "Behaviour: Children inherit the manager's groups",
  render: () => <TwoBoards split={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = await canvas.findByTestId(`${CHIP_TEST_ID}-Left-card`);
    const foreign = await canvas.findByTestId(`${ZONE_TEST_ID}-Right-slot`);

    const transfer = newDragTransfer();
    await liftDrag(card, transfer);

    // Eligibility is published tree-wide at the lift, so the other board is already out.
    await expect(await stateOf(canvas, 'Left-slot')).toHaveTextContent('eligible');
    await expect(await stateOf(canvas, 'Right-slot')).toHaveTextContent('idle');

    fireDrag(card, 'drag', transfer, centerOf(foreign));
    fireDrag(foreign, 'dragover', transfer, centerOf(foreign));
    await expect(await stateOf(canvas, 'Right-slot')).toHaveTextContent('idle');

    fireDrag(card, 'dragend', transfer, centerOf(foreign));
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Nothing yet');

    // Its own board takes it, and its own manager is the one that hears about it.
    const home = await canvas.findByTestId(`${ZONE_TEST_ID}-Left-slot`);
    const second = newDragTransfer();
    await dragOnto({ source: card, target: home, to: centerOf(home), transfer: second });
    fireDrag(card, 'dragend', second, centerOf(home));
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Left observed Left-card');
  },
};

/**
 * The same two boards sharing one group, kept apart structurally instead.
 *
 * `isolate` is the answer when the labels cannot be trusted to stay right across a
 * large tree: the card and the far slot agree on their group and still cannot meet,
 * because the deepest isolating manager they share is not the same one.
 */
export const Isolation: Story = {
  name: 'Behaviour: An isolating manager is a boundary',
  render: () => <TwoBoards isolate={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = await canvas.findByTestId(`${CHIP_TEST_ID}-Left-card`);
    const foreign = await canvas.findByTestId(`${ZONE_TEST_ID}-Right-slot`);
    const home = await canvas.findByTestId(`${ZONE_TEST_ID}-Left-slot`);

    const transfer = newDragTransfer();
    await dragOnto({ source: card, target: foreign, to: centerOf(foreign), transfer });
    await expect(await stateOf(canvas, 'Right-slot')).toHaveTextContent('idle');

    fireDrag(card, 'dragend', transfer, centerOf(foreign));
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Nothing yet');

    // Inside the boundary the same group matches as usual — isolation scopes, not blocks.
    const second = newDragTransfer();
    await dragOnto({ source: card, target: home, to: centerOf(home), transfer: second });
    fireDrag(card, 'dragend', second, centerOf(home));
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Left observed Left-card');
  },
};

/**
 * A drag lifted under a nested manager, watched from the outer one — start, moves and
 * end all arrive, because a manager's callbacks cover its subtree rather than its
 * immediate children.
 */
export const Lifecycle: Story = {
  name: 'API: Watching every drag in a subtree',
  render: () => <LifecycleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = await canvas.findByTestId(`${CHIP_TEST_ID}-nested-card`);
    const slot = await canvas.findByTestId(`${ZONE_TEST_ID}-nested-slot`);

    const transfer = newDragTransfer();
    await liftDrag(card, transfer);
    await expect(await canvas.findByTestId(LIFECYCLE_TEST_ID)).toHaveTextContent('start');

    fireDrag(card, 'drag', transfer, centerOf(slot));
    fireDrag(slot, 'dragover', transfer, centerOf(slot));
    fireDrag(card, 'dragend', transfer, centerOf(slot));

    // Dropped rather than canceled, and the moves were counted without a render each.
    await expect(await canvas.findByTestId(LIFECYCLE_TEST_ID)).toHaveTextContent(DROPPED_AFTER_MOVES);
  },
};

/**
 * `getActiveDrag` and `cancelDrag` off a manager's ref: the drag in flight anywhere
 * beneath it, and the way to abandon it without holding a ref to whichever card is
 * moving. What a screen needs on a route change or a lost connection.
 */
export const ImperativeHandle: Story = {
  name: 'API: Reading and canceling from the manager',
  render: () => <HandleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = await canvas.findByTestId(`${CHIP_TEST_ID}-held-card`);
    const inspect = await canvas.findByTestId('story-action-inspect');

    await userEvent.click(inspect);
    await expect(await canvas.findByTestId(HANDLE_TEST_ID)).toHaveTextContent('active=false');

    await liftDrag(card, newDragTransfer());
    await userEvent.click(inspect);
    await expect(await canvas.findByTestId(HANDLE_TEST_ID)).toHaveTextContent('active=true');

    // The manager abandons a drag it never lifted, and the source is told it was canceled.
    await userEvent.click(await canvas.findByTestId('story-action-cancel-drag'));
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('canceled=true');

    await userEvent.click(inspect);
    await expect(await canvas.findByTestId(HANDLE_TEST_ID)).toHaveTextContent('active=false');
  },
};
