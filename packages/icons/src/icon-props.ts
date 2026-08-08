import type { SvgProps } from 'react-native-svg';
import type { ThemeToken } from 'rn-motion-ui/theme/use-theme-color';

/**
 * Shared prop type for every MingCute icon component in rn-motion-ui-icons.
 *
 * All icons are fill- or stroke-rendered SVGs via react-native-svg, so they
 * work on both React Native and react-native-web without any native-code icon
 * font dependency.
 *
 * Extends {@link SvgProps} so that any prop accepted by the underlying
 * `<Svg>` element (hitSlop, onLayout, pointerEvents, …) can be forwarded.
 * `width` / `height` / `viewBox` / `color` are omitted because the icon
 * components manage them directly.
 */
export type IconProps = Omit<SvgProps, 'width' | 'height' | 'color' | 'viewBox'> & {
  /** Square edge length in px. Default: 24. */
  size?: number;
  /**
   * Fill / stroke colour.
   *
   * Pass a semantic theme token (`"primary"`, `"muted-foreground"`, …) to get
   * a color that updates automatically when the color scheme changes. Pass any
   * other string (hex, rgb, named CSS color) for a fixed color. Defaults to
   * the `foreground` token when omitted.
   */
  color?: ThemeToken | (string & {});
};
