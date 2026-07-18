import { type StyleProp, View, type ViewStyle } from 'react-native';
import { ActionSwapText } from '../ActionSwap/action-swap';

export type TextCascadeProps = {
  /** Current text. Changing it cascades the letters to the new value. */
  text: string;
  /** Text styling (size/weight/colour) applied to every letter + the sizer. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Letter-by-letter slot roll for standalone text — the old letters drop away
 * as the new ones land, left to right. Same motion as the action-swap
 * cascade variant, with a text-first API.
 *
 * Delegates to `ActionSwapText` (`animation="cascade"`) so the cascade stays
 * in lockstep with the action-swap button. The wrapper only adds the
 * `text`/`className` API and an accessible label; see action-swap for the
 * per-letter motion and its RN fallbacks (no glyph blur, width snaps per
 * label, leaving layer exits as a whole while entering letters cascade).
 */
export function TextCascade({ text, className, style, accessibilityLabel, testID }: TextCascadeProps) {
  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? text}
      style={[{ overflow: 'hidden' }, style]}
    >
      <ActionSwapText value={text} animation="cascade" textClassName={className}>
        {text}
      </ActionSwapText>
    </View>
  );
}
