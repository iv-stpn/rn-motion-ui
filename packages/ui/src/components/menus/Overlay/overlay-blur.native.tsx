// biome-ignore-all lint/style/useExportsLast: the component closes the module
/**
 * Native backdrop blur for overlay scrims, backed by
 * `react-native-liquid-glassmorphism`.
 *
 * The scrims (HoldMenu's backdrop and the modal overlays) paint a translucent
 * dim over a blur so the page behind them reads as frosted glass rather than a
 * flat wash. This is the NATIVE twin of `./overlay-blur` — web resolves the
 * plain `.tsx` file (a CSS `backdrop-filter` view) and never imports the
 * optional peer, so a consumer without it still bundles.
 *
 * The peer captures the backdrop as a bitmap from the window root (self-excluding
 * the glass view), so — unlike the old `@danielsaraldi/react-native-blur-view`
 * it replaces — it blurs behind itself on Android with no `BlurTarget`/overlay
 * host. A plain blurred pane is `rim={false} specular={false} thickness={0}` +
 * `blurRadius`, the recipe the scrim below uses; it is a drop-in conventional
 * blur, not liquid glass.
 *
 * Below Android API 31 the peer can only tint (no `RenderEffect` blur), so the
 * scrim degrades to the plain translucent dim: `getGlassCapabilities().supportsBlur`
 * is the gate. iOS blurs on every supported version.
 *
 * Resolution is deliberately ONLY a `require` presence check. It must NOT
 * probe the native side with `requireNativeComponent('LiquidGlassmorphismView')`:
 * the peer is a codegen component whose own module already registered that name
 * in React Native's view-config registry, so a second registration throws
 * "Tried to register two views with the same name" and degrades the scrim
 * exactly when the peer is present and should render (the 7.3.0 Android
 * no-frost regression, fixed 2026-09-04). An unlinked native module surfaces
 * at FIRST RENDER, which `PeerMountGuard` converts into the plain-dim degrade.
 */

import type { ComponentType } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { PeerMountGuard } from '../../../lib/peer-mount-guard';
import { MotiView } from '../../../moti/components/view';

/**
 * The minimal `LiquidGlassView` surface this module touches, plus the capability
 * probe — cast against the dynamic `require` below so no import of the optional
 * peer reaches the type system.
 */
type LiquidGlassProps = {
  variant?: 'regular' | 'clear';
  tintColor?: string;
  rim?: boolean;
  specular?: boolean;
  thickness?: number;
  blurRadius?: number;
  dim?: number;
  style?: unknown;
};
type LiquidGlassComponent = ComponentType<LiquidGlassProps>;
type GlassModule = { LiquidGlassView?: LiquidGlassComponent; getGlassCapabilities?: () => { supportsBlur: boolean } };

/**
 * Resolves the peer's `LiquidGlassView` and blur capability when the optional
 * peer's JS is installed, `null` otherwise — the same guarded-require pattern
 * the Glass primitive uses. A consumer that never installed the native module
 * still builds; the scrim degrades to the plain dim.
 */
function resolveScrimBlur(): { View: LiquidGlassComponent; supportsBlur: boolean } | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    // Optional peer dep — scrim blur; consumers without it get the plain dim.
    // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
    // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
    const mod = require('react-native-liquid-glassmorphism') as GlassModule;
    const View = mod.LiquidGlassView;
    if (!View) return null;
    const supportsBlur = mod.getGlassCapabilities?.().supportsBlur ?? false;
    return { View, supportsBlur };
  } catch {
    return null;
  }
}

const scrimBlur = resolveScrimBlur();

/**
 * The blur layer under an overlay scrim. Absolute-fills its parent, never
 * intercepts touches (it is purely decorative — the scrim above it is the tap
 * target), and renders `null` when the peer is absent or the device cannot blur
 * (Android < API 31). The dim layer beside it still shows, so the overlay reads
 * as a plain translucent wash rather than frosted glass. The wrapper fades its
 * own `opacity` 0→1 on mount (and out on exit) so the frost appears in step with
 * the menu — it mirrors the web twin, which must fade its *own* opacity because
 * a parent opacity fades out the backdrop on CSS.
 *
 * A peer whose JS is present but native module is unlinked throws at first
 * render; `PeerMountGuard` turns that into `null` (the same plain-dim degrade).
 *
 * Internal to the package — not exported.
 */
export function OverlayBlur() {
  if (!scrimBlur?.supportsBlur) return null;
  const { View: LiquidGlassView } = scrimBlur;

  return (
    <MotiView
      pointerEvents="none"
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'timing', duration: 200 }}
      style={StyleSheet.absoluteFill}
    >
      {/* Plain blurred pane — rim/specular/thickness off, so it is a conventional
          blur under the dim sibling, not liquid glass. */}
      <PeerMountGuard fallback={null}>
        <LiquidGlassView rim={false} specular={false} thickness={0} blurRadius={12} style={StyleSheet.absoluteFill} />
      </PeerMountGuard>
    </MotiView>
  );
}
