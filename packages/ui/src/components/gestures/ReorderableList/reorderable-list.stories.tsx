/**
 * Stories for `<ReorderableList>` — drag-to-reorder list built on the gesture primitives.
 *
 * These run under react-native-web, so the drag transport is the browser's own
 * HTML5 drag. The assertions below dispatch synthetic `DragEvent`s through the
 * same DOM nodes the component renders, which exercises the store wiring: zone
 * rect measurement, hit testing, the `accepts` predicate, and the reorder
 * callbacks.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, within } from 'storybook/test';
import { centerOf, dragOnto, fireDrag, liftDrag, newDragTransfer, settle } from '../../../__stories__/story-drag';
import { Choice, ControlCard, Note, Playground, Section } from '../../../__stories__/story-harness';
import { cn } from '../../../lib/cn';
import { surface } from '../../../lib/surface';
import { Text } from '../../typography/Text/text';
import { ReorderableList } from './reorderable-list';
import type { ReorderableListProps } from './reorderable-list.types';

const MIME = 'application/x-reorderable-item';
const LIST_TEST_ID = 'story-reorderable-list';
const ITEM_PREFIX = `${LIST_TEST_ID}-item`;
const REORDER_READOUT = 'story-reorderable-reorder-readout';

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
        <View className="h-1 w-1 rounded-full bg-surface-contrast-foreground/40" />
        <View className="h-1 w-1 rounded-full bg-surface-contrast-foreground/40" />
      </View>
      <View className="flex-row gap-0.5">
        <View className="h-1 w-1 rounded-full bg-surface-contrast-foreground/40" />
        <View className="h-1 w-1 rounded-full bg-surface-contrast-foreground/40" />
      </View>
      <View className="flex-row gap-0.5">
        <View className="h-1 w-1 rounded-full bg-surface-contrast-foreground/40" />
        <View className="h-1 w-1 rounded-full bg-surface-contrast-foreground/40" />
      </View>
    </View>
  );
}

// ── Row variants ─────────────────────────────────────────────────────────

type RowProps = { first: boolean; isDragging: boolean; item: Todo; last: boolean };

/**
 * **Grouped** — items are connected edge-to-edge as a single continuous block.
 * The container owns the border and corner radius; individual rows have no
 * rounding of their own. The first and last rows round their outer corners so
 * the group reads as one surface.
 */
type GroupedRadius = 'rounded-lg' | 'rounded-t-lg' | 'rounded-b-lg' | '';
function groupedRadius(first: boolean, last: boolean): GroupedRadius {
  if (first && last) return 'rounded-lg';
  if (first) return 'rounded-t-lg';
  if (last) return 'rounded-b-lg';
  return '';
}

function GroupedRow({ first, isDragging, item, last }: RowProps) {
  const radius = groupedRadius(first, last);
  return (
    <View
      className={cn(
        'flex-row items-center border-border border-b-[1.5px] bg-surface-1 px-4 py-3 transition-all duration-300 ease-out',
        isDragging && 'opacity-40',
        radius,
        last && 'border-b-0',
      )}
    >
      <GripHandle />
      <Text>{item.title}</Text>
    </View>
  );
}

/**
 * **Separated** — each item is its own rounded card with a shadow and vertical
 * spacing, like a stack of independent tiles.
 */
function SeparatedRow({ isDragging, item }: Omit<RowProps, 'first' | 'last'>) {
  return (
    <View
      className={cn(
        'flex-row items-center rounded-lg border-[1.5px] border-border',
        surface(2),
        'px-4 py-3 transition-all duration-300 ease-out',
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

type InteractiveDemoProps = { disabled?: boolean; items?: Todo[] };

const VARIANTS = ['grouped', 'separated'] as const;

function InteractiveDemo({ disabled = false, items: initialItems = DEFAULT_ITEMS }: InteractiveDemoProps) {
  const [variant, setVariant] = useState<Variant>('grouped');
  const [groupedItems, setGroupedItems] = useState(initialItems);
  const [spacedItems, setSpacedItems] = useState(initialItems);
  const [lastReorder, setLastReorder] = useState('None');

  const items = variant === 'grouped' ? groupedItems : spacedItems;
  const setItems = variant === 'grouped' ? setGroupedItems : setSpacedItems;

  const handleReorder = useCallback(
    (newItems: Todo[], from: number, to: number) => {
      setItems(newItems);
      setLastReorder(`${from} → ${to}`);
    },
    [setItems],
  );

  const renderGroupedItem: ReorderableListProps<Todo>['renderItem'] = useCallback(
    (item, index, isDragging) => (
      <GroupedRow first={index === 0} isDragging={isDragging} item={item} last={index === items.length - 1} />
    ),
    [items.length],
  );

  const renderSeparatedItem: ReorderableListProps<Todo>['renderItem'] = useCallback(
    (item, _index, isDragging) => <SeparatedRow isDragging={isDragging} item={item} />,
    [],
  );

  const renderItem = variant === 'grouped' ? renderGroupedItem : renderSeparatedItem;

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Variant" onChange={setVariant} options={VARIANTS} value={variant} />
      </ControlCard>
      <Note testID={REORDER_READOUT}>{lastReorder}</Note>
      <Section title="List">
        <View className={variant === 'grouped' ? 'overflow-hidden rounded-lg border-[1.5px] border-border' : undefined}>
          <ReorderableList
            className={variant === 'separated' ? 'gap-2' : undefined}
            disabled={disabled}
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

const meta: Meta<typeof InteractiveDemo> = { component: InteractiveDemo, title: 'Gestures / ReorderableList' };

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

  const renderItem: ReorderableListProps<Todo>['renderItem'] = useCallback(
    (item, _i, isDragging) => <SeparatedRow isDragging={isDragging} item={item} />,
    [],
  );

  return (
    <View className="gap-4">
      <View testID={REORDER_READOUT}>
        <Text>{lastReorder}</Text>
      </View>
      <ReorderableList
        disabled={disabled}
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
    // Nothing to drag — the list should render an empty container without crashing.
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
    // When disabled, the list should render but dragging should do nothing.
    // We can verify the items are present but won't fire drag events.
    const frame = within(canvasElement);
    const first = frame.getByTestId(`${ITEM_PREFIX}-a`);
    await expect(first).not.toBeNull();
  },
};

/**
 * Drag the first item ("Review pull request") over the third ("Write tests")
 * and drop it there. The reorder should fire with `0 → 2` (item moves from
 * index 0 to index 2, which is index 2 after removal = before item "Deploy to
 * staging" in the original array).
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

    // Use the same pattern as GroupTravels — dragOnto + fireDrag(dragend).
    await dragOnto({ source, target: targetZone, to, transfer, from });
    fireDrag(source, 'dragend', transfer, to);
    // React batches state updates during event handlers; `settle` drains the timer
    // the re-render lands on before we assert the readout.
    await settle();

    await expect(readout).toHaveTextContent('0 → 2');
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
    // End the drag without dropping — simulate Escape.
    fireDrag(source, 'dragend', transfer, from);

    // The order should be unchanged.
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

    // Self-drop is a no-op: the zone's `accepts` rejects its own key.
    await expect(readout).toHaveTextContent('None');
  },
};
