// biome-ignore-all lint/style/useExportsLast: the component closes the module
import { type ComponentType, type ElementType, type ReactNode, type Ref, type RefObject, useCallback, useState } from 'react';
import { type LayoutChangeEvent, Platform, StyleSheet, useColorScheme, View, type ViewProps } from 'react-native';
import { cn } from '../../../lib/cn';
import { scaleAlpha } from '../../../lib/color';
import type { SurfaceElevation } from '../../../lib/elevated';
import { CARD_RADIUS, MENU_RADIUS, MODAL_RADIUS } from '../../../lib/radius';
import { glassSurface, type SurfaceRadius, surface } from '../../../lib/surface';
import { useThemeColor } from '../../../theme/use-theme-color';
import { useBlurTargetRef, useInsideBlurTarget } from '../../menus/Overlay/blur-context';
import { Rim } from './rim';

/**
 * The numeric corner radius for each surface radius token. The rim and the blur
 * clip need a px value — the `rounded-*` classes only exist in CSS, which a
 * react-native-svg stroke or a native clip cannot read back.
 */
const RADIUS_PX: Record<SurfaceRadius, number> = { card: CARD_RADIUS, menu: MENU_RADIUS, modal: MODAL_RADIUS };

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
 * otherwise. No `requireNativeComponent` probe: the peer is CODEGEN, so a second
 * registration would throw "Tried to register two views with the same name".
 */
function resolveBlurView(): BlurViewComponent | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    // Optional peer dep — native blur; consumers without it get the tint fill.
    // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
    // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
    const mod = require('@danielsaraldi/react-native-blur-view') as BlurViewModule;
    const resolved = mod.BlurView ?? mod.default ?? mod;
    if (!resolved) return null;
    return resolved;
  } catch {
    return null;
  }
}

const BlurView = resolveBlurView();

export type SurfaceProps = ViewProps & {
  /**
   * Render the surface through a different host — pass `MotiView` to keep an
   * animated panel's `from`/`animate`/`exit`/`transition`/`layout`. @default View
   */
  as?: ElementType;
  /**
   * Ladder level for the surface — drives `bg-surface-N` + `shadow-elevated-N`
   * (the same pair `surface()` composes). `0` is the flat resting surface.
   * @default 0
   */
  elevation?: SurfaceElevation;
  /** Corner-radius token for the surface; omit to keep the caller's own corner class. */
  radius?: SurfaceRadius;
  /** Swap the ladder shadow for the diffuse `shadow-floating` halo. @default false */
  floating?: boolean;
  /**
   * Backdrop blur radius in dp, forwarded to the peer `BlurView`. `0` keeps the
   * surface a solid panel. @default 0
   */
  blurRadius?: number;
  /** Opacity of the frosted tint (0–1); `1` is the full glass tint. @default 1 */
  opacity?: number;
  /** Draw the glass edge light — the `Rim` specular ring around the surface. @default false */
  rim?: boolean;
  /** Rim width in dp, forwarded to the `Rim` `thickness`. @default 1 */
  rimWidth?: number;
  /** Peak alpha (0–1) of the rim's specular highlight — lower is subtler. @default 0.5 */
  intensity?: number;
  /** Numeric corner radius in dp for the rim + blur clip; defaults from `radius`. */
  borderRadius?: number;
  /**
   * Escape hatch for the inline degrade. On Android a `BlurView` that is a
   * descendant of the `BlurTarget` it references cycles the RenderNode graph
   * (SIGSEGV), so a frosted pane inside the target degrades to the tint fill.
   * Being inside the target is now detected automatically (the provider marks
   * the target's subtree via context), so most callers never set this — pass it
   * true to force the degrade when the auto-detection can't see the target
   * (e.g. the surface is rendered through a non-context host). iOS and web blur
   * behind themselves and are unaffected.
   * @default false
   */
  inline?: boolean;
  ref?: Ref<View>;
  // Moti animation props, forwarded verbatim when `as` is an animated host.
  from?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  exitTransition?: unknown;
  layout?: unknown;
  onDidAnimate?: unknown;
};

/**
 * The shared surface primitive — the NATIVE twin of `./surface`. See that module's
 * doc for the public contract; this file carries the `BlurView` frost.
 *
 * A `blurRadius > 0` surface frosts its backdrop via the optional peer's
 * `BlurView`: a `UIVisualEffectView` on iOS, a `BlurTarget`-scoped view on
 * Android (the target ref comes from an enclosing `<BlurProvider>`). Without a
 * provider — or without the optional peer — the pane degrades to the translucent
 * `glass` tint. At `blurRadius: 0` it renders the exact `surface()` panel, so it
 * is a drop-in for the class helper.
 */
export function Surface({
  as,
  elevation = 0,
  radius,
  floating = false,
  blurRadius = 0,
  opacity = 1,
  rim = false,
  rimWidth,
  intensity,
  borderRadius,
  inline = false,
  onLayout: onLayoutProp,
  className,
  style,
  children,
  ...props
}: SurfaceProps) {
  const Host = as ?? View;
  const tint = useThemeColor('glass');
  const scheme = useColorScheme();
  const glass = blurRadius > 0;
  const numericRadius = borderRadius ?? (radius ? RADIUS_PX[radius] : 0);
  // The frost fill: the neutral `glass` token, thinned by `opacity`. On the
  // native path it is the BlurView's own tint on the blur branch, so `opacity`
  // thins the frost on the degrade path only.
  const fill = glass && opacity < 1 ? scaleAlpha(tint, opacity) : tint;
  const blurTargetRef = useBlurTargetRef();
  // True when this surface renders inside the `BlurTarget` its `BlurView` would
  // reference — i.e. it is a descendant of its own blur source on Android.
  const insideBlurTarget = useInsideBlurTarget();

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // Compose the caller's `onLayout` with the measurement the Rim needs — a
  // single `onLayout` slot means the surface's own callback would otherwise
  // swallow a panel's layout handler (e.g. Drawer/AdaptiveDropdown positioning).
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
      onLayoutProp?.(event);
    },
    [onLayoutProp],
  );

  // Clips the blur + tint layers to the rounded silhouette so a rounded frosted
  // surface never leaks square-cornered content.
  const clip = glass && numericRadius > 0 ? ({ borderRadius: numericRadius, overflow: 'hidden' } as const) : null;

  // A pane inside the target it blurs would cycle the RenderNode graph on
  // Android — degrade to the tint fill rather than crash. Being inside the
  // target is auto-detected via context; `inline` is the manual escape hatch
  // for when that detection can't see the target (see prop doc).
  const renderBlur = BlurView !== null && glass && !(Platform.OS === 'android' && (inline || insideBlurTarget));
  // The peer's overlay tint tracks the scheme; `light`/`dark` mirror the web
  // twin's themed `glass` fill well enough that a separate tint layer is noise.
  const blurType = scheme === 'dark' ? 'dark' : 'light';

  // The frost layer: the peer's `BlurView` on the blur path, else the translucent
  // `glass` tint fill (the degrade path — see module doc). `null` when solid.
  let frost: ReactNode = null;
  if (renderBlur) {
    frost = (
      <BlurView
        type={blurType}
        radius={blurRadius}
        blurTarget={blurTargetRef ?? undefined}
        pointerEvents="none"
        // The peer's BlurView wrapper hardcodes `zIndex: 10` (its
        // `globalStyles.container`), which lifts the frosted layer ABOVE the Rim
        // and `children` siblings and frosts them away into invisibility on iOS.
        // The Rim + content must sit on top of the frost, so flatten the wrapper
        // back to the default 0.
        style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
      />
    );
  } else if (glass) {
    // The degrade fill: translucent `glass` tint, no blur — the pane still reads
    // as a translucent panel rather than a flat opaque wash.
    frost = <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />;
  }

  return (
    <Host
      {...props}
      onLayout={onLayout}
      className={cn(glass ? glassSurface(elevation, radius, floating) : surface(elevation, radius, floating), className)}
      style={[clip, style]}
    >
      {frost}
      {rim && size ? (
        <Rim borderRadius={numericRadius} width={size.width} height={size.height} thickness={rimWidth} intensity={intensity} />
      ) : null}
      {children}
    </Host>
  );
}
