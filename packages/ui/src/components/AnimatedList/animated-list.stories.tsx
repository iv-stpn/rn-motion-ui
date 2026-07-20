import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { X } from '../../lib/icons';
import { Button } from '../Button/button';
import { AnimatedList, AnimatedListItem } from './animated-list';

const meta = {
  title: 'Components/AnimatedList',
  parameters: { layout: 'centered' },
} satisfies Meta;

type Story = StoryObj<typeof meta>;

type Item = { id: number; label: string };

const ADD_LABEL = '+ Add item';
const EXPAND_BODY =
  "Expanding this content grows the item's measured height. The outer container animates to the new height, pushing siblings out of the way without a layout prop.";
const SECTIONS = ['Overview', 'Details', 'Notes'];

export default meta;

/**
 * Adding and removing items animates each item in (height + opacity + rise)
 * and out (height collapse drives sibling reflow).
 */
export const Default: Story = {
  render: () => {
    const idRef = useRef(0);
    const make = useCallback((label: string): Item => {
      const id = idRef.current;
      idRef.current += 1;
      return { id, label };
    }, []);
    const [items, setItems] = useState<Item[]>(() => [make('First item'), make('Second item'), make('Third item')]);

    const add = useCallback(() => {
      setItems((prev) => [...prev, make(`Item ${prev.length + 1}`)]);
    }, [make]);
    const remove = useCallback((id: number) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, []);

    return (
      <View className="w-80 gap-3">
        <Button onPress={add}>{ADD_LABEL}</Button>
        <AnimatedList>
          {items.map((item) => (
            <AnimatedListItem key={item.id}>
              <View className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 shadow-modal">
                <Text className="text-base text-foreground">{item.label}</Text>
                <Pressable onPress={() => remove(item.id)} hitSlop={8} accessibilityLabel={`Remove ${item.label}`}>
                  <X size={16} />
                </Pressable>
              </View>
            </AnimatedListItem>
          ))}
        </AnimatedList>
      </View>
    );
  },
};

/**
 * Toggling an item's content changes its measured height; the outer container
 * animates to the new height and siblings reflow smoothly.
 */
export const GrowCollapse: Story = {
  render: () => {
    const [expanded, setExpanded] = useState<number | null>(1);
    const toggle = useCallback((index: number) => {
      setExpanded((cur) => (cur === index ? null : index));
    }, []);

    return (
      <View className="w-80">
        <AnimatedList>
          {SECTIONS.map((title, i) => (
            <AnimatedListItem key={title}>
              <Pressable onPress={() => toggle(i)} className="rounded-xl border border-border bg-surface px-4 py-3 shadow-modal">
                <Text className="font-medium text-base text-foreground">{title}</Text>
                {expanded === i ? (
                  <Text className="mt-2 text-muted-foreground text-sm leading-relaxed">{EXPAND_BODY}</Text>
                ) : null}
              </Pressable>
            </AnimatedListItem>
          ))}
        </AnimatedList>
      </View>
    );
  },
};
