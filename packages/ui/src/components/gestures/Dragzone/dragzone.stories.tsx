/**
 * Stories for `Dragzone` — the receiving half of the gesture system.
 *
 * What a zone does is decide, so these stories are mostly about refusals: a zone
 * that shares no group, one whose `accepts` says no, one that is disabled, and two
 * that overlap and have to agree on which of them wins. Each of those is a branch of
 * one predicate (`drag-hit-test.ts`), asserted here through what the zone renders.
 *
 * They run under react-native-web, so the drags are real HTML5 drags dispatched by
 * hand — see `story-drag.ts`. The decision itself is platform-independent: the store
 * hit-tests measured boxes on both platforms, so a native pan resolves through the
 * same code these stories exercise.
 */
/** biome-ignore-all lint/style/useExportsLast: this a stories file */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: stories only */
/** biome-ignore-all lint/style/noJsxLiterals: stories only */
/** biome-ignore-all lint/performance/noJsxPropsBind: stories only */

import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { centerOf, dragOnto, fireDrag, liftDrag, newDragTransfer, newFileTransfer } from '../../../__stories__/story-drag';
import { ControlCard, Note, Playground, Toggle } from '../../../__stories__/story-harness';
import { cn } from '../../../lib/cn';
import { Text } from '../../typography/Text/text';
import { Draggable } from '../Draggable/draggable';
import type { DragGroups, DragzoneAcceptEvent, DragzoneDropEvent, DragzoneRenderState } from '../drag.types';
import { Dragzone } from './dragzone';

/** Two payload kinds, so a zone has something to refuse. */
const CARD_MIME = 'application/x-story-card';
const FILE_MIME = 'application/x-story-file';

const CHIP_TEST_ID = 'story-dragzone-chip';
const ZONE_TEST_ID = 'story-dragzone-zone';
const READOUT_TEST_ID = 'story-dragzone-readout';

// Hoisted so the arrays keep one identity across renders — a `groups` prop rebuilt
// every render would churn the registration for no reason.
const CARD_GROUP: DragGroups = ['cards'];
const FILE_GROUP: DragGroups = ['files'];

const CARDS = ['paid-482', 'draft-19'];
const FILES = ['report.pdf'];

const HINT = 'Card chips only fit the Cards zone, files only the Files zone. Hold a chip on a touch device.';

type ChipProps = { groups?: DragGroups; label: string; mime: string };

/** A source, labelled by what it carries and which zones will have it. */
function Chip({ groups, label, mime }: ChipProps) {
  return (
    <Draggable
      accessibilityLabel={label}
      accessibilityRole="button"
      data={{ [mime]: label }}
      groups={groups}
      testID={`${CHIP_TEST_ID}-${label}`}
    >
      <View className="rounded-md border border-border bg-surface-2 px-3 py-1.5">
        <Text size="sm">{label}</Text>
      </View>
    </Draggable>
  );
}

/** The zone's standing, as one word a play function can assert on. */
function stateLabel(state: DragzoneRenderState): 'external' | 'over' | 'eligible' | 'idle' {
  if (state.external) return 'external';
  if (state.isOver) return 'over';
  if (state.isEligible) return 'eligible';
  return 'idle';
}

type DropBoxProps = {
  accepts?: (event: DragzoneAcceptEvent) => boolean;
  acceptsExternal?: boolean;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  groups?: DragGroups;
  label: string;
  /**
   * Told which box it was. `DragzoneDropEvent.zoneId` is the store's own handle — a
   * `useId` value, opaque by design — so a consumer that needs to know *which* of its
   * zones took a drop passes that down itself, exactly as this does.
   */
  onDrop?: (label: string, event: DragzoneDropEvent) => void;
  priority?: number;
};

/**
 * A labelled zone that says out loud where it stands.
 *
 * The state line is the render-prop form doing the one thing a class name cannot:
 * putting the zone's own verdict somewhere both a reader and a play function can see
 * it. `eligibleClassName` and `overClassName` handle the visual half, which is why
 * neither appears in the function body.
 */
function DropBox({ children, className, label, onDrop, ...props }: DropBoxProps) {
  return (
    <Dragzone
      className={cn('min-w-[150px] rounded-lg border border-border border-dashed p-3', className)}
      eligibleClassName="border-info"
      onDrop={(event) => onDrop?.(label, event)}
      overClassName="border-info bg-info/10"
      testID={`${ZONE_TEST_ID}-${label}`}
      {...props}
    >
      {(state) => (
        <View className="gap-1">
          <Text size="sm" weight="medium">
            {label}
          </Text>
          <Text className="text-muted-foreground" size="xs" testID={`${ZONE_TEST_ID}-${label}-state`}>
            {stateLabel(state)}
          </Text>
          {children}
        </View>
      )}
    </Dragzone>
  );
}

type BoardProps = { cardsDisabled?: boolean; onlyPaid?: boolean };

/**
 * Two kinds of chip, two zones, and no wiring between them.
 *
 * The groups are the whole mechanism: a card chip is refused by the files zone
 * before any callback of its own runs, and the refusal is visible — the zone never
 * lights up, because eligibility and acceptance are one predicate rather than a
 * highlight that hopes to agree with a drop handler.
 */
function Board({ cardsDisabled = false, onlyPaid = false }: BoardProps) {
  const [status, setStatus] = useState('Nothing yet');

  // The zone names itself rather than being identified from the event: `zoneId` is the
  // store's own handle (a `useId`), opaque by design and not a name to match on.
  const took = useCallback((zone: string, { transfer }: DragzoneDropEvent) => {
    setStatus(`${zone} took ${transfer.getData(CARD_MIME) || transfer.getData(FILE_MIME)}`);
  }, []);

  // Called on every move while over the zone, so it stays a pure read of the payload.
  const acceptsPaid = useCallback(({ transfer }: DragzoneAcceptEvent) => transfer.getData(CARD_MIME).startsWith('paid'), []);

  return (
    <View className="w-[460px] max-w-full gap-3">
      <View className="flex-row flex-wrap gap-2">
        {CARDS.map((label) => (
          <Chip groups={CARD_GROUP} key={label} label={label} mime={CARD_MIME} />
        ))}
        {FILES.map((label) => (
          <Chip groups={FILE_GROUP} key={label} label={label} mime={FILE_MIME} />
        ))}
      </View>
      <View className="flex-row gap-3">
        <DropBox
          accepts={onlyPaid ? acceptsPaid : undefined}
          disabled={cardsDisabled}
          groups={CARD_GROUP}
          label="Cards"
          onDrop={took}
        />
        <DropBox groups={FILE_GROUP} label="Files" onDrop={took} />
      </View>
      <Note testID={READOUT_TEST_ID}>{status}</Note>
      <Note>{HINT}</Note>
    </View>
  );
}

/** The board plus the two knobs that change what a zone will take. */
function BoardPlayground() {
  const [cardsDisabled, setCardsDisabled] = useState(false);
  const [onlyPaid, setOnlyPaid] = useState(false);

  return (
    <Playground>
      <ControlCard title="Cards zone">
        <Toggle label="Disabled" onChange={setCardsDisabled} value={cardsDisabled} />
        <Toggle label="Accepts only paid-*" onChange={setOnlyPaid} value={onlyPaid} />
      </ControlCard>
      <Board cardsDisabled={cardsDisabled} onlyPaid={onlyPaid} />
    </Playground>
  );
}

/**
 * A zone inside a zone, with nothing declared to order them.
 *
 * Both are under the pointer at the release, and the inner one wins on area — the
 * smaller box is the more specific by construction. That is what makes a trash can
 * inside a board work without either side knowing about the other; `priority` is
 * there for the cases where the geometry does not say what you mean.
 */
function NestedDemo() {
  const [status, setStatus] = useState('Nothing yet');
  // Which box took it comes from the box, not from the event — see `DropBoxProps.onDrop`.
  const took = useCallback((zone: string) => setStatus(`Took it: ${zone.toLowerCase()}`), []);

  return (
    <View className="w-[460px] max-w-full gap-3">
      <Chip groups={CARD_GROUP} label="paid-482" mime={CARD_MIME} />
      <DropBox className="p-4" label="Outer" onDrop={took}>
        <DropBox label="Inner" onDrop={took} />
      </DropBox>
      <Note testID={READOUT_TEST_ID}>{status}</Note>
    </View>
  );
}

/**
 * A payload from outside the app: an OS file drag, another tab, another window.
 *
 * Web-only, and off unless asked for — a zone that has not requested files should
 * not swallow the page's own drop handling. There is no in-library drag to describe,
 * so `drag` is `null` and `external` is `true`, and the files arrive on the event.
 */
function ExternalDemo() {
  const [status, setStatus] = useState('Nothing yet');
  const took = useCallback((_zone: string, { external, files }: DragzoneDropEvent) => {
    setStatus(`external=${external} files=${files.map((file) => file.name).join(', ') || 'none'}`);
  }, []);

  return (
    <View className="w-[460px] max-w-full gap-3">
      <DropBox acceptsExternal={true} label="Uploads" onDrop={took} />
      <DropBox label="No external" onDrop={took} />
      <Note testID={READOUT_TEST_ID}>{status}</Note>
    </View>
  );
}

const meta = {
  title: 'Gestures/Dragzone',
  component: Dragzone,
  parameters: { layout: 'centered' },
  // children is supplied per story; the stub satisfies the type checker.
  args: { children: null },
} satisfies Meta<typeof Dragzone>;

type Story = StoryObj<typeof meta>;

export default meta;

/** The state line a `DropBox` renders — the zone's own verdict, queried by name. */
const stateOf = (canvas: ReturnType<typeof within>, label: string) => canvas.findByTestId(`${ZONE_TEST_ID}-${label}-state`);

/** Every knob: groups, `disabled`, `accepts`, and the two class-name hooks. */
export const Interactive: Story = { render: () => <BoardPlayground /> };

/**
 * Groups decide who may interact, and the decision is visible before the pointer
 * moves: lifting a card lights the Cards zone and leaves Files idle, tree-wide.
 *
 * That is one predicate rather than two. A zone cannot highlight and then refuse the
 * drop, because the same `isZoneEligible` answers both — asked without the box test
 * for the affordance, and with it for the release.
 */
export const Groups: Story = {
  name: 'Behaviour: Only matching groups light up',
  render: () => <Board />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByTestId(`${CHIP_TEST_ID}-paid-482`);
    const cards = await canvas.findByTestId(`${ZONE_TEST_ID}-Cards`);
    const files = await canvas.findByTestId(`${ZONE_TEST_ID}-Files`);

    const transfer = newDragTransfer();
    await liftDrag(chip, transfer);

    await expect(await stateOf(canvas, 'Cards')).toHaveTextContent('eligible');
    await expect(await stateOf(canvas, 'Files')).toHaveTextContent('idle');

    // Over the zone that shares its group, the state sharpens rather than changing kind.
    fireDrag(chip, 'drag', transfer, centerOf(cards));
    fireDrag(cards, 'dragover', transfer, centerOf(cards));
    await expect(await stateOf(canvas, 'Cards')).toHaveTextContent('over');

    // And the mismatched zone stays idle even with the pointer inside it.
    fireDrag(chip, 'drag', transfer, centerOf(files));
    await expect(await stateOf(canvas, 'Files')).toHaveTextContent('idle');

    fireDrag(chip, 'dragend', transfer, centerOf(cards));
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Cards took paid-482');
  },
};

/**
 * `accepts` is the last word, asked after groups have matched — the place for a rule
 * only the payload knows. Here the Cards zone takes `paid-*` and nothing else, so a
 * draft never lights it up and a release on it is a cancel.
 */
export const Accepts: Story = {
  name: 'Behaviour: A predicate with the last word',
  render: () => <Board onlyPaid={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const draft = await canvas.findByTestId(`${CHIP_TEST_ID}-draft-19`);
    const cards = await canvas.findByTestId(`${ZONE_TEST_ID}-Cards`);

    const transfer = newDragTransfer();
    await dragOnto({ source: draft, target: cards, to: centerOf(cards), transfer });
    await expect(await stateOf(canvas, 'Cards')).toHaveTextContent('idle');

    fireDrag(draft, 'dragend', transfer, centerOf(cards));
    // Refused, so nothing was taken — the read-out never moves off its initial line.
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Nothing yet');

    // The same zone, the same drag path, a payload its rule allows.
    const paid = await canvas.findByTestId(`${CHIP_TEST_ID}-paid-482`);
    const second = newDragTransfer();
    await dragOnto({ source: paid, target: cards, to: centerOf(cards), transfer: second });
    fireDrag(paid, 'dragend', second, centerOf(cards));
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Cards took paid-482');
  },
};

/**
 * `disabled` removes the zone from the decision rather than swallowing its callbacks:
 * it never becomes eligible, so it never lights up, and a release on it is a cancel.
 */
export const Disabled: Story = {
  name: 'Behaviour: A disabled zone takes nothing',
  render: () => <Board cardsDisabled={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByTestId(`${CHIP_TEST_ID}-paid-482`);
    const cards = await canvas.findByTestId(`${ZONE_TEST_ID}-Cards`);

    const transfer = newDragTransfer();
    await dragOnto({ source: chip, target: cards, to: centerOf(cards), transfer });
    await expect(await stateOf(canvas, 'Cards')).toHaveTextContent('idle');

    fireDrag(chip, 'dragend', transfer, centerOf(cards));
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Nothing yet');
  },
};

/**
 * Two zones under the pointer, neither declaring anything about the other. The inner
 * one takes the drop on area — the smaller box is the more specific by construction —
 * which is what makes a trash can inside a board work with no configuration at all.
 */
export const Nested: Story = {
  name: 'Behaviour: The inner of two overlapping zones wins',
  render: () => <NestedDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByTestId(`${CHIP_TEST_ID}-paid-482`);
    const inner = await canvas.findByTestId(`${ZONE_TEST_ID}-Inner`);

    const transfer = newDragTransfer();
    await dragOnto({ source: chip, target: inner, to: centerOf(inner), transfer });
    fireDrag(chip, 'dragend', transfer, centerOf(inner));

    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Took it: inner');
  },
};

/**
 * A payload the library never saw start: files from the OS, dispatched here the way a
 * browser dispatches a real file drag.
 *
 * `acceptsExternal` is what separates the two zones, and it is off by default on
 * purpose — a zone that has not asked for files should not swallow the page's own drop
 * handling. The event that lands carries `drag: null` and `external: true`, because
 * there is no in-library source to name.
 */
export const External: Story = {
  name: 'Behaviour: A file dropped from outside the app',
  render: () => <ExternalDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const uploads = await canvas.findByTestId(`${ZONE_TEST_ID}-Uploads`);
    const refuses = await canvas.findByTestId(`${ZONE_TEST_ID}-No external`);

    const transfer = newFileTransfer(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    const at = centerOf(uploads);
    fireDrag(uploads, 'dragenter', transfer, at);
    fireDrag(uploads, 'dragover', transfer, at);

    // No session exists, so the zone's own listener is the only witness that a foreign
    // drag is here — which is why this state is local to the zone and not in the store.
    await expect(await stateOf(canvas, 'Uploads')).toHaveTextContent('external');

    fireDrag(uploads, 'drop', transfer, at);
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('external=true files=notes.txt');

    // The zone that did not ask for files ignores the same sequence entirely.
    const elsewhere = centerOf(refuses);
    fireDrag(refuses, 'dragenter', transfer, elsewhere);
    fireDrag(refuses, 'dragover', transfer, elsewhere);
    await expect(await stateOf(canvas, 'No external')).toHaveTextContent('idle');
  },
};
