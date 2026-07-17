import type { Meta, StoryObj } from '@storybook/react';
import { useCallback } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, Text, View } from 'react-native';
import { makeMutable, useSharedValue } from 'react-native-reanimated';
import { expect, within } from 'storybook/test';
import { ScrollReveal } from './scroll-reveal';

const CARDS = ['Spring slide', 'Fade in', 'Staggered reveal', 'Reveal once'];
const VIEWPORT = 300;
const SCROLL_HINT = 'Scroll down';
const END_HINT = 'End';

const meta = {
  title: 'Components/ScrollReveal',
  component: ScrollReveal,
  parameters: { layout: 'centered' },
  // Satisfies the required shared value + viewport height at the type level;
  // stories build their own scroll-driven demo below.
  args: { scrollY: makeMutable(0), viewportHeight: VIEWPORT, children: null },
  argTypes: {
    y: { control: { type: 'range', min: 0, max: 60, step: 4 } },
    amount: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
  },
} satisfies Meta<typeof ScrollReveal>;

type Story = StoryObj<typeof meta>;

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Demo({ once }: { once: boolean }) {
  const scrollY = useSharedValue(0);
  // Writing a shared value from the JS thread is valid on web (no worklet plugin
  // needed); ScrollReveal reads it via useDerivedValue/useAnimatedStyle.
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  return (
    <View
      testID="scroll-reveal-demo"
      style={{
        width: 360,
        height: VIEWPORT,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e5e5',
        overflow: 'hidden',
      }}
    >
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ padding: 24, gap: 48 }}>
        <Text style={{ textAlign: 'center', color: '#71717a', fontSize: 14 }}>{SCROLL_HINT}</Text>
        {CARDS.map((label) => (
          <ScrollReveal key={label} scrollY={scrollY} viewportHeight={VIEWPORT} once={once} testID={`reveal-${label}`}>
            <View style={{ borderRadius: 12, backgroundColor: '#f4f4f5', paddingHorizontal: 16, paddingVertical: 48 }}>
              <Text style={{ textAlign: 'center', color: '#111111', fontSize: 16, fontWeight: '500' }}>{label}</Text>
            </View>
          </ScrollReveal>
        ))}
        <Text style={{ textAlign: 'center', color: '#71717a', fontSize: 14 }}>{END_HINT}</Text>
      </ScrollView>
    </View>
  );
}

export default meta;

export const RevealOnce: Story = {
  render: () => <Demo once={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('reveal-Spring slide')).toBeInTheDocument();
  },
};

export const RevealEveryTime: Story = {
  render: () => <Demo once={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Fade in')).toBeInTheDocument();
  },
};
