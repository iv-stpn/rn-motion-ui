/**
 * Native half of the HoldMenu blur layer.
 *
 * iOS and Android render expo-blur's `BlurView` — wrapped in
 * `createAnimatedComponent` so the panel can animate its `tint` through
 * `animatedProps` — with the colored overlay painted above it. expo-blur
 * supports Android; upstream's iOS-only gate is a platform restriction this
 * port lifts.
 *
 * `expo-blur` is a hard dependency of the package, so it is a static import
 * here and never enters a web bundle: this module is a platform split, imported
 * extensionless (`./hold-menu-blur`), so Metro resolves the `.native` file on
 * iOS/Android and the no-op web twin (`hold-menu-blur.tsx`) on web.
 *
 * The blur `intensity` is a static prop, never animated: animating it per frame
 * makes expo-blur recompute the blur every frame, which janks on device. The
 * backdrop/panel fade in through their container `opacity` instead (the blur
 * and the dim come up together either way), exactly how the panel already
 * behaved.
 */

import { type BlurTint, BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export type HoldMenuBlurProps = {
  children?: ReactNode;
  /** The same style union an animated view accepts — plain styles or animated style handles. */
  style?: AnimatedProps<ViewProps>['style'];
  /** Static blur strength (0–100). Deliberately not animated — see the module doc. */
  intensity?: number;
  /** Animated blur props — the theme `tint` (light/dark) is the only animated field. */
  animatedProps?: { tint?: BlurTint };
  /** Web-only click handler — native closes through the RNGH `Gesture.Tap` instead. */
  onClick?: () => void;
  testID?: string;
};

/**
 * The blur layer behind the panel and the backdrop. iOS and Android render
 * expo-blur's `BlurView` with a static intensity and the animated `tint`.
 *
 * Internal to `HoldMenu` — not exported from the package.
 */
export function HoldMenuBlur({ children, style, intensity = 100, animatedProps, testID }: HoldMenuBlurProps) {
  return (
    <AnimatedBlurView intensity={intensity} animatedProps={animatedProps} style={style} testID={testID}>
      {children}
    </AnimatedBlurView>
  );
}
