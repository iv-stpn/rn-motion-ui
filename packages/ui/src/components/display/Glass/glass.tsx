// biome-ignore-all lint/style/useExportsLast: the component closes the module
import { type Ref, useCallback, useState } from 'react';
import { type LayoutChangeEvent, View, type ViewProps, type ViewStyle } from 'react-native';
import { cn } from '../../../lib/cn';
import { Rim } from './rim';

export type GlassProps = ViewProps & {
  /**
   * Backdrop blur radius in px/dp. Web is a CSS `backdrop-filter`; native maps
   * to the `BlurView` `radius`. @default 20
   */
  blurRadius?: number;
  /**
   * Corner radius of the glass surface in px/dp. `0` keeps square corners.
   * @default 0
   */
  borderRadius?: number;
  /**
   * Draw the glass edge light — the `react-glass-rim`-style specular rim around
   * the frosted surface. @default true
   */
  rim?: boolean;
  ref?: Ref<View>;
};

/**
 * The frosted-glass surface primitive — a translucent `glass` tint over a
 * backdrop blur, with a specular rim around the edge.
 *
 * This is the WEB twin of `./glass` (the `.native.tsx` file carries the guarded
 * `@danielsaraldi/react-native-blur-view` require). Web never touches the
 * optional peer, so the web bundle builds even when the native module is not
 * installed: it renders a CSS `backdrop-filter` blur under the themed `glass`
 * fill, and the `Rim` SVG edge light over it.
 *
 * The fill uses the `bg-glass` utility rather than `useThemeColor`, so it
 * resolves from the `glass` design token via `var()` and follows the active
 * scheme (and any consumer `@theme` override). Using the utility also keeps
 * Tailwind from tree-shaking the token out of the emitted `:root` block — it is
 * read only through the utility, and an unused `@theme` variable is not emitted.
 *
 * ```tsx
 * import { Glass } from 'rn-motion-ui/glass';
 *
 * <Glass borderRadius={16} className="p-4">
 *   <Text>Frosted card content</Text>
 * </Glass>
 * ```
 */
export function Glass({ blurRadius = 20, borderRadius = 0, rim = true, className, style, children, ...props }: GlassProps) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
  }, []);
  return (
    <View
      {...props}
      onLayout={onLayout}
      className={cn('bg-glass', className)}
      style={[
        // RNW passes `backdropFilter` through (prefixing `WebkitBackdropFilter`),
        // so the frost is the same blur the native `BlurView` applies. The fill
        // is the `bg-glass` utility above, so it composites over the blurred
        // backdrop instead of hiding it.
        // biome-ignore lint/plugin: RN's ViewStyle has no backdropFilter — RNW forwards the CSS property at runtime
        { backdropFilter: `blur(${blurRadius}px)` } as unknown as ViewStyle,
        borderRadius > 0 ? { borderRadius, overflow: 'hidden' } : null,
        style,
      ]}
    >
      {rim && size ? <Rim borderRadius={borderRadius} width={size.width} height={size.height} /> : null}
      {children}
    </View>
  );
}
