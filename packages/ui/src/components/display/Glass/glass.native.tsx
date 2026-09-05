// biome-ignore-all lint/style/useExportsLast: the component closes the module
/**
 * Native frosted-glass surface, backed by `@danielsaraldi/react-native-blur-view`
 * (the package published from
 * [DanielAraldi/react-native-blur-view](https://github.com/DanielAraldi/react-native-blur-view)):
 *
 * - **iOS** — its `BlurView` is a `UIVisualEffectView` that blurs whatever sits
 *   behind it, so a glass pane frosts its local backdrop with no extra wiring.
 * - **Android** — the same `BlurView` does *not* blur behind itself; it blurs a
 *   `<BlurTarget>` it is pointed at. The `blurTarget` ref comes from an
 *   enclosing `<BlurProvider>` (see `../../menus/Overlay/blur-provider`), whose
 *   `BlurTarget` wraps the app content. Without a provider — or without the
 *   optional peer — the pane degrades to the translucent `glass` tint, the
 *   pre-blur rendering.
 *
 * This is the NATIVE twin of `./glass` — web resolves the plain `.tsx` file (a
 * CSS `backdrop-filter` view) and never imports the optional peer, so a
 * consumer without it still bundles. The blur comes from the peer's `BlurView`,
 * resolved through a guarded dynamic `require` exactly like `overlay-blur`
 * resolves it; when it cannot run, the pane degrades to the tint fill.
 */

import { type ComponentType, type Ref, type RefObject, useCallback, useState } from 'react';
import { type LayoutChangeEvent, Platform, StyleSheet, useColorScheme, View, type ViewProps } from 'react-native';
import { cn } from '../../../lib/cn';
import { useThemeColor } from '../../../theme/use-theme-color';
import { useBlurTargetRef } from '../../menus/Overlay/blur-context';
import { Rim } from './rim';

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
 * import. No `requireNativeComponent` probe: the peer is CODEGEN, so a second
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

export type GlassProps = ViewProps & {
  /**
   * Backdrop blur radius in dp, forwarded to the peer `BlurView`. @default 20
   */
  blurRadius?: number;
  /**
   * Corner radius of the glass surface in dp. `0` keeps square corners.
   * @default 0
   */
  borderRadius?: number;
  /**
   * Draw the glass edge light — the `react-glass-rim`-style specular rim.
   * @default true
   */
  rim?: boolean;
  /**
   * Set true when the glass renders *inside* the `BlurTarget` it blurs (a card
   * in the page). On Android a `BlurView` that is a descendant of its own
   * target cycles the RenderNode graph (SIGSEGV), so an inline pane degrades to
   * the tint fill rather than crash. iOS and web blur behind themselves and are
   * unaffected. @default false
   */
  inline?: boolean;
  ref?: Ref<View>;
};

export function Glass({
  blurRadius = 20,
  borderRadius = 0,
  rim = true,
  inline = false,
  className,
  style,
  children,
  ...props
}: GlassProps) {
  const tint = useThemeColor('glass');
  const scheme = useColorScheme();
  const blurTargetRef = useBlurTargetRef();

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
  }, []);

  // Clips children (and, on the native path, the blur + tint layers) to the
  // rounded silhouette so a rounded surface never leaks square-cornered content.
  const clip = borderRadius > 0 ? ({ borderRadius, overflow: 'hidden' } as const) : null;

  // An inline pane inside the target it blurs would cycle the RenderNode graph
  // on Android — degrade to the tint fill rather than crash (see module doc).
  const renderBlur = BlurView !== null && !(inline && Platform.OS === 'android');
  // The peer's overlay tint tracks the scheme; `light`/`dark` mirror the web
  // twin's themed `glass` fill well enough that a separate tint layer is noise.
  const blurType = scheme === 'dark' ? 'dark' : 'light';

  return (
    <View {...props} onLayout={onLayout} className={cn(className)} style={[clip, style]}>
      {renderBlur ? (
        <BlurView
          type={blurType}
          radius={blurRadius}
          blurTarget={blurTargetRef ?? undefined}
          pointerEvents="none"
          // The peer's BlurView wrapper hardcodes `zIndex: 10` (its
          // `globalStyles.container`), which lifts the frosted layer ABOVE the
          // Rim and `children` siblings and frosts them away into invisibility on
          // iOS. The Rim + content must sit on top of the frost, so flatten the
          // wrapper back to the default 0 — the natural sibling order (Rim and
          // children render after the blur) then paints them above it.
          style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
        />
      ) : (
        // The degrade fill: translucent `glass` tint, no blur — the pane still
        // reads as a translucent panel rather than a flat opaque wash.
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
      )}
      {rim && size ? <Rim borderRadius={borderRadius} width={size.width} height={size.height} /> : null}
      {children}
    </View>
  );
}
