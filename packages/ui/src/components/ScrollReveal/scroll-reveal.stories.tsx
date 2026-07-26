import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, View } from 'react-native';
import { makeMutable, useSharedValue } from 'react-native-reanimated';
import { expect, within } from 'storybook/test';
import { Choice, Controls, Note, Playground, Toggle } from '../../__stories__/story-harness';
import { Text } from '../Text/text';
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

const SLIDES = [
  { value: '0', label: 'fade only' },
  { value: '16', label: '16px' },
  { value: '48', label: '48px' },
] as const;
const AMOUNTS = [
  { value: '0.1', label: 'late (10%)' },
  { value: '0.3', label: '30%' },
  { value: '0.7', label: 'early (70%)' },
] as const;
const SCRUB_NOTE = 'Reveal is scrubbed from the scroll offset — drag slowly to hold a card mid-reveal.';

type SlideKey = (typeof SLIDES)[number]['value'];
type AmountKey = (typeof AMOUNTS)[number]['value'];

type DemoProps = { once: boolean; y?: number; amount?: number };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Demo({ once, y, amount }: DemoProps) {
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
      className="overflow-hidden rounded-2xl border border-border"
      style={{ width: 360, height: VIEWPORT }}
      testID="scroll-reveal-demo"
    >
      <ScrollView contentContainerStyle={{ padding: 24, gap: 48 }} onScroll={onScroll} scrollEventThrottle={16}>
        <Text className="text-muted-foreground" style={{ textAlign: 'center', fontSize: 14 }}>
          {SCROLL_HINT}
        </Text>
        {CARDS.map((label) => (
          <ScrollReveal
            amount={amount}
            key={label}
            once={once}
            scrollY={scrollY}
            testID={`reveal-${label}`}
            viewportHeight={VIEWPORT}
            y={y}
          >
            <View className="rounded-xl border border-border bg-surface-3 px-4 py-12">
              <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: '500' }}>{label}</Text>
            </View>
          </ScrollReveal>
        ))}
        <Text className="text-muted-foreground" style={{ textAlign: 'center', fontSize: 14 }}>
          {END_HINT}
        </Text>
      </ScrollView>
    </View>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ScrollRevealPlayground() {
  const [slideKey, setSlideKey] = useState<SlideKey>('16');
  const [amountKey, setAmountKey] = useState<AmountKey>('0.3');
  const [everyTime, setEveryTime] = useState(false);

  return (
    <Playground>
      <Controls>
        <Choice label="Slide distance" onChange={setSlideKey} options={SLIDES} value={slideKey} />
        <Choice label="Revealed at" onChange={setAmountKey} options={AMOUNTS} value={amountKey} />
        <Toggle label="Reveal every time" onChange={setEveryTime} value={everyTime} />
      </Controls>

      {/* `once` latches the highest progress reached, so scrolling back up leaves
          the cards revealed. Turning it off lets them fade out again. The key
          remounts the box so a control change starts from an unrevealed state. */}
      <Demo amount={Number(amountKey)} key={`${slideKey}-${amountKey}-${everyTime}`} once={!everyTime} y={Number(slideKey)} />
      <Note>{SCRUB_NOTE}</Note>
    </Playground>
  );
}

export default meta;

/** Slide distance, reveal threshold, and the latch. RN fallback: the web original
 *  used IntersectionObserver plus a CSS `blur()` — here reveal is interpolated
 *  from the parent scroll offset and the enter-blur is dropped. */
export const Interactive: Story = { render: () => <ScrollRevealPlayground /> };

export const Default: Story = {
  name: 'Demo: Reveals on scroll',
  render: () => <Demo once={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('reveal-Spring slide')).toBeInTheDocument();
  },
};
