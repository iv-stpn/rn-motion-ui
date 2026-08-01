import type { Meta, StoryObj } from '@storybook/react';
import { createRef, useRef, useState } from 'react';
import { type LayoutChangeEvent, ScrollView, View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Text } from '../../typography/Text/text';
import { ScrollTo } from './scroll-to';

const SECTIONS = [
  { id: 'intro', label: 'Intro' },
  { id: 'features', label: 'Features' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

const meta = {
  title: 'Scroll/ScrollTo',
  component: ScrollTo,
  parameters: { layout: 'centered' },
  // Satisfies the required props at the type level; stories build a live demo.
  args: { scrollRef: createRef<ScrollView>(), to: 0, children: 'Top', onPress: fn() },
} satisfies Meta<typeof ScrollTo>;

type Story = StoryObj<typeof meta>;

type DemoProps = { onPress: () => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Demo({ onPress }: DemoProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [tops, setTops] = useState<Record<string, number>>({});

  const measure = (id: string) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    setTops((prev) => (prev[id] === y ? prev : { ...prev, [id]: y }));
  };

  return (
    <View className="h-[320px] w-[360px] overflow-hidden rounded-2xl border border-border">
      <View className="flex-row gap-1.5 border-border border-b p-2">
        {SECTIONS.map((s) => (
          <ScrollTo
            key={s.id}
            scrollRef={scrollRef}
            to={tops[s.id] ?? 0}
            offset={-8}
            onPress={onPress}
            testID={`nav-${s.id}`}
            className="rounded-full border border-border bg-surface-3 px-3 py-1"
          >
            {s.label}
          </ScrollTo>
        ))}
      </View>
      <ScrollView ref={scrollRef} scrollEventThrottle={16}>
        {SECTIONS.map((s) => (
          <View key={s.id} onLayout={measure(s.id)} className="h-[240px] items-center justify-center">
            <Text className="font-medium text-[18px]">{s.label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default meta;

export const Interactive: Story = {
  render: (args) => (
    <Demo
      onPress={
        args.onPress ??
        (() => {
          /* noop */
        })
      }
    />
  ),
};

export const Nav: Story = {
  name: 'Demo: Scroll to a section',
  render: (args) => (
    <Demo
      onPress={
        args.onPress ??
        (() => {
          /* noop */
        })
      }
    />
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByTestId('nav-pricing');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalled();
  },
};
