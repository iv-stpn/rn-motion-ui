/**
 * Stories for `<SortableList>` — drag-to-reorder list where items visually
 * reorder in real-time during the drag.
 *
 * These run under react-native-web, so the drag transport is the browser's own
 * HTML5 drag. The assertions below dispatch synthetic `DragEvent`s through the
 * same DOM nodes the component renders, which exercises the Dragzone/Draggable
 * wiring and the translation-math–based insertion-index calculation.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { centerOf, dragOnto, fireDrag, liftDrag, newDragTransfer, settle } from '../../../__stories__/story-drag';
import { ELEVATION_KEYS, ELEVATIONS, type ElevationKey } from '../../../__stories__/story-elevations';
import { Choice, ControlCard, Note, Playground, Section, Toggle } from '../../../__stories__/story-harness';
import { cn } from '../../../lib/cn';
import type { SurfaceElevation } from '../../../lib/elevated';
import { surface } from '../../../lib/surface';
import { Text } from '../../typography/Text/text';
import { SortableList } from './sortable-list';
import type { SortableListProps } from './sortable-list.types';

const MIME = 'application/x-sortable-item';
const LIST_TEST_ID = 'story-sortable-list';
const ITEM_PREFIX = `${LIST_TEST_ID}-item`;
const REORDER_READOUT = 'story-sortable-reorder-readout';
/** Separated cards have shadow + rounded corners — the extra 8 px act as the visual gap. */
const SEPARATED_ITEM_HEIGHT = 56;
/**
 * Grouped rows sit flush with no gap between them; the height matches the
 * content exactly so rows touch.
 */
const GROUPED_ITEM_HEIGHT = 44;

type Todo = { id: string; title: string };

const DEFAULT_ITEMS: Todo[] = [
  { id: 'a', title: 'Review pull request' },
  { id: 'b', title: 'Update dependencies' },
  { id: 'c', title: 'Write tests' },
  { id: 'd', title: 'Deploy to staging' },
];

// ── Grip handle ──────────────────────────────────────────────────────────

/**
 * A vertical grip handle — three rows of two dots — the visual affordance that
 * says "this row can be dragged." Mirrors the Pragmatic Drag and Drop pattern
 * of a small grip icon on the leading edge of each sortable item.
 */
function GripHandle() {
  return (
    <View className="mr-2 gap-0.5 py-1">
      <View className="flex-row gap-0.5">
        <View className="h-1 w-1 rounded-full bg-muted-foreground/40" />
        <View className="h-1 w-1 rounded-full bg-muted-foreground/40" />
      </View>
      <View className="flex-row gap-0.5">
        <View className="h-1 w-1 rounded-full bg-muted-foreground/40" />
        <View className="h-1 w-1 rounded-full bg-muted-foreground/40" />
      </View>
      <View className="flex-row gap-0.5">
        <View className="h-1 w-1 rounded-full bg-muted-foreground/40" />
        <View className="h-1 w-1 rounded-full bg-muted-foreground/40" />
      </View>
    </View>
  );
}

// ── Row variants ─────────────────────────────────────────────────────────

type RowProps = { first: boolean; isDragging: boolean; item: Todo; last: boolean };

type GroupedRadius = 'rounded-lg' | 'rounded-t-lg' | 'rounded-b-lg' | '';
function groupedRadius(first: boolean, last: boolean): GroupedRadius {
  if (first && last) return 'rounded-lg';
  if (first) return 'rounded-t-lg';
  if (last) return 'rounded-b-lg';
  return '';
}

function GroupedRow({ first, isDragging, item, last }: RowProps) {
  // The corner radius describes where this row sits in the stack, not the row
  // itself. While dragging, the row travels to the insertion slot, so it sheds
  // the radius — otherwise rounded corners ride along into the middle of the list.
  const radius = isDragging ? '' : groupedRadius(first, last);
  return (
    <View
      className={cn(
        'flex-row items-center bg-surface-1 px-4 py-3 transition-opacity duration-300 ease-out',
        isDragging && 'opacity-40',
        radius,
      )}
    >
      <GripHandle />
      <Text>{item.title}</Text>
    </View>
  );
}

type SeparatedRowProps = { isDragging: boolean; item: Todo; elevation: SurfaceElevation; floating: boolean };

function SeparatedRow({ isDragging, item, elevation, floating }: SeparatedRowProps) {
  return (
    <View
      className={cn(
        'flex-row items-center rounded-lg',
        surface(elevation, undefined, floating),
        'px-4 py-3 transition-[opacity,scale] duration-300 ease-out',
        isDragging && 'scale-[0.98] opacity-40',
      )}
    >
      <GripHandle />
      <Text>{item.title}</Text>
    </View>
  );
}

// ── Interactive demo ─────────────────────────────────────────────────────

type Variant = 'grouped' | 'separated';

const VARIANTS = ['grouped', 'separated'] as const;

type InteractiveDemoProps = { disabled?: boolean; items?: Todo[] };
function InteractiveDemo({ disabled = false, items: initialItems = DEFAULT_ITEMS }: InteractiveDemoProps) {
  const [variant, setVariant] = useState<Variant>('grouped');
  const [groupedItems, setGroupedItems] = useState(initialItems);
  const [spacedItems, setSpacedItems] = useState(initialItems);
  const [lastReorder, setLastReorder] = useState('None');
  const [elevationKey, setElevationKey] = useState<ElevationKey>('2');
  const [floating, setFloating] = useState(false);

  const items = variant === 'grouped' ? groupedItems : spacedItems;
  const setItems = variant === 'grouped' ? setGroupedItems : setSpacedItems;
  // Grouped rows sit flush with no gap — itemHeight equals content height so
  // each row touches the next.  Separated cards include the visual gap in the
  // height so the slot spacing accounts for it.
  const itemHeight = variant === 'grouped' ? GROUPED_ITEM_HEIGHT : SEPARATED_ITEM_HEIGHT;

  const handleReorder = useCallback(
    (newItems: Todo[], from: number, to: number) => {
      setItems(newItems);
      setLastReorder(`${from} → ${to}`);
    },
    [setItems],
  );

  const renderGroupedItem: SortableListProps<Todo>['renderItem'] = useCallback(
    (item, index, isDragging) => (
      <GroupedRow first={index === 0} isDragging={isDragging} item={item} last={index === items.length - 1} />
    ),
    [items.length],
  );

  const renderSeparatedItem: SortableListProps<Todo>['renderItem'] = useCallback(
    (item, _index, isDragging) => (
      <SeparatedRow elevation={ELEVATIONS[elevationKey]} floating={floating} isDragging={isDragging} item={item} />
    ),
    [elevationKey, floating],
  );

  const renderItem = variant === 'grouped' ? renderGroupedItem : renderSeparatedItem;

  return (
    <Playground className="w-full">
      <ControlCard title="Options">
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
        <Toggle label="Floating" onChange={setFloating} value={floating} />
        <Choice label="Elevation" onChange={setElevationKey} options={ELEVATION_KEYS} value={elevationKey} />
      </ControlCard>
      <Note testID={REORDER_READOUT}>{lastReorder}</Note>
      <Section title="List">
        <View className={variant === 'grouped' ? 'overflow-hidden rounded-lg' : undefined}>
          <SortableList
            disabled={disabled}
            itemHeight={itemHeight}
            items={items}
            keyExtractor={(todo) => todo.id}
            mimeType={MIME}
            onReorder={handleReorder}
            renderItem={renderItem}
            testID={LIST_TEST_ID}
          />
        </View>
      </Section>
    </Playground>
  );
}

const meta: Meta<typeof InteractiveDemo> = { component: InteractiveDemo, title: 'Gestures / SortableList' };

export default meta;

type Story = StoryObj<typeof InteractiveDemo>;

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
};

// ── Edge cases ───────────────────────────────────────────────────────────

type StaticDemoProps = { disabled?: boolean; items?: Todo[] };

function StaticDemo({ disabled = false, items: initialItems = DEFAULT_ITEMS }: StaticDemoProps) {
  const [items, setItems] = useState(initialItems);
  const [lastReorder, setLastReorder] = useState('None');

  const handleReorder = useCallback((newItems: Todo[], from: number, to: number) => {
    setItems(newItems);
    setLastReorder(`${from} → ${to}`);
  }, []);

  const renderItem: SortableListProps<Todo>['renderItem'] = useCallback(
    (item, _i, isDragging) => <SeparatedRow elevation={2} floating={false} isDragging={isDragging} item={item} />,
    [],
  );

  return (
    <View className="gap-4">
      <View testID={REORDER_READOUT}>
        <Text>{lastReorder}</Text>
      </View>
      <SortableList
        disabled={disabled}
        itemHeight={SEPARATED_ITEM_HEIGHT}
        items={items}
        keyExtractor={(todo) => todo.id}
        mimeType={MIME}
        onReorder={handleReorder}
        renderItem={renderItem}
        testID={LIST_TEST_ID}
      />
    </View>
  );
}

export const Empty: Story = {
  render: () => <StaticDemo items={[]} />,
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).queryByTestId(LIST_TEST_ID);
    await expect(list).not.toBeNull();
  },
};

export const Single: Story = {
  render: () => <StaticDemo items={[{ id: 'only', title: 'The only item' }]} />,
};

export const Disabled: Story = {
  render: () => <StaticDemo disabled={true} />,
  play: async ({ canvasElement }) => {
    const frame = within(canvasElement);
    const first = frame.getByTestId(`${ITEM_PREFIX}-a`);
    await expect(first).not.toBeNull();
  },
};

/**
 * Drag the first item ("Review pull request") over the third ("Write tests")
 * and drop it there. The reorder should fire with `0 → 2` (item moves from
 * index 0 to index 2 in the array after removal).
 */
export const ReorderFirstToThird: Story = {
  render: () => <StaticDemo />,
  play: async ({ canvasElement }) => {
    const frame = within(canvasElement);
    const readout = frame.getByTestId(REORDER_READOUT);
    await expect(readout).toHaveTextContent('None');

    const source = frame.getByTestId(`${ITEM_PREFIX}-a`);
    const target = frame.getByTestId(`${ITEM_PREFIX}-c`);
    const targetZone = target.parentElement;
    if (!targetZone) throw new Error('no parent Dragzone');
    const transfer = newDragTransfer();
    const from = centerOf(source);
    const to = centerOf(target);

    await dragOnto({ source, target: targetZone, to, transfer, from });
    fireDrag(source, 'dragend', transfer, to);
    // React batches state updates during event handlers; `settle` drains the timer
    // the re-render lands on before we assert the readout.
    await settle();

    await expect(readout).toHaveTextContent('0 → 2');
  },
};

/**
 * Regression test for the atomic drop commit: after a reorder commits, the
 * shared drag state (activeIndex/insertionIndex) must be fully reset before
 * the reorder render, so a follow-up drag starts from the NEW canonical order
 * with fresh indices. A stale active index leaking into the next drag (the
 * deferred-commit design that caused the drop jitter) would make the second
 * drag resolve against the pre-reorder positions.
 */
export const CommitThenFollowUpReorder: Story = {
  render: () => <StaticDemo />,
  play: async ({ canvasElement }) => {
    const frame = within(canvasElement);
    const readout = frame.getByTestId(REORDER_READOUT);
    await expect(readout).toHaveTextContent('None');

    // First drag: first item ("a", index 0) onto the third ("c", index 2).
    // Commits `0 → 2`; the new order is [b, c, a, d].
    const sourceA = frame.getByTestId(`${ITEM_PREFIX}-a`);
    const targetC = frame.getByTestId(`${ITEM_PREFIX}-c`);
    const targetCZone = targetC.parentElement;
    if (!targetCZone) throw new Error('no parent Dragzone');
    const firstTransfer = newDragTransfer();
    await dragOnto({
      source: sourceA,
      target: targetCZone,
      to: centerOf(targetC),
      transfer: firstTransfer,
      from: centerOf(sourceA),
    });
    fireDrag(sourceA, 'dragend', firstTransfer, centerOf(targetC));
    await settle();
    await expect(readout).toHaveTextContent('0 → 2');

    // Second drag: from the NEW order — "c" now sits at index 1; drag it onto
    // "d" at index 3. The commit must resolve against the post-reorder
    // canonical indices: `1 → 3`.
    const sourceC = frame.getByTestId(`${ITEM_PREFIX}-c`);
    const targetD = frame.getByTestId(`${ITEM_PREFIX}-d`);
    const targetDZone = targetD.parentElement;
    if (!targetDZone) throw new Error('no parent Dragzone');
    const secondTransfer = newDragTransfer();
    await dragOnto({
      source: sourceC,
      target: targetDZone,
      to: centerOf(targetD),
      transfer: secondTransfer,
      from: centerOf(sourceC),
    });
    fireDrag(sourceC, 'dragend', secondTransfer, centerOf(targetD));
    await settle();

    await expect(readout).toHaveTextContent('1 → 3');
  },
};

/**
 * A drag that starts but is cancelled (Escape). The order should not change.
 */
export const CancelledDrag: Story = {
  render: () => <StaticDemo />,
  play: async ({ canvasElement }) => {
    const frame = within(canvasElement);
    const readout = frame.getByTestId(REORDER_READOUT);

    const source = frame.getByTestId(`${ITEM_PREFIX}-a`);
    const transfer = newDragTransfer();
    const from = centerOf(source);

    await liftDrag(source, transfer, from);
    fireDrag(source, 'dragend', transfer, from);

    await expect(readout).toHaveTextContent('None');
  },
};

/**
 * Drop an item onto itself — a no-op.
 */
export const SelfDrop: Story = {
  render: () => <StaticDemo />,
  play: async ({ canvasElement }) => {
    const frame = within(canvasElement);
    const readout = frame.getByTestId(REORDER_READOUT);

    const source = frame.getByTestId(`${ITEM_PREFIX}-b`);
    const target = frame.getByTestId(`${ITEM_PREFIX}-b`);
    const transfer = newDragTransfer();
    const to = centerOf(target);

    await dragOnto({ source, target, to, transfer });
    fireDrag(source, 'dragend', transfer, to);

    await expect(readout).toHaveTextContent('None');
  },
};

/**
 * Items with different content heights inside a fixed `itemHeight`.
 *
 * SortableList requires a uniform `itemHeight` — it uses
 * `Math.round(translation.y / itemHeight)` to compute the insertion index, so
 * every slot must be the same size.  Content taller than `itemHeight` is
 * clipped; content shorter than `itemHeight` gets empty space.
 *
 * Use {@link ../ReorderableList/reorderable-list|`<ReorderableList>`} (indicator
 * mode) when items genuinely need different heights.
 */
export const DifferentHeights: Story = {
  render: () => {
    const tallItems: Todo[] = [
      { id: 'a', title: 'Short' },
      {
        id: 'b',
        title:
          'A much taller item that will be clipped because it exceeds the fixed item height of 56 pixels and demonstrates the uniform slot constraint of SortableList',
      },
      { id: 'c', title: 'Medium content that should fit nicely' },
      { id: 'd', title: 'Tiny' },
    ];

    function DifferentHeightsDemo() {
      const [items, setItems] = useState(tallItems);
      const [lastReorder, setLastReorder] = useState('None');

      const handleReorder = useCallback((newItems: Todo[], from: number, to: number) => {
        setItems(newItems);
        setLastReorder(`${from} → ${to}`);
      }, []);

      const renderItem: SortableListProps<Todo>['renderItem'] = useCallback(
        (item, _i, isDragging) => (
          <View
            className={cn(
              'flex-row items-start overflow-hidden rounded-lg bg-surface-1 px-4 py-3 transition-opacity duration-300 ease-out',
              isDragging && 'opacity-40',
            )}
          >
            <GripHandle />
            <Text>{item.title}</Text>
          </View>
        ),
        [],
      );

      return (
        <View className="gap-4">
          <View testID={REORDER_READOUT}>
            <Text>{lastReorder}</Text>
          </View>
          <SortableList
            itemHeight={SEPARATED_ITEM_HEIGHT}
            items={items}
            keyExtractor={(todo) => todo.id}
            mimeType={MIME}
            onReorder={handleReorder}
            renderItem={renderItem}
            testID={LIST_TEST_ID}
          />
        </View>
      );
    }

    return <DifferentHeightsDemo />;
  },
};
