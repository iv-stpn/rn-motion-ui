import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
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
