import type { ComponentType, ReactNode, Ref } from 'react';
import { Platform, requireNativeComponent, StyleSheet, View, type ViewProps } from 'react-native';
import { useThemeColor } from '../../../theme/use-theme-color';

/**
 * The minimal `LiquidGlassView` surface this module touches — cast against the
 * dynamic `require` below so no import of the optional peer reaches the type
 * system.
 */
type NativeGlassProps = {
  variant?: 'regular' | 'clear';
  tintColor?: string;
  blurRadius?: number;
  rim?: boolean;
  specular?: boolean;
  thickness?: number;
  borderRadius?: number;
  style?: unknown;
  children?: ReactNode;
};
type NativeGlassComponent = ComponentType<NativeGlassProps>;
type NativeGlassModule = { LiquidGlassView?: NativeGlassComponent };

/**
 * Resolves the optional peer's `LiquidGlassView` when it is installed and
 * autolinked, `null` otherwise — the same guarded-require pattern the overlay
 * scrim used for the old blur peer. A consumer that never installed the native
 * module still builds; the surface degrades to the translucent tint fill.
 */
function resolveLiquidGlassView(): NativeGlassComponent | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    // Optional peer dep — native glass; consumers without it get the tint fill.
    // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
    // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
    const mod = require('react-native-liquid-glassmorphism') as NativeGlassModule;
    if (!mod.LiquidGlassView) return null;
    // The peer can be installed while its native module is NOT autolinked — the
    // require() above resolves but mounting throws. `requireNativeComponent`
    // throws exactly when the `LiquidGlassmorphismView` ViewManager is
    // unregistered (old and new arch alike).
    requireNativeComponent('LiquidGlassmorphismView');
    return mod.LiquidGlassView;
  } catch {
    return null;
  }
}

const LiquidGlassView = resolveLiquidGlassView();

export type GlassProps = ViewProps & {
  /**
   * Backdrop blur radius in dp, forwarded to `LiquidGlassView`. @default 20
   */
  blurRadius?: number;
  /**
   * Corner radius of the glass surface in dp. `0` keeps square corners.
   * @default 0
   */
  borderRadius?: number;
  /**
   * Draw the bright glass edge (the `LiquidGlassView` rim). @default true
   */
  rim?: boolean;
  ref?: Ref<View>;
};

/**
 * The frosted-glass surface primitive — a translucent `glass` tint over a
 * backdrop blur, with a bright rim edge.
 *
 * This is the NATIVE twin of `./glass` (web is a CSS `backdrop-filter` view).
 * It wraps `LiquidGlassView` from `react-native-liquid-glassmorphism` in a plain
 * `View` that carries the layout/radius classes and clips children to the
 * rounded silhouette; the glass view absolute-fills it with the frosted
 * material. The fill is the themed `glass` token (`useThemeColor`) passed as
 * `tintColor`, so it follows the active scheme.
 *
 * When the optional peer is absent (or unlinked) it degrades to the translucent
 * `glass` tint fill with no blur — the surface still reads as a translucent
 * panel rather than a flat opaque wash.
 *
 * The material recipe is a shallow frosted lens: `specular` off (a static
 * surface has no moving sheen), `thickness` at 0.4 (a shallow lens, the
 * "frosted" preset's depth), `rim` on for the bright edge. `blurRadius` gives
 * both platforms the same units.
 */
export function Glass({ blurRadius = 20, borderRadius = 0, rim = true, className, style, children, ...props }: GlassProps) {
  const tint = useThemeColor('glass');

  // Clips children (and, on the native path, the glass view) to the rounded
  // silhouette so a rounded surface never leaks square-cornered content.
  const clip = borderRadius > 0 ? ({ borderRadius, overflow: 'hidden' } as const) : null;

  // No native peer (or unlinked) → translucent tint fill, no blur.
  if (!LiquidGlassView)
    return (
      <View {...props} className={className} style={[{ backgroundColor: tint }, clip, style]}>
        {children}
      </View>
    );

  return (
    <View {...props} className={className} style={[clip, style]}>
      <LiquidGlassView
        variant="regular"
        tintColor={tint}
        blurRadius={blurRadius}
        rim={rim}
        specular={false}
        thickness={0.4}
        borderRadius={borderRadius}
        style={StyleSheet.absoluteFill}
      >
        {children}
      </LiquidGlassView>
    </View>
  );
}
