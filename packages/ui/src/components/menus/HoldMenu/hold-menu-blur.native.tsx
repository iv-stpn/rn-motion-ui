/**
 * Native half of the HoldMenu blur layer.
 *
 * iOS renders expo-blur's `BlurView` — wrapped in `createAnimatedComponent` so
 * the panel and backdrop can animate its `intensity` through `animatedProps`,
 * exactly as upstream does — with the colored overlay painted above it.
 * Android renders a plain `Animated.View` (upstream gives Android the plain
 * dim; this package keeps that).
 *
 * `expo-blur` is an optional peer dependency, loaded with a guarded dynamic
 * `require` exactly like `hold-menu-haptics.native.ts` treats `expo-haptics`.
 * When the package is missing (or the `require` cannot run), this renders the
 * plain view and the surfaces degrade to their translucent colors — the
 * pre-blur rendering.
 *
 * The module is a platform split, imported extensionless (`./hold-menu-blur`):
 * Metro resolves the `.native` file on iOS/Android and the no-op web twin
 * (`hold-menu-blur.tsx`) on web, so `expo-blur` never enters a web bundle.
 * `expo-blur` itself is never a static import anywhere — the only reference is
 * the guarded `require` below.
 */

import type { ReactNode } from 'react';
import { Platform, type ViewProps } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';

/**
 * The minimal `expo-blur` surface this module touches. Cast against the
 * dynamic `require` below so no import of the optional package reaches the
 * type system — the module resolves to whatever `expo-blur` actually ships,
 * with only these props read off it.
 */
type BlurViewProps = { intensity?: number; tint?: string; style?: unknown; children?: ReactNode; testID?: string };

/**
 * Resolves expo-blur's `BlurView` when the optional peer is installed,
 * `null` otherwise — see the module doc for why it is a guarded require
 * rather than an import.
 */
function resolveBlurView(): ((props: BlurViewProps) => ReactNode) | null {
  try {
    // Optional peer dep — iOS-only blur; consumers without expo-blur get the plain translucent surface.
    // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
    // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
    const mod = require('expo-blur') as { BlurView: (props: BlurViewProps) => ReactNode };
    return mod.BlurView;
  } catch {
    return null;
  }
}

const BlurView = resolveBlurView();
const AnimatedBlurView = BlurView ? Animated.createAnimatedComponent(BlurView) : null;

export type HoldMenuBlurProps = {
  children?: ReactNode;
  /** The same style union an animated view accepts — plain styles or animated style handles. */
  style?: AnimatedProps<ViewProps>['style'];
  /** Animated blur props for the iOS `BlurView` — `intensity`, `tint`. */
  animatedProps?: { intensity?: number; tint?: string };
  /** Web-only click handler — native closes through the RNGH `Gesture.Tap` instead. */
  onClick?: () => void;
  testID?: string;
};

/**
 * The blur layer behind the panel and the backdrop. iOS renders expo-blur's
 * `BlurView` with the animated props; everything else renders a plain view.
 *
 * Internal to `HoldMenu` — not exported from the package.
 */
export function HoldMenuBlur({ children, style, animatedProps, testID }: HoldMenuBlurProps) {
  if (Platform.OS === 'ios' && AnimatedBlurView)
    return (
      <AnimatedBlurView animatedProps={animatedProps} style={style} testID={testID}>
        {children}
      </AnimatedBlurView>
    );
  return (
    <Animated.View style={style} testID={testID}>
      {children}
    </Animated.View>
  );
}
