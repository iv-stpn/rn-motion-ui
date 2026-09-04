import type { Ref } from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { cn } from '../../../lib/cn';

export type GlassProps = ViewProps & {
  /**
   * Backdrop blur radius in px. Web is a CSS `backdrop-filter`; native maps to
   * the `LiquidGlassView` `blurRadius`. @default 20
   */
  blurRadius?: number;
  /**
   * Corner radius of the glass surface in px/dp. `0` keeps square corners.
   * @default 0
   */
  borderRadius?: number;
  /**
   * Draw the bright glass edge. On web this is a hairline border in the
   * `glass-rim` token; on native it forwards to the `LiquidGlassView` `rim`
   * prop. @default true
   */
  rim?: boolean;
  ref?: Ref<View>;
};

/**
 * The frosted-glass surface primitive — a translucent `glass` tint over a
 * backdrop blur, with a bright rim edge.
 *
 * This is the WEB twin of `./glass` (the `.native.tsx` file carries the guarded
 * `react-native-liquid-glassmorphism` require). Web never touches the optional
 * peer, so the web bundle builds even when the native module is not installed:
 * it renders a CSS `backdrop-filter` blur under the themed `glass` fill.
 *
 * The fill and rim use the `bg-glass` / `border-glass-rim` utilities rather than
 * `useThemeColor`, so they resolve from the `glass` / `glass-rim` design tokens
 * via `var()` and follow the active scheme (and any consumer `@theme` override).
 * Using the utilities also keeps Tailwind from tree-shaking the two tokens out of
 * the emitted `:root` block — they are read only by JS (`useThemeColor`) on
 * native, never by a `bg-glass` utility, and an unused `@theme` variable is not
 * emitted to CSS.
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
  return (
    <View
      {...props}
      className={cn('bg-glass', rim && 'border-glass-rim', className)}
      style={[
        // RNW passes `backdropFilter` through (prefixing `WebkitBackdropFilter`),
        // so the frost is the same blur the native `LiquidGlassView` applies. The
        // fill and rim are the `glass` / `glass-rim` utilities above, so they
        // composite over the blurred backdrop instead of hiding it.
        // biome-ignore lint/plugin: RN's ViewStyle has no backdropFilter — RNW forwards the CSS property at runtime
        {
          backdropFilter: `blur(${blurRadius}px)`,
          WebkitBackdropFilter: `blur(${blurRadius}px)`,
        } as unknown as ViewStyle,
        borderRadius > 0 ? { borderRadius } : null,
        rim ? { borderWidth: StyleSheet.hairlineWidth } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
