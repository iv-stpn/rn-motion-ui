// biome-ignore-all lint/style/useExportsLast: the component closes the module
/**
 * Native backdrop blur for overlay scrims, backed by
 * `@sbaiahmed1/react-native-blur`.
 *
 * This is the NATIVE twin of `./overlay-blur` — web resolves the plain `.tsx`
 * file (a CSS `backdrop-filter` view) and never imports the optional peer, so
 * a consumer without it still bundles. The blur comes from the package's
 * `BlurView`, which resolves per platform through the package's own `exports`:
 * the native module (iOS `UIVisualEffectView`) on device. Android is excluded
 * — its `QmBlurView` is not performant enough to run under a full-bleed
 * scrim — and degrades to the plain translucent color, the same fallback as a
 * missing peer.
 *
 * `@sbaiahmed1/react-native-blur` is an optional peer dependency, loaded with a
 * guarded dynamic `require` exactly like `use-safe-insets.ts` resolves
 * `react-native-safe-area-context`. When the package is missing (or the
 * `require` cannot run) this renders `null` and the scrim degrades to the plain
 * translucent color — the pre-blur rendering.
 */

import type { ComponentType } from 'react';
import { Platform, StyleSheet } from 'react-native';

/**
 * Android's native blur is disabled (see {@link resolveBlurView}); the scrim
 * there degrades to the plain translucent color, the same as a missing peer.
 */
const IS_ANDROID = Platform.OS === 'android';

/**
 * The minimal `@sbaiahmed1/react-native-blur` surface this module touches. Cast
 * against the dynamic `require` below so no import of the optional package
 * reaches the type system — the module resolves to whatever the package ships,
 * with only these props read off it.
 */
type BlurViewProps = { blurType?: string; blurAmount?: number; pointerEvents?: string; style?: unknown };
type BlurViewComponent = ComponentType<BlurViewProps>;

/**
 * Resolves the package's `BlurView` when the optional peer is installed, `null`
 * otherwise — see the module doc for why it is a guarded require rather than an
 * import.
 */
function resolveBlurView(): BlurViewComponent | null {
  // Android's `QmBlurView` is not performant enough to run under a full-bleed
  // overlay scrim, so it is disabled there — the scrim falls back to the plain
  // translucent color, exactly as it does when the peer is absent.
  if (IS_ANDROID) return null;
  try {
    // Optional peer dep — scrim blur; consumers without it get the plain translucent scrim.
    // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
    // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
    const mod = require('@sbaiahmed1/react-native-blur') as {
      BlurView?: BlurViewComponent;
      default?: BlurViewComponent;
    } & BlurViewComponent;
    // The package re-exports `BlurView` as both a named and a default export.
    // Metro's `require` returns the namespace (`mod.BlurView`); Vite's CJS
    // interop collapses `require` of an ESM module to its `default` export — the
    // component itself, which `React.memo` returns as an object rather than a
    // function (so a `typeof mod === 'function'` check would miss it). Accept all
    // three shapes: the named export, the default, or the module itself.
    return mod.BlurView ?? mod.default ?? mod;
  } catch {
    return null;
  }
}

const BlurView = resolveBlurView();

/**
 * The blur layer under an overlay scrim. Absolute-fills its parent, never
 * intercepts touches (it is purely decorative — the scrim above it is the tap
 * target), and renders `null` when the optional peer is absent or on Android,
 * where the native blur is disabled.
 *
 * Internal to the package — not exported.
 */
export function OverlayBlur() {
  if (!BlurView) return null;
  return <BlurView blurAmount={30} blurType="light" pointerEvents="none" style={StyleSheet.absoluteFill} />;
}
