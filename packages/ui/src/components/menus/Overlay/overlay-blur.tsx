// biome-ignore-all lint/style/useExportsLast: the component closes the module
/**
 * Backdrop blur for overlay scrims, backed by `@sbaiahmed1/react-native-blur`.
 *
 * The scrims (HoldMenu's backdrop and the modal overlays) paint a translucent
 * dim over a blur so the page behind them reads as frosted glass rather than a
 * flat wash. The blur comes from the package's `BlurView`, which resolves per
 * platform through the package's own `exports`: the native module (iOS
 * `UIVisualEffectView` / Android `QmBlurView`) on device, and a CSS
 * `backdrop-filter` implementation in the browser. A single call site therefore
 * covers both — no platform split here.
 *
 * `@sbaiahmed1/react-native-blur` is an optional peer dependency, loaded with a
 * guarded dynamic `require` exactly like `use-safe-insets.ts` resolves
 * `react-native-safe-area-context`. When the package is missing (or the
 * `require` cannot run) this renders `null` and the scrim degrades to the plain
 * translucent color — the pre-blur rendering.
 */

import type { ComponentType } from 'react';
import { StyleSheet } from 'react-native';

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
 * target), and renders `null` when the optional peer is absent.
 *
 * Internal to the package — not exported.
 */
export function OverlayBlur() {
  if (!BlurView) return null;
  return <BlurView blurAmount={30} blurType="light" pointerEvents="none" style={StyleSheet.absoluteFill} />;
}
