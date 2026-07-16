import type { Meta, StoryObj } from '@storybook/react';
import { createRef, useRef, useState } from 'react';
import { type LayoutChangeEvent, ScrollView, Text, View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
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

export default meta;
type Story = StoryObj<typeof meta>;

function Demo({ onPress }: { onPress: () => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const [tops, setTops] = useState<Record<string, number>>({});

  const measure = (id: string) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    setTops((prev) => (prev[id] === y ? prev : { ...prev, [id]: y }));
  };

  return (
    <View
      style={{ width: 360, height: 320, borderRadius: 16, borderWidth: 1, borderColor: '#e5e5e5', overflow: 'hidden' }}
    >
      <View style={{ flexDirection: 'row', gap: 6, padding: 8, borderBottomWidth: 1, borderColor: '#e5e5e5' }}>
        {SECTIONS.map((s) => (
          <ScrollTo
            key={s.id}
            scrollRef={scrollRef}
            to={tops[s.id] ?? 0}
            offset={-8}
            onPress={onPress}
            testID={`nav-${s.id}`}
          >
            <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#f4f4f5' }}>
              <Text style={{ fontSize: 13, color: '#111111' }}>{s.label}</Text>
            </View>
          </ScrollTo>
        ))}
      </View>
      <ScrollView ref={scrollRef} scrollEventThrottle={16}>
        {SECTIONS.map((s) => (
          <View
            key={s.id}
            onLayout={measure(s.id)}
            style={{ height: 240, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 18, fontWeight: '500', color: '#111111' }}>{s.label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export const Nav: Story = {
  render: (args) => <Demo onPress={args.onPress ?? (() => {})} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByTestId('nav-pricing');
    await userEvent.click(button);
    await expect(args.onPress).toHaveBeenCalled();
  },
};
