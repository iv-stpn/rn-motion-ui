import type { Meta, StoryObj } from '@storybook/react';
import { createRef, useRef, useState } from 'react';
import { type LayoutChangeEvent, ScrollView, View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Text } from '../Text/text';
import { ScrollTo } from './scroll-to';

const SECTIONS = [
  { id: 'intro', label: 'Intro' },
  { id: 'features', label: 'Features' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

const meta = {
  title: 'Components/ScrollTo',
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
    <View className="overflow-hidden rounded-2xl border border-border" style={{ width: 360, height: 320 }}>
      <View className="flex-row border-border border-b" style={{ gap: 6, padding: 8 }}>
        {SECTIONS.map((s) => (
          <ScrollTo
            key={s.id}
            scrollRef={scrollRef}
            to={tops[s.id] ?? 0}
            offset={-8}
            onPress={onPress}
            testID={`nav-${s.id}`}
            className="rounded-full border border-border bg-surface-3"
            style={{ paddingHorizontal: 12, paddingVertical: 4 }}
          >
            {s.label}
          </ScrollTo>
        ))}
      </View>
      <ScrollView ref={scrollRef} scrollEventThrottle={16}>
        {SECTIONS.map((s) => (
          <View key={s.id} onLayout={measure(s.id)} style={{ height: 240, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '500' }}>{s.label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default meta;

export const Nav: Story = {
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
