/**
 * Stories for `MultiDragManager` — a manager whose drags carry a selection.
 *
 * The gap it fills is visible in one question: drag one of three selected rows, and
 * what moves? A plain `<Draggable>` knows only what it holds, so the answer is one
 * row and the other two stay put. These stories are that difference, asserted from
 * both sides — a selected row carries the whole selection, an unselected one carries
 * only itself and leaves the selection alone.
 *
 * They run under react-native-web, so the drags are real HTML5 drags dispatched by
 * hand; see `story-drag.ts`. The group travels as a MIME entry on the transfer, which
 * is what lets the assertions read it back the way any drop target would.
 */
/** biome-ignore-all lint/style/useExportsLast: this a stories file */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: stories only */
/** biome-ignore-all lint/style/noJsxLiterals: stories only */
/** biome-ignore-all lint/performance/noJsxPropsBind: stories only */

import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { expect, userEvent, within } from 'storybook/test';
import { centerOf, dragOnto, fireDrag, newDragTransfer } from '../../../__stories__/story-drag';
import { Note } from '../../../__stories__/story-harness';
import { cn } from '../../../lib/cn';
import { Text } from '../../typography/Text/text';
import { Dragzone } from '../Dragzone/dragzone';
import type { DragzoneDropEvent } from '../drag.types';
import { MULTI_DRAG_IDS_MIME, readMultiDragIds } from './multi-drag';
import { MultiDragManager } from './multi-drag-manager';
import { useIsLifting } from './multi-drag-scope';
import { MultiDraggable } from './multi-draggable';

/** The story's own payload, alongside the ids the manager always writes. */
const MIME = 'application/x-story-rows';

const ROW_TEST_ID = 'story-multi-row';
const ZONE_TEST_ID = 'story-multi-zone';
const READOUT_TEST_ID = 'story-multi-readout';
const PAYLOAD_TEST_ID = 'story-multi-payload';

const ROWS = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

const HINT = 'Click rows to select them, then drag any selected row — the whole selection travels.';

/** A row's standing, as one word a play function can assert on. */
function rowState(isLifting: boolean, isSelected: boolean): 'lifting' | 'selected' | 'idle' {
  if (isLifting) return 'lifting';
  return isSelected ? 'selected' : 'idle';
}

type RowProps = { id: string; isSelected: boolean; onPress: (id: string) => void };

/**
 * One row: a `<MultiDraggable>` around a `<Pressable>`, and `useIsLifting` for the
 * state neither of them owns.
 *
 * That hook is the reason a row needs nothing else. It answers "am I in flight"
 * for every member of the group, not just the one under the pointer — so the two
 * rows nobody grabbed still fade, which is the feedback that says the selection is
 * what is moving.
 */
function Row({ id, isSelected, onPress }: RowProps) {
  const isLifting = useIsLifting(id);

  return (
    <MultiDraggable id={id} testID={`${ROW_TEST_ID}-${id}`}>
      <Pressable onPress={() => onPress(id)} testID={`${ROW_TEST_ID}-${id}-press`}>
        <View
          className={cn(
            'flex-row items-center justify-between rounded-md border border-border px-3 py-2',
            isSelected && 'border-info bg-info/10',
            isLifting && 'opacity-40',
          )}
        >
          <Text size="sm">{id}</Text>
          <Text className="text-muted-foreground" size="xs" testID={`${ROW_TEST_ID}-${id}-state`}>
            {rowState(isLifting, isSelected)}
          </Text>
        </View>
      </Pressable>
    </MultiDraggable>
  );
}

type GroupChipProps = { count: number };

/** The group's ghost: one chip naming the count, since a group has no single name. */
function GroupChip({ count }: GroupChipProps) {
  return (
    <View className="self-start rounded-md border border-border bg-surface-4 px-2 py-1">
      <Text size="xs">{count} items</Text>
    </View>
  );
}

/**
 * A selectable list under one manager, and a zone that reads the group back.
 *
 * The manager holds three things the rows cannot: the selection, the payload built
 * from it, and the ghost that describes it. Every row is the same component
 * regardless of how many are selected.
 */
function RowsDemo() {
  const [selected, setSelected] = useState<string[]>(['Alpha', 'Bravo']);
  const [dropped, setDropped] = useState('Nothing yet');
  const [payload, setPayload] = useState('No payload yet');

  const toggle = useCallback((id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((member) => member !== id) : [...current, id]));
  }, []);

  // Built once per lift from the resolved group, so a payload may cost as much as
  // the group needs — this is not on the pointer path.
  const getGroupData = useCallback((ids: readonly string[]) => ({ [MIME]: ids.join(' + ') }), []);
  const renderPreview = useCallback((ids: readonly string[]) => <GroupChip count={ids.length} />, []);

  const took = useCallback(({ transfer }: DragzoneDropEvent) => {
    // Two reads of the same drop: the ids the manager always writes, and the
    // story's own payload. A zone that has never heard of this component can do
    // the first, which is the point of publishing it under a MIME type.
    setDropped(`moved ${readMultiDragIds(transfer).join(', ')}`);
    setPayload(transfer.getData(MIME));
  }, []);

  return (
    <MultiDragManager
      className="w-[420px] max-w-full gap-3"
      getGroupData={getGroupData}
      renderPreview={renderPreview}
      selectedIds={selected}
    >
      <View className="gap-1.5">
        {ROWS.map((id) => (
          <Row id={id} isSelected={selected.includes(id)} key={id} onPress={toggle} />
        ))}
      </View>
      <Dragzone
        className="rounded-lg border border-border border-dashed p-3"
        eligibleClassName="border-info"
        onDrop={took}
        overClassName="border-info bg-info/10"
        testID={ZONE_TEST_ID}
      >
        <Text size="sm" weight="medium">
          Drop here
        </Text>
      </Dragzone>
      <Note testID={READOUT_TEST_ID}>{dropped}</Note>
      <Note testID={PAYLOAD_TEST_ID}>{payload}</Note>
      <Note>{HINT}</Note>
    </MultiDragManager>
  );
}

const meta = {
  title: 'Gestures/MultiDragManager',
  component: MultiDragManager,
  parameters: { layout: 'centered' },
  // children and the required resolvers are supplied per story; the stubs satisfy
  // the type checker.
  args: { children: null, getGroupData: () => ({}), selectedIds: [] },
} satisfies Meta<typeof MultiDragManager>;

type Story = StoryObj<typeof meta>;

export default meta;

/** The state word a `Row` renders, queried by name. */
const stateOf = (canvas: ReturnType<typeof within>, id: string) => canvas.findByTestId(`${ROW_TEST_ID}-${id}-state`);

/** Click a row to add it to (or take it out of) the selection. */
const pressRow = async (canvas: ReturnType<typeof within>, id: string) =>
  userEvent.click(await canvas.findByTestId(`${ROW_TEST_ID}-${id}-press`));

/** Select rows, drag one of them, read the group back off the drop. */
export const Interactive: Story = { render: () => <RowsDemo /> };

/**
 * Two rows selected, one of them lifted: both travel, and both say so while the
 * drag is in flight.
 *
 * The row nobody grabbed is the assertion. It reads `lifting` because it asked
 * `useIsLifting`, which answers off the drag's own transfer rather than off
 * anything the grabbed row told it.
 */
export const GroupTravels: Story = {
  name: 'Behaviour: Lifting a selected row carries the selection',
  render: () => <RowsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alpha = await canvas.findByTestId(`${ROW_TEST_ID}-Alpha`);
    const zone = await canvas.findByTestId(ZONE_TEST_ID);
    const transfer = newDragTransfer();

    await dragOnto({ source: alpha, target: zone, to: centerOf(zone), transfer });

    // Mid-drag: the member left behind knows it is moving too.
    await expect(await stateOf(canvas, 'Bravo')).toHaveTextContent('lifting');
    await expect(await stateOf(canvas, 'Charlie')).toHaveTextContent('idle');

    fireDrag(alpha, 'dragend', transfer, centerOf(zone));
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('moved Alpha, Bravo');

    // And the set empties with the drag, so no cleanup is owed after a drop.
    await expect(await stateOf(canvas, 'Bravo')).toHaveTextContent('selected');
  },
};

/**
 * The same list, dragged by a row that is not selected: only that row moves, and
 * the selection is left exactly as it was.
 *
 * This is the rule every file manager and mail client already follows, and it is
 * what `resolveIds` defaults to — the manager needs no configuration to get it.
 */
export const UnselectedTravelsAlone: Story = {
  name: 'Behaviour: Lifting an unselected row carries only it',
  render: () => <RowsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const charlie = await canvas.findByTestId(`${ROW_TEST_ID}-Charlie`);
    const zone = await canvas.findByTestId(ZONE_TEST_ID);
    const transfer = newDragTransfer();

    await dragOnto({ source: charlie, target: zone, to: centerOf(zone), transfer });

    // The selection is untouched: dragging past it is not a way to change it.
    await expect(await stateOf(canvas, 'Alpha')).toHaveTextContent('selected');
    await expect(await stateOf(canvas, 'Bravo')).toHaveTextContent('selected');
    await expect(await stateOf(canvas, 'Charlie')).toHaveTextContent('lifting');

    fireDrag(charlie, 'dragend', transfer, centerOf(zone));
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('moved Charlie');
  },
};

/**
 * The selection changed by clicking, then dragged — and read back two ways off one
 * drop.
 *
 * `readMultiDragIds` needs nothing from the manager, so a zone written before this
 * component existed can take a group drag. The `getGroupData` payload rides
 * alongside it for a zone that wants the richer form.
 */
export const TransferPayload: Story = {
  name: 'API: Reading the group off the transfer',
  render: () => <RowsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Bravo out, Delta in — so the group is one the initial state never held.
    await pressRow(canvas, 'Bravo');
    await pressRow(canvas, 'Delta');
    await expect(await stateOf(canvas, 'Bravo')).toHaveTextContent('idle');

    const delta = await canvas.findByTestId(`${ROW_TEST_ID}-Delta`);
    const zone = await canvas.findByTestId(ZONE_TEST_ID);
    const transfer = newDragTransfer();

    await dragOnto({ source: delta, target: zone, to: centerOf(zone), transfer });
    fireDrag(delta, 'dragend', transfer, centerOf(zone));

    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('moved Alpha, Delta');
    await expect(await canvas.findByTestId(PAYLOAD_TEST_ID)).toHaveTextContent('Alpha + Delta');

    // Both entries are on the one transfer, written by the manager and by the
    // consumer's own `getGroupData`.
    await expect(transfer.types).toContain(MULTI_DRAG_IDS_MIME);
    await expect(transfer.types).toContain(MIME);
  },
};
