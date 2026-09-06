// biome-ignore-all lint/style/useExportsLast: the component closes the module
import { type ElementType, type Ref, useCallback, useState } from 'react';
import { type LayoutChangeEvent, View, type ViewProps, type ViewStyle } from 'react-native';
import { cn } from '../../../lib/cn';
import { scaleAlpha } from '../../../lib/color';
import type { SurfaceElevation } from '../../../lib/elevated';
import { CARD_RADIUS, MENU_RADIUS, MODAL_RADIUS } from '../../../lib/radius';
import { glassSurface, type SurfaceRadius, surface } from '../../../lib/surface';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Rim } from './rim';

/**
 * The numeric corner radius for each surface radius token. The rim and the blur
 * clip need a px value — the `rounded-*` classes only exist in CSS, which a
 * react-native-svg stroke or a backdrop clip cannot read back.
 */
const RADIUS_PX: Record<SurfaceRadius, number> = { card: CARD_RADIUS, menu: MENU_RADIUS, modal: MODAL_RADIUS };

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
   * Backdrop blur radius in px/dp. `0` keeps the surface a solid panel; any
   * positive value switches it to the frosted-glass fill (a `glass` tint over a
   * CSS `backdrop-filter` blur) and exposes the `opacity` knob. @default 0
   */
  blurRadius?: number;
  /** Opacity of the frosted tint (0–1); `1` is the full glass tint. @default 1 */
  opacity?: number;
  /** Draw the glass edge light — the `Rim` specular ring around the surface. @default false */
  rim?: boolean;
  /** Rim width in px, forwarded to the `Rim` `thickness`. @default 1 */
  rimWidth?: number;
  /** Peak alpha (0–1) of the rim's specular highlight — lower is subtler. @default 0.5 */
  intensity?: number;
  /** Numeric corner radius in px for the rim + blur clip; defaults from `radius`. */
  borderRadius?: number;
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
 * The shared surface primitive — a surface container whose fill, float shadow
 * and corner radius move together, with an optional frosted-glass treatment.
 *
 * It is the drop-in replacement for the `surface()` class helper that the
 * library's panels (Card, menus, sheets, the dock, …) previously spelled by
 * hand: it composes the elevation ladder and radius token, then — when
 * `blurRadius` is set — swaps the opaque `bg-surface-N` fill for the translucent
 * `glass` tint over a backdrop blur and layers the `Rim` specular edge light.
 * At `blurRadius: 0` and `rim: false` it renders exactly what `surface()`
 * produced, so a panel can migrate to it with no visual change and opt into the
 * frost later.
 *
 * This is the WEB twin of `./surface` — the `.native.tsx` file carries the
 * guarded `@danielsaraldi/react-native-blur-view` require. Web never touches the
 * optional peer: it renders a CSS `backdrop-filter` blur under the themed
 * `glass` fill.
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
  onLayout: onLayoutProp,
  className,
  style,
  children,
  ...props
}: SurfaceProps) {
  const Host = as ?? View;
  const tint = useThemeColor('glass');
  const glass = blurRadius > 0;
  // The rim and the blur clip need a px radius; fall back to the token's number.
  const numericRadius = borderRadius ?? (radius ? RADIUS_PX[radius] : 0);
  const fill = glass && opacity < 1 ? scaleAlpha(tint, opacity) : null;

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

  return (
    <Host
      {...props}
      onLayout={onLayout}
      className={cn(glass ? glassSurface(elevation, radius, floating) : surface(elevation, radius, floating), className)}
      style={[
        // RNW passes `backdropFilter` through (prefixing `WebkitBackdropFilter`),
        // so the frost is the same blur the native `BlurView` applies. The fill
        // is the inline `backgroundColor` below, which composites over the
        // blurred backdrop instead of hiding it.
        glass
          ? // biome-ignore lint/plugin: RN's ViewStyle has no backdropFilter — RNW forwards the CSS property at runtime
            ({ backdropFilter: `blur(${blurRadius}px)` } as unknown as ViewStyle)
          : null,
        glass ? { backgroundColor: fill ?? tint } : null,
        // Clip the square blur + tint to the rounded silhouette when frosted.
        numericRadius > 0 && glass ? { borderRadius: numericRadius, overflow: 'hidden' } : null,
        style,
      ]}
    >
      {rim && size ? (
        <Rim borderRadius={numericRadius} width={size.width} height={size.height} thickness={rimWidth} intensity={intensity} />
      ) : null}
      {children}
    </Host>
  );
}
