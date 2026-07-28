import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Action, Controls, Note, Playground, Toggle } from '../../__stories__/story-harness';
import { X } from '../../lib/icons';
import { Text } from '../Text/text';
import { AnimatedList, AnimatedListItem } from './animated-list';

const meta = {
  title: 'Components/AnimatedList',
  parameters: { layout: 'centered' },
} satisfies Meta;

type Story = StoryObj<typeof meta>;

type Item = { id: number; label: string };

const SEED = ['Overview', 'Details', 'Notes'];
const EXPAND_BODY =
  "Expanding this content grows the item's measured height. The outer container animates to the new height, pushing siblings out of the way without a layout prop.";
const HINT = 'Press a row to grow it, or the × to collapse it out of the list.';

type RowProps = { item: Item; expanded: boolean; onToggle: (id: number) => void; onRemove: (id: number) => void };

// Its own component so each row's handlers are stable per id.
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Row({ item, expanded, onToggle, onRemove }: RowProps) {
  const toggle = useCallback(() => onToggle(item.id), [onToggle, item.id]);
  const remove = useCallback(() => onRemove(item.id), [onRemove, item.id]);
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-surface-3 px-4 py-3 shadow-surface-3">
      <Pressable className="flex-1" onPress={toggle}>
        <Text className="font-medium text-base text-foreground">{item.label}</Text>
        {expanded ? <Text className="mt-2 text-muted-foreground text-sm leading-relaxed">{EXPAND_BODY}</Text> : null}
      </Pressable>
      <Pressable accessibilityLabel={`Remove ${item.label}`} hitSlop={8} onPress={remove}>
        <X size={16} />
      </Pressable>
    </View>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function AnimatedListPlayground() {
  const idRef = useRef(0);
  const make = useCallback((label: string): Item => {
    const id = idRef.current;
    idRef.current += 1;
    return { id, label };
  }, []);

  const [items, setItems] = useState<Item[]>(() => SEED.map((label) => make(label)));
  const [expanded, setExpanded] = useState<number[]>([]);

  const add = useCallback(() => setItems((prev) => [...prev, make(`Item ${prev.length + 1}`)]), [make]);
  const removeLast = useCallback(() => setItems((prev) => prev.slice(0, -1)), []);
  const remove = useCallback((id: number) => setItems((prev) => prev.filter((item) => item.id !== id)), []);
  const toggle = useCallback(
    (id: number) => setExpanded((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id])),
    [],
  );
  const expandAll = useCallback((next: boolean) => setExpanded(next ? items.map((item) => item.id) : []), [items]);

  const allExpanded = items.length > 0 && expanded.length === items.length;
  const summary = `${items.length} items, ${expanded.length} expanded`;

  return (
    <Playground style={{ width: 320 }}>
      <Controls>
        <Action label="Add item" onPress={add} />
        <Action label="Remove last" onPress={removeLast} />
        <Toggle label="Expand all" onChange={expandAll} value={allExpanded} />
      </Controls>

      <Note>{summary}</Note>

      <AnimatedList>
        {items.map((item) => (
          <AnimatedListItem key={item.id}>
            <Row expanded={expanded.includes(item.id)} item={item} onRemove={remove} onToggle={toggle} />
          </AnimatedListItem>
        ))}
      </AnimatedList>

      <Note>{HINT}</Note>
    </Playground>
  );
}

export default meta;

/**
 * Adding and removing items animates each one in (height + opacity + rise) and
 * out (the height collapse drives the sibling reflow). Expanding a row changes
 * its measured height, and the container follows it.
 */
export const Interactive: Story = {
  render: () => <AnimatedListPlayground />,
};

/**
 * The two halves of the item lifecycle, both of which fail silently if their
 * wiring breaks.
 *
 * **In:** each item's outer view starts at `height: 0` and only grows once
 * `onLayout` reports the content's natural height. If that measurement never
 * lands the row still mounts, still passes a `findByText`, and is still
 * invisible — collapsed to nothing inside `overflow-hidden`. So the assertion
 * is on the measured box, not on the text.
 *
 * **Out:** removal goes through `AnimatePresence`. The item is expected to stay
 * mounted while its height collapses and to unmount only when `safeToUnmount`
 * fires from the timing callback. An item that disappeared the instant its key
 * left the array would mean presence isn't wired — the list would still "work",
 * just without an exit animation, which is the entire component.
 */
export const Default: Story = {
  name: 'Demo: Items animate in and out',
  render: () => <AnimatedListPlayground />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The measured box is AnimatedListItem's outer view — the `overflow-hidden`
    // wrapper whose animated height drives the sibling reflow.
    const boxFor = (label: string) => {
      const box = canvas.getByText(label).closest('.overflow-hidden');
      if (!(box instanceof HTMLElement)) throw new Error(`No AnimatedListItem box around "${label}"`);
      return box;
    };

    await Promise.all(SEED.map(async (label) => expect(await canvas.findByText(label)).toBeInTheDocument()));
    // 280ms height tween from 0 once the first layout pass reports a height.
    await waitFor(() => {
      for (const label of SEED) expect(boxFor(label).getBoundingClientRect().height).toBeGreaterThan(0);
    });

    // A new item takes the same path: mounted collapsed, then measured open.
    await userEvent.click(await canvas.findByTestId('story-action-add-item'));
    const added = await canvas.findByText('Item 4');
    await expect(added).toBeInTheDocument();
    await waitFor(() => expect(boxFor('Item 4').getBoundingClientRect().height).toBeGreaterThan(0));

    // Removal is deferred, not immediate: still mounted right after the press,
    // gone once the 240ms collapse completes and releases it.
    await userEvent.click(await canvas.findByLabelText('Remove Notes'));
    await expect(canvas.getByText('Notes')).toBeInTheDocument();
    await waitFor(() => expect(canvas.queryByText('Notes')).toBeNull(), { timeout: 2000 });

    // The rest of the list survives the removal.
    await expect(canvas.getByText('Overview')).toBeInTheDocument();
    await expect(canvas.getByText('Item 4')).toBeInTheDocument();
  },
};
