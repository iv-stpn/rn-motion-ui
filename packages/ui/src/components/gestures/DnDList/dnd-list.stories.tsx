/**
 * Stories for `<DnDList>` — drag-to-reorder list built on the gesture primitives.
 *
 * These run under react-native-web, so the drag transport is the browser's own
 * HTML5 drag. The assertions below dispatch synthetic `DragEvent`s through the
 * same DOM nodes the component renders, which exercises the store wiring: zone
 * rect measurement, hit testing, the `accepts` predicate, and the reorder
 * callbacks.
 */
/** biome-ignore-all lint/style/useExportsLast: stories only */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: stories only */
/** biome-ignore-all lint/style/noJsxLiterals: stories only */
/** biome-ignore-all lint/performance/noJsxPropsBind: stories only */

import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { expect, within } from 'storybook/test';
import { centerOf, dragOnto, fireDrag, liftDrag, newDragTransfer } from '../../../__stories__/story-drag';
import { Text } from '../../typography/Text/text';
import { DnDList } from './dnd-list';
import type { DnDListProps } from './dnd-list.types';

const MIME = 'application/x-dnd-item';
const LIST_TEST_ID = 'story-dnd-list';
const ITEM_PREFIX = `${LIST_TEST_ID}-item`;
const REORDER_READOUT = 'story-dnd-reorder-readout';

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

/**
 * **Grouped** — items are connected edge-to-edge as a single continuous block.
 * The container owns the border and corner radius; individual rows have no
 * rounding of their own. The first and last rows round their outer corners so
 * the group reads as one surface.
 */
function groupedRadius(first: boolean, last: boolean): string {
  if (first && last) return 'rounded-lg';
  if (first) return 'rounded-t-lg';
  if (last) return 'rounded-b-lg';
  return '';
}

function GroupedRow({ first, isDragging, item, last }: RowProps) {
  const radius = groupedRadius(first, last);
  return (
    <View
      className={`flex-row items-center border-border border-b bg-surface-1 px-4 py-3 transition-all duration-300 ease-out ${isDragging ? 'opacity-40' : ''} ${radius} ${last ? 'border-b-0' : ''}`}
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
      className={`flex-row items-center rounded-lg border border-border bg-surface-1 px-4 py-3 shadow-surface-2 transition-all duration-300 ease-out ${isDragging ? 'scale-[0.98] opacity-40' : ''}`}
    >
      <GripHandle />
      <Text>{item.title}</Text>
    </View>
  );
}

// ── Interactive demo ─────────────────────────────────────────────────────

type Variant = 'grouped' | 'separated';

type InteractiveDemoProps = { disabled?: boolean; items?: Todo[] };

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

  const renderGroupedItem: DnDListProps<Todo>['renderItem'] = useCallback(
    (item, index, isDragging) => (
      <GroupedRow first={index === 0} isDragging={isDragging} item={item} last={index === items.length - 1} />
    ),
    [items.length],
  );

  const renderSeparatedItem: DnDListProps<Todo>['renderItem'] = useCallback(
    (item, _index, isDragging) => <SeparatedRow isDragging={isDragging} item={item} />,
    [],
  );

  return (
    <View className="gap-4">
      <View className="flex-row gap-2">
        <Pressable
          className={`rounded-full px-3 py-1 ${variant === 'grouped' ? 'bg-primary' : 'bg-muted'}`}
          onPress={() => setVariant('grouped')}
          testID="variant-grouped"
        >
          <Text className={variant === 'grouped' ? 'text-primary-foreground' : ''}>Grouped</Text>
        </Pressable>
        <Pressable
          className={`rounded-full px-3 py-1 ${variant === 'separated' ? 'bg-primary' : 'bg-muted'}`}
          onPress={() => setVariant('separated')}
          testID="variant-separated"
        >
          <Text className={variant === 'separated' ? 'text-primary-foreground' : ''}>Separated</Text>
        </Pressable>
      </View>
      <View testID={REORDER_READOUT}>
        <Text>{lastReorder}</Text>
      </View>
      {variant === 'grouped' ? (
        <View className="overflow-hidden rounded-lg border border-border">
          <DnDList
            disabled={disabled}
            items={items}
            keyExtractor={(todo) => todo.id}
            mimeType={MIME}
            onReorder={handleReorder}
            renderItem={renderGroupedItem}
            testID={LIST_TEST_ID}
          />
        </View>
      ) : (
        <View className="gap-2">
          <DnDList
            disabled={disabled}
            items={items}
            keyExtractor={(todo) => todo.id}
            mimeType={MIME}
            onReorder={handleReorder}
            renderItem={renderSeparatedItem}
            testID={LIST_TEST_ID}
          />
        </View>
      )}
    </View>
  );
}

const meta: Meta<typeof InteractiveDemo> = { component: InteractiveDemo, title: 'Gestures / DnDList' };

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

  const renderItem: DnDListProps<Todo>['renderItem'] = useCallback(
    (item, _i, isDragging) => <SeparatedRow isDragging={isDragging} item={item} />,
    [],
  );

  return (
    <View className="gap-4">
      <View testID={REORDER_READOUT}>
        <Text>{lastReorder}</Text>
      </View>
      <DnDList
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
    const transfer = newDragTransfer();
    const to = centerOf(target);

    await dragOnto({ source, target, to, transfer });
    fireDrag(source, 'dragend', transfer, to);

    // Item "a" moved from index 0 to before "d" (index 2 after removing "a"),
    // which is index 3 before removal → the callback receives (items, 0, 2).
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
