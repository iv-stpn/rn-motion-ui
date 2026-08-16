import type { ReactNode } from 'react';
import type { ViewProps, ViewStyle } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';

// RNW's prefixStyles maps `backdropFilter` (with the -webkit- prefix) at
// runtime, but RN core's `ViewStyle` does not declare it — the web-only style
// is cast, same pattern as HoverMenu's `WEB_PANEL_POSITION`. A static blur is
// enough: the container opacity animation already fades the whole layer.
// biome-ignore lint/plugin: RNW passes backdropFilter through prefixStyles, but RN's ViewStyle lacks it, so the web-only style is cast
const WEB_BLUR_STYLE = { backdropFilter: 'blur(20px)' } as unknown as ViewStyle;

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
 *
 * The static CSS `backdrop-filter` frosts what is behind the layer, matching
 * upstream's BlurView. Upstream animates the BlurView `intensity` 0↔100; on
 * web the container opacity animation already fades the whole layer, so a
 * static blur is correct. `backdrop-filter` is not in RN core's `ViewStyle`,
 * but react-native-web 0.21 passes it through (`prefixStyles` maps it), so
 * the web-only style is cast.
 */
export function HoldMenuBlur({ children, style, onClick, testID }: HoldMenuBlurProps) {
  // RNW forwards onClick on View but RN's core types do not declare it — the
  // cast keeps the web-only prop off the native type (same pattern as HoldItem).
  // biome-ignore lint/plugin: RNW View accepts onClick at runtime
  const webProps = (onClick ? { onClick } : {}) as Record<string, unknown>;
  return (
    <Animated.View style={[style, WEB_BLUR_STYLE]} testID={testID} {...webProps}>
      {children}
    </Animated.View>
  );
}
