import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import motify from '../core/motify';
import type { MotiTransitionProp } from '../core/types';
import useDynamicAnimation from '../core/use-dynamic-animation';

const MotiView = motify(View)();

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden' },
  bar: { width: '100%', height: '100%' },
});

export type MotiProgressBarProps = {
  /** Number between 0–1. @required */
  progress: number;
  /** Height of the bar in pixels. @default 12 */
  height?: number;
  color?: string;
  containerColor?: string;
  /** Container border radius */
  borderRadius?: number;
  containerStyle?: ViewStyle;
  style?: ViewStyle;
  /**
   * Transition config for the animation. See the `transition` docs from
   * `<MotiView />` for available options.
   *
   * @default `{ type: 'timing', duration: 200 }`
   */
  transition?: MotiTransitionProp<ViewStyle>;
  /** @default 'dark' */
  colorMode?: 'dark' | 'light';
  /**
   * @default false
   * When `false`, Moti will warn when re-renders happen too frequently.
   */
  silenceRenderWarnings?: boolean;
};

export function MotiProgressBar({
  height = 12,
  progress = 0,
  borderRadius = height / 2,
  style,
  colorMode = 'dark',
  containerColor = colorMode === 'dark' ? '#333' : '#eee',
  containerStyle,
  color = '#00C806',
  transition = { type: 'timing', duration: 200 },
  silenceRenderWarnings = false,
}: MotiProgressBarProps) {
  const barState = useDynamicAnimation(() => ({ translateX: '-100%' }));

  if (!transition)
    console.error(
      `[moti] <ProgressBar /> "transition" prop must be undefined or a Moti transition object, but received: ${typeof transition}.`,
      transition,
    );

  const transitionString = JSON.stringify(transition);
  const _transition = useMemo<typeof transition>(() => JSON.parse(transitionString), [transitionString]);

  const outerStyle = useMemo(
    () => [styles.container, containerStyle, { height, borderRadius, backgroundColor: containerColor }],
    [borderRadius, containerColor, containerStyle, height],
  );

  const progressStyle = useMemo(
    () => [style, styles.bar, { borderRadius, backgroundColor: color }],
    [borderRadius, color, style],
  );

  // biome-ignore lint/plugin: driving the bar animation in response to progress changes requires an imperative side effect on the animation state
  useEffect(
    function animateOnProgressChange() {
      const percent = Math.round(progress * 100);
      const translateX = `${percent - 100}%`;
      if (barState.current?.translateX !== translateX) barState.animateTo((current) => ({ ...current, translateX }));
    },
    [barState, progress],
  );

  const unnecessaryRerenders = useRef({
    containerStyle: { previousValue: containerStyle, changes: 0 },
    style: { previousValue: style, changes: 0 },
  });

  // biome-ignore lint/plugin: tracking style identity changes for a dev-only warning requires reading previous values as a side effect
  useEffect(
    function checkUnnecessaryRerenders() {
      const isDev = typeof __DEV__ === 'undefined' || __DEV__;
      if (silenceRenderWarnings || !isDev) return;

      if (containerStyle !== unnecessaryRerenders.current.containerStyle.previousValue)
        unnecessaryRerenders.current.containerStyle.changes += 1;
      if (style !== unnecessaryRerenders.current.style.previousValue) unnecessaryRerenders.current.style.changes += 1;

      const warningProps: { changes: number; prop: string }[] = [];
      for (const [prop, { changes }] of Object.entries(unnecessaryRerenders.current)) {
        if (changes > 5) warningProps.push({ prop, changes });
      }

      if (warningProps.length)
        console.warn(
          `[moti] <MotiProgress /> is re-rendering often due to: ${warningProps
            .map((w) => `"${w.prop}: ${w.changes} re-renders"`)
            .join(', ')}. Memoize these props with useMemo or define them outside render.`,
          'Pass silenceRenderWarnings={true} to suppress this warning.',
        );
    },
    [containerStyle, silenceRenderWarnings, style],
  );

  return useMemo(
    () => (
      <View style={outerStyle}>
        <MotiView transition={_transition} state={barState} style={progressStyle} />
      </View>
    ),
    [_transition, barState, outerStyle, progressStyle],
  );
}
