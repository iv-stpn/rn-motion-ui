import type { Meta, StoryObj } from '@storybook/react';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ArrowUp } from '../../lib/icons';
import { Text } from '../Text/text';
import { SmoothScroll, useSmoothScroll } from './smooth-scroll';

const SECTIONS = Array.from({ length: 16 }, (_, i) => i + 1);

const meta = {
  title: 'Components/SmoothScroll',
  component: SmoothScroll,
  parameters: { layout: 'centered' },
  args: { children: null },
  argTypes: {
    orientation: { control: 'select', options: ['vertical', 'horizontal'] },
  },
} satisfies Meta<typeof SmoothScroll>;

type Story = StoryObj<typeof meta>;

// Module-level spy: SmoothScroll has no onPress prop, so the play test asserts
// against this directly rather than via story args.
const onScrollTop = fn();

// Uses the useSmoothScroll() hook to glide the container back to the top.
type ScrollTopButtonProps = { onPress?: () => void };

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ScrollTopButton({ onPress }: ScrollTopButtonProps) {
  const { scrollTo } = useSmoothScroll();
  const handlePress = useCallback(() => {
    scrollTo(0);
    onPress?.();
  }, [scrollTo, onPress]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Scroll to top"
      testID="scroll-top"
      onPress={handlePress}
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        width: 36,
        height: 36,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fafafa',
        borderWidth: 1,
        borderColor: '#e5e5e5',
      }}
    >
      <ArrowUp size={16} color="#111111" />
    </Pressable>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Demo() {
  return (
    <View style={{ width: 360, height: 280, borderRadius: 16, borderWidth: 1, borderColor: '#e5e5e5', overflow: 'hidden' }}>
      <SmoothScroll testID="smooth-scroll" contentContainerStyle={{ padding: 12, gap: 10 }}>
        {SECTIONS.map((n) => (
          <View key={n} style={{ borderRadius: 10, backgroundColor: '#f4f4f5', paddingHorizontal: 12, paddingVertical: 16 }}>
            <Text style={{ color: '#71717a', fontSize: 14 }}>{`Section ${n}`}</Text>
          </View>
        ))}
        <ScrollTopButton onPress={onScrollTop} />
      </SmoothScroll>
    </View>
  );
}

export default meta;

export const Contained: Story = {
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByTestId('scroll-top');
    await userEvent.click(button);
    await expect(onScrollTop).toHaveBeenCalled();
  },
};
