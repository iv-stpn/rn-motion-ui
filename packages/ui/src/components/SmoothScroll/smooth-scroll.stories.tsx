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
      className="absolute right-3 bottom-3 h-9 w-9 items-center justify-center rounded-full border border-[#e5e5e5] bg-[#fafafa]"
    >
      <ArrowUp size={16} color="#111111" />
    </Pressable>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function Demo() {
  return (
    <View className="h-[280px] w-[360px] overflow-hidden rounded-2xl border border-[#e5e5e5]">
      <SmoothScroll testID="smooth-scroll" contentContainerStyle={{ padding: 12, gap: 10 }}>
        {SECTIONS.map((n) => (
          <View key={n} className="rounded-[10px] bg-[#f4f4f5] px-3 py-4">
            <Text className="text-[#71717a] text-[14px]">{`Section ${n}`}</Text>
          </View>
        ))}
        <ScrollTopButton onPress={onScrollTop} />
      </SmoothScroll>
    </View>
  );
}

export default meta;

export const Interactive: Story = {
  render: () => <Demo />,
};

export const Contained: Story = {
  name: 'Demo: Scroll to top',
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByTestId('scroll-top');
    await userEvent.click(button);
    await expect(onScrollTop).toHaveBeenCalled();
  },
};
