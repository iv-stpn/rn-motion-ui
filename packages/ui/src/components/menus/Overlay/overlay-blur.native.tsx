// biome-ignore-all lint/style/useExportsLast: the component closes the module
/**
 * Native backdrop blur for overlay scrims, backed by
 * `@danielsaraldi/react-native-blur-view` (the package published from
 * [DanielAraldi/react-native-blur-view](https://github.com/DanielAraldi/react-native-blur-view)):
 *
 * - **iOS** — its `BlurView` is a `UIVisualEffectView` that blurs whatever sits
 *   behind it, so a full-bleed scrim frosts the page with no extra wiring.
 * - **Android** — the same `BlurView` does *not* blur behind itself; it blurs a
 *   `<BlurTarget>` it is pointed at. The `blurTarget` ref comes from an
 *   enclosing `<BlurProvider>` (see `./blur-provider`), whose `BlurTarget`
 *   wraps the app content. Without a provider — or without the optional peer —
 *   the scrim degrades to the plain translucent color, the pre-blur rendering.
 *
 * This is the NATIVE twin of `./overlay-blur` — web resolves the plain `.tsx`
 * file (a CSS `backdrop-filter` view) and never imports the optional peer, so a
 * consumer without it still bundles. The blur comes from the peer's `BlurView`,
 * resolved through a guarded dynamic `require` exactly like `use-safe-insets.ts`
 * resolves `react-native-safe-area-context`; when it cannot run, this renders
 * `null` and the scrim degrades.
 */

import type { ComponentType, RefObject } from 'react';
import { Platform, StyleSheet, type View } from 'react-native';
import { MotiView } from '../../../moti/components/view';
import { useBlurTargetRef } from './blur-context';

/**
 * The minimal `BlurView` surface this module touches — the props read off the
 * optional peer. Cast against the dynamic `require` below so no import of an
 * optional package reaches the type system.
 */
type BlurViewProps = {
  type?: string;
  radius?: number;
  blurTarget?: RefObject<View | null>;
  pointerEvents?: string;
  style?: unknown;
};
type BlurViewComponent = ComponentType<BlurViewProps>;
/** The peer's module namespace — it ships named exports and no default. */
type BlurViewModule = { BlurView?: BlurViewComponent; default?: BlurViewComponent } & BlurViewComponent;

/**
 * Resolves the peer's `BlurView` when the optional peer is installed, `null`
 * otherwise — see the module doc for why it is a guarded require rather than an
 * import.
 */
function resolveBlurView(): BlurViewComponent | null {
  try {
    // Optional peer dep — scrim blur; consumers without it get the plain translucent scrim.
    // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
    // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
    const mod = require('@danielsaraldi/react-native-blur-view') as BlurViewModule;
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
 * On Android the `blurTarget` ref (from an enclosing `<BlurProvider>`) points
 * the `BlurView` at the content to frost; on iOS the prop is ignored (the
 * `UIVisualEffectView` blurs behind itself). The wrapper fades its own `opacity`
 * 0→1 on mount (and out on exit) so the frost appears in step with the menu —
 * it mirrors the web twin, which must fade its *own* opacity because a parent
 * opacity fades out the backdrop on CSS.
 *
 * ## `inline` — Android scrims that sit INSIDE their own blur target
 *
 * Pass `inline` when this blur view renders inline within the very `BlurTarget`
 * it is pointed at (the MorphingFAB/Switcher outside-press backdrops). On
 * Android a `BlurView` that is a *descendant* of its own target is a native
 * crash: the peer's `RenderNodeBlurController` records the target's `RenderNode`
 * into its own blur node, and because the target contains the blur view the
 * RenderNode graph cycles — HWUI's `RenderNode::prepareTreeImpl` recurses until
 * the RenderThread stack overflows (SIGSEGV). So an `inline` blur degrades to
 * `null` (the dim still shows). HoldMenu's backdrop is NOT inline: it renders
 * through the `BlurProvider`'s overlay host OUTSIDE the target (see
 * `./overlay-host`), so it blurs the page without the cycle and without
 * frosting the menu. iOS (`UIVisualEffectView`) and web (CSS `backdrop-filter`)
 * blur behind themselves and are unaffected.
 *
 * Internal to the package — not exported.
 */
type OverlayBlurProps = { inline?: boolean };

export function OverlayBlur({ inline = false }: OverlayBlurProps) {
  const blurTargetRef = useBlurTargetRef();
  if (!BlurView) return null;

  // An inline scrim inside the target it blurs would cycle the RenderNode graph
  // on Android — degrade to the plain dim rather than crash.
  if (inline && Platform.OS === 'android') return null;

  return (
    <MotiView
      pointerEvents="none"
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'timing', duration: 200 }}
      style={StyleSheet.absoluteFill}
    >
      <BlurView
        type="light"
        radius={12}
        blurTarget={blurTargetRef ?? undefined}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
    </MotiView>
  );
}
