// biome-ignore-all lint/style/useExportsLast: the component closes the module
/**
 * iOS backdrop blur for the hold-menu scrim, backed by expo-blur when it is
 * installed.
 *
 * Upstream react-native-hold-menu dims the page behind its menu with an
 * expo-blur `BlurView` — iOS only, at an intensity animated 0→100, with a
 * translucent dark overlay above it. This is the same split, minus the
 * animation: the scrim's own `MotiView` opacity fade drives the visual
 * fade-in, so the `BlurView` sits at a fixed intensity (`100`, upstream's
 * destination) and the scrim's `bg-black/35` `Pressable` is the dark overlay
 * painted above the blur.
 *
 * `expo-blur` is an optional peer dependency, loaded with a guarded dynamic
 * `require` exactly like `use-safe-insets.ts` resolves
 * `react-native-safe-area-context`. When the package is missing (or the
 * `require` cannot run), this renders `null` and the scrim degrades to the
 * plain translucent color — the pre-blur rendering.
 *
 * Android renders `null` by design: upstream gives Android the plain scrim,
 * and this package keeps that (Android's `bg-black/35` is the whole scrim).
 *
 * The module is a platform split, imported extensionless (`./hold-scrim-blur`):
 * Metro resolves the `.native` file on iOS/Android and the no-op web twin
 * (`hold-scrim-blur.tsx`) on web, so `expo-blur` never enters a web bundle.
 * `expo-blur` itself is never a static import anywhere — the only reference is
 * the guarded `require` below. Native consumers need `expo-blur` installed for
 * the bundle to resolve (like upstream, which depends on it outright); the
 * guard is belt-and-braces, matching how `use-safe-insets.ts` treats its
 * optional peer.
 */

import type { ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';

/**
 * The minimal `expo-blur` surface this module touches. Cast against the
 * dynamic `require` below so no import of the optional package reaches the
 * type system — the module resolves to whatever `expo-blur` actually ships,
 * with only these props read off it.
 */
type BlurViewProps = { intensity?: number; style?: unknown; tint?: string };

/**
 * Resolves expo-blur's `BlurView` when the optional peer is installed,
 * `null` otherwise — see the module doc for why it is a guarded require
 * rather than an import.
 */
function resolveBlurView(): ((props: BlurViewProps) => ReactNode) | null {
  try {
    // Optional peer dep — iOS-only scrim blur; consumers without expo-blur get the plain translucent scrim.
    // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
    // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
    const mod = require('expo-blur') as { BlurView: (props: BlurViewProps) => ReactNode };
    return mod.BlurView;
  } catch {
    return null;
  }
}

const BlurView = resolveBlurView();

/**
 * The scrim's blur layer. iOS renders expo-blur's `BlurView` absolute-fill at
 * full intensity; everything else renders nothing.
 *
 * Internal to `HoldContextMenu` — not exported from the package.
 */
export function HoldScrimBlur() {
  if (Platform.OS !== 'ios' || !BlurView) return null;
  return <BlurView intensity={100} style={StyleSheet.absoluteFill} tint="default" />;
}
