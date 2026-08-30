// biome-ignore-all lint/style/useExportsLast: the component closes the module
/**
 * Native backdrop blur for overlay scrims, backed by a per-platform native
 * `BlurView`:
 *
 * - **iOS** — `@sbaiahmed1/react-native-blur` (a `UIVisualEffectView` wrapper).
 * - **Android** — `@react-native-community/blur` (the
 *   [Dimezis `BlurView`](https://github.com/Dimezis/BlurView), blurred on the
 *   system Render Thread on API 31+ and RenderScript before that).
 *
 * This is the NATIVE twin of `./overlay-blur` — web resolves the plain `.tsx`
 * file (a CSS `backdrop-filter` view) and never imports either optional peer,
 * so a consumer without them still bundles. The blur comes from each package's
 * `BlurView`, resolved per platform through the package's own `exports`: the
 * native module (iOS `UIVisualEffectView`) on iOS, the Dimezis `BlurView` on
 * Android. Android deliberately does NOT use `@sbaiahmed1`'s Android
 * implementation — its `QmBlurView` is not performant enough to run under a
 * full-bleed scrim — and swaps to `@react-native-community/blur` instead.
 *
 * Both packages are optional peer dependencies, loaded with a guarded dynamic
 * `require` exactly like `use-safe-insets.ts` resolves
 * `react-native-safe-area-context`. When the platform's package is missing (or
 * the `require` cannot run) this renders `null` and the scrim degrades to the
 * plain translucent color — the pre-blur rendering.
 */

import type { ComponentType } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { MotiView } from '../../../moti/components/view';

/**
 * Android swaps the iOS peer for `@react-native-community/blur` (see
 * {@link resolveBlurView}); the scrim there degrades to the plain translucent
 * color when that peer is absent, the same as a missing iOS peer.
 */
const IS_ANDROID = Platform.OS === 'android';

/**
 * The minimal `BlurView` surface this module touches — the union of the props
 * read off both optional peers. Cast against the dynamic `require` below so no
 * import of an optional package reaches the type system — the module resolves
 * to whatever the package ships, with only these props read off it.
 */
type BlurViewProps = { blurType?: string; blurAmount?: number; pointerEvents?: string; style?: unknown };
type BlurViewComponent = ComponentType<BlurViewProps>;
/** A blur package's module namespace — the named and default exports it may carry. */
type BlurViewModule = { BlurView?: BlurViewComponent; default?: BlurViewComponent } & BlurViewComponent;

/**
 * Resolves the platform's `BlurView` when its optional peer is installed, `null`
 * otherwise — see the module doc for why it is a guarded require rather than an
 * import.
 */
function resolveBlurView(): BlurViewComponent | null {
  // iOS keeps `@sbaiahmed1/react-native-blur` (native `UIVisualEffectView`); Android uses
  // `@react-native-community/blur`, whose Dimezis `BlurView` is fast enough for a full-bleed
  // scrim where `@sbaiahmed1`'s Android `QmBlurView` is not.
  if (IS_ANDROID) {
    try {
      // Optional peer dep — scrim blur; consumers without it get the plain translucent scrim.
      // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
      // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
      const mod = require('@react-native-community/blur') as BlurViewModule;
      return mod.BlurView ?? mod.default ?? mod;
    } catch {
      return null;
    }
  }
  try {
    // Optional peer dep — scrim blur; consumers without it get the plain translucent scrim.
    // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
    // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
    const mod = require('@sbaiahmed1/react-native-blur') as BlurViewModule;
    return mod.BlurView ?? mod.default ?? mod;
  } catch {
    return null;
  }
}

const BlurView = resolveBlurView();

/**
 * The blur layer under an overlay scrim. Absolute-fills its parent, never
 * intercepts touches (it is purely decorative — the scrim above it is the tap
 * target), and renders `null` when the platform's optional peer is absent.
 *
 * The wrapper fades its own `opacity` 0→1 on mount (and out on exit) so the
 * frost appears in step with the menu. It mirrors the web twin, which must fade
 * its *own* opacity because a parent opacity fades out the backdrop on CSS.
 *
 * Internal to the package — not exported.
 */
export function OverlayBlur() {
  if (!BlurView) return null;
  return (
    <MotiView
      pointerEvents="none"
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'timing', duration: 200 }}
      style={StyleSheet.absoluteFill}
    >
      <BlurView blurAmount={12} blurType="light" pointerEvents="none" style={StyleSheet.absoluteFill} />
    </MotiView>
  );
}
