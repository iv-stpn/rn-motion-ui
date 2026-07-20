import type { Meta, StoryObj } from '@storybook/react';
import { useCallback } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, Text, View } from 'react-native';
import { makeMutable, useSharedValue } from 'react-native-reanimated';
import { expect, within } from 'storybook/test';
import { ScrollProgress } from './scroll-progress';

const ROWS = Array.from({ length: 18 }, (_, i) => i + 1);

const meta = {
  title: 'Components/ScrollProgress',
  component: ScrollProgress,
  parameters: { layout: 'centered' },
  // Render-only stories build their own scroll-driven demo; this satisfies the
  // required `progress` shared value at the type level.
  args: { progress: makeMutable(0) },
} satisfies Meta<typeof ScrollProgress>;

type Story = StoryObj<typeof meta>;

// A self-contained demo: an internal ScrollView drives the shared progress value
// that both the bar and circle read.
type DemoProps = { variant: 'bar' | 'circle' };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Demo({ variant }: DemoProps) {
  const progress = useSharedValue(0);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentSize, layoutMeasurement, contentOffset } = e.nativeEvent;
      const max = contentSize.height - layoutMeasurement.height;
      // Writing a shared value from the JS thread is valid on web (no worklet
      // needed); the component reads it via useDerivedValue/useAnimatedProps.
      progress.value = max > 0 ? contentOffset.y / max : 0;
    },
    [progress],
  );

  return (
    <View
      testID="scroll-progress-demo"
      style={{ width: 340, height: 260, borderRadius: 16, borderWidth: 1, borderColor: '#e5e5e5', overflow: 'hidden' }}
    >
      {variant === 'bar' ? (
        <ScrollProgress progress={progress} height={3} testID="bar" />
      ) : (
        <View style={{ position: 'absolute', right: 12, top: 12, zIndex: 10 }}>
          <ScrollProgress variant="circle" progress={progress} size={36} testID="circle" />
        </View>
      )}
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ padding: 12, gap: 10 }}>
        {ROWS.map((n) => (
          <View key={n} style={{ borderRadius: 10, backgroundColor: '#f4f4f5', paddingHorizontal: 12, paddingVertical: 16 }}>
            <Text style={{ color: '#71717a', fontSize: 14 }}>{`Section ${n}`}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default meta;

export const Bar: Story = {
  render: () => <Demo variant="bar" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('bar')).toBeInTheDocument();
  },
};

export const CircleVariant: Story = {
  render: () => <Demo variant="circle" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('circle')).toBeInTheDocument();
  },
};
