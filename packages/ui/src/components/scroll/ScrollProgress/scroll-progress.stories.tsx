import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useCallback, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, View } from 'react-native';
import { makeMutable, type SharedValue, useSharedValue } from 'react-native-reanimated';
import { expect, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Playground, Sample, Section, Toggle, Variants } from '../../../__stories__/story-harness';
import { useThemeColors } from '../../../theme/use-theme-color';
import { Text } from '../../typography/Text/text';
import { ScrollProgress } from './scroll-progress';

const ROWS = Array.from({ length: 18 }, (_, i) => i + 1);
const BOX_W = 340;
const BOX_H = 260;
const SMALL_BOX_W = 200;

const meta = {
  title: 'Scroll/ScrollProgress',
  component: ScrollProgress,
  parameters: { layout: 'centered' },
  // Render-only stories build their own scroll-driven demo; this satisfies the
  // required `progress` shared value at the type level.
  args: { progress: makeMutable(0) },
} satisfies Meta<typeof ScrollProgress>;

type Story = StoryObj<typeof meta>;

const THICKNESSES = [
  { value: '2', label: 'hairline' },
  { value: '3', label: '3px' },
  { value: '8', label: 'chunky' },
] as const;
const DIAMETERS = [
  { value: '28', label: '28px' },
  { value: '36', label: '36px' },
  { value: '52', label: '52px' },
] as const;

type ThicknessKey = (typeof THICKNESSES)[number]['value'];
type DiameterKey = (typeof DIAMETERS)[number]['value'];

type ScrollBoxProps = { children: (progress: SharedValue<number>) => ReactNode; width?: number; height?: number };

const SCROLL_BOX_TESTID = 'scroll-box-scroller';

/**
 * Scrollable frame that owns the shared progress value and hands it to its
 * children — the indicator has no scroll awareness of its own, it only reads a
 * 0→1 value someone else drives.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ScrollBox({ children, width = BOX_W, height = BOX_H }: ScrollBoxProps) {
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
    <View className="overflow-hidden rounded-2xl border border-border" style={{ width, height }}>
      {children(progress)}
      <ScrollView
        contentContainerStyle={{ padding: 12, gap: 10 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        testID={SCROLL_BOX_TESTID}
      >
        {ROWS.map((n) => (
          <View className="rounded-lg bg-surface-3 px-3 py-4" key={n}>
            <Text className="text-muted-foreground" size="sm">{`Section ${n}`}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function ScrollProgressPlayground() {
  const [circle, setCircle] = useState(false);
  const [spring, setSpring] = useState(true);
  const [tinted, setTinted] = useState(false);
  const [thicknessKey, setThicknessKey] = useState<ThicknessKey>('3');
  const [diameterKey, setDiameterKey] = useState<DiameterKey>('36');
  const colors = useThemeColors();
  const color = tinted ? colors.primary : undefined;

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Bar height" onChange={setThicknessKey} options={THICKNESSES} value={thicknessKey} />
        <Choice label="Circle size" onChange={setDiameterKey} options={DIAMETERS} value={diameterKey} />
        <Toggle label="Circle" onChange={setCircle} value={circle} />
        <Toggle label="Spring" onChange={setSpring} value={spring} />
        <Toggle label="Tinted" onChange={setTinted} value={tinted} />
      </ControlCard>

      {/* With spring off the indicator tracks the offset exactly; with it on the
          value chases the scroll and settles a beat behind. */}
      <ScrollBox>
        {(progress) =>
          circle ? (
            <View className="absolute top-[12px] right-[12px] z-10">
              <ScrollProgress
                color={color}
                progress={progress}
                size={Number(diameterKey)}
                spring={spring}
                testID="playground-circle"
                variant="circle"
              />
            </View>
          ) : (
            <ScrollProgress
              color={color}
              height={Number(thicknessKey)}
              progress={progress}
              spring={spring}
              testID="playground-bar"
            />
          )
        }
      </ScrollBox>

      {/* Both variants read the same kind of value — only the painting differs. */}
      <Section title="Variants">
        <Variants>
          <Sample label="bar (pinned to the top edge)">
            <ScrollBox height={180} width={SMALL_BOX_W}>
              {(progress) => <ScrollProgress height={3} progress={progress} />}
            </ScrollBox>
          </Sample>
          <Sample label="circle (free-floating)">
            <ScrollBox height={180} width={SMALL_BOX_W}>
              {(progress) => (
                <View className="absolute top-[10px] right-[10px] z-10">
                  <ScrollProgress progress={progress} size={36} variant="circle" />
                </View>
              )}
            </ScrollBox>
          </Sample>
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** One indicator over a live scroll area, switchable between the bar and circle
 *  variants, plus both side by side. Scroll a box to drive its value. */
export const Interactive: Story = { render: () => <ScrollProgressPlayground /> };

export const Bar: Story = {
  name: 'Demo: Tracks the scroll offset',
  render: () => (
    <ScrollBox>
      {(progress) => (
        <>
          <ScrollProgress height={3} progress={progress} testID="bar" />
          <View className="absolute top-[12px] right-[12px] z-10">
            <ScrollProgress progress={progress} size={36} testID="circle" variant="circle" />
          </View>
        </>
      )}
    </ScrollBox>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Both variants mount against the same shared value.
    await expect(await canvas.findByTestId('bar')).toBeInTheDocument();
    await expect(await canvas.findByTestId('circle')).toBeInTheDocument();

    // Both are progressbars, not anonymous boxes — and the arc inside the
    // circle stays out of the tree so it isn't announced as a second thing.
    const bars = await canvas.findAllByRole('progressbar');
    expect(bars.length).toBe(2);
    for (const bar of bars) expect(bar).toHaveAttribute('aria-label', 'Scroll progress');
  },
};

/**
 * The indicator is driven entirely on the UI thread, but `accessibilityValue`
 * is a render-time prop — so the percentage has to be mirrored back to JS or a
 * screen reader is told the progress never moves. That mirror is quantised to
 * whole 5% steps to keep it from re-rendering every frame, which makes it easy
 * to break in the direction that fails silently: still a progressbar, still
 * labelled, permanently reading 0%.
 */
export const ReportsItsValue: Story = {
  name: 'Demo: Announces the percentage',
  render: () => <ScrollBox>{(progress) => <ScrollProgress height={4} progress={progress} testID="reporting-bar" />}</ScrollBox>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bar = await canvas.findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '0');

    // Scroll the box and the reported value has to follow.
    const scroller = await canvas.findByTestId(SCROLL_BOX_TESTID);
    scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }));

    await waitFor(() => expect(Number(bar.getAttribute('aria-valuenow'))).toBeGreaterThan(0), { timeout: 3000 });
  },
};
