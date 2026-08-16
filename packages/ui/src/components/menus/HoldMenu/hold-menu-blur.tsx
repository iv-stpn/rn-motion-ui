import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';

export type HoldMenuBlurProps = {
  children?: ReactNode;
  /** The same style union an animated view accepts — plain styles or animated style handles. */
  style?: AnimatedProps<ViewProps>['style'];
  /**
   * Animated blur props (`intensity`, `tint`) for the iOS `BlurView`. Ignored
   * here — web renders a plain view, and `expo-blur` never enters the bundle.
   */
  animatedProps?: unknown;
  /** Web-only click handler (RNW forwards it on View) — the backdrop's close. */
  onClick?: () => void;
  testID?: string;
};

/**
 * Web twin of the HoldMenu blur layer.
 *
 * Upstream wraps an expo-blur `BlurView` in `createAnimatedComponent` for the
 * panel and the backdrop. `expo-blur` is a native module; this twin renders a
 * plain `Animated.View` so the extensionless import (`./hold-menu-blur`)
 * resolves to it on web and `expo-blur` never reaches a web bundle. Native
 * consumers get the real thing from `hold-menu-blur.native.tsx`.
 */
export function HoldMenuBlur({ children, style, onClick, testID }: HoldMenuBlurProps) {
  // RNW forwards onClick on View but RN's core types do not declare it — the
  // cast keeps the web-only prop off the native type (same pattern as HoldItem).
  // biome-ignore lint/plugin: RNW View accepts onClick at runtime
  const webProps = (onClick ? { onClick } : {}) as Record<string, unknown>;
  return (
    <Animated.View style={style} testID={testID} {...webProps}>
      {children}
    </Animated.View>
  );
}
