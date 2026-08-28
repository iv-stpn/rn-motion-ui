import { type StyleProp, View, type ViewStyle } from 'react-native';
import { ButtonSwapText } from '../../buttons/Button/button-swap';
import type { TextWeight } from '../Text/text';

export type TextCascadeProps = {
  /** Current text. Changing it cascades the letters to the new value. */
  text: string;
  /** Text styling (size/colour) applied to every letter + the sizer. */
  className?: string;
  /** Font weight for every letter (resolves a per-weight font token). */
  weight?: TextWeight;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Letter-by-letter slot roll for standalone text — the old letters drop away
 * as the new ones land, left to right. Same motion as the button-swap
 * cascade variant, with a text-first API.
 *
 * Delegates to `ButtonSwapText` (`animation="cascade"`) so the cascade stays
 * in lockstep with the button-swap button. The wrapper only adds the
 * `text`/`className` API and an accessible label.
 */
export function TextCascade({ text, className, weight, style, accessibilityLabel, testID }: TextCascadeProps) {
  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? text}
      style={[{ overflow: 'hidden' }, style]}
    >
      <ButtonSwapText value={text} animation="cascade" textClassName={className} weight={weight}>
        {text}
      </ButtonSwapText>
    </View>
  );
}
