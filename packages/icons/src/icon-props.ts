import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Shared prop type for every MingCute icon component in rn-motion-ui-icons.
 *
 * All icons are fill- or stroke-rendered SVGs via react-native-svg, so they
 * work on both React Native and react-native-web without any native-code icon
 * font dependency.
 */
export type IconProps = {
  /** Square edge length in px. Default: 24. */
  size?: number;
  /**
   * Fill / stroke colour. Defaults to the `foreground` theme token when omitted,
   * via useThemeColor from rn-motion-ui.
   */
  color?: string;
  style?: StyleProp<ViewStyle>;
  /** Accessibility label; when omitted the icon is treated as decorative. */
  accessibilityLabel?: string;
  testID?: string;
};
