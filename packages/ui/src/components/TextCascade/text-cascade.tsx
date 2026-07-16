import { AnimatePresence, MotiText, MotiView } from 'moti';
import { useRef, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { SPRING_SWAP } from '../../lib/ease';

export interface TextCascadeProps {
  /** Current text. Changing it cascades the letters to the new value. */
  text: string;
  /** Text styling (size/weight/colour) applied to every letter + the sizer. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

// Enter stagger between letters (ms). Left-to-right slot roll.
const CASCADE_STAGGER = 25;

/**
 * Letter-by-letter slot roll: the old label slides up and out while the new
 * one lands from below, staggered left→right.
 *
 * RN fallbacks vs the web original:
 * - Web blurred each glyph mid-roll (`filter: blur`); RN has no text blur, so
 *   the blur is dropped and the roll relies on translateY + opacity.
 * - Web smoothly tweened container width between labels; here the hidden sizer
 *   sets width per label (no width tween). The per-letter cascade is preserved.
 * - Web staggered the *exit* per letter too; here the leaving layer exits as a
 *   whole (fade + slide up) while the entering letters cascade individually.
 */
export function TextCascade({ text, className, style, accessibilityLabel, testID }: TextCascadeProps) {
  const reduce = useReducedMotion();
  const [rollHeight, setRollHeight] = useState(0);
  const firstRender = useRef(true);
  const isFirst = firstRender.current;
  firstRender.current = false;

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h && h !== rollHeight) setRollHeight(h);
  };

  const letters = Array.from(text);
  // Fall back to a sensible roll distance before the first measure lands.
  const roll = rollHeight || 24;

  if (reduce) {
    return (
      <View testID={testID} accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? text} style={style}>
        <Text className={className}>{text}</Text>
      </View>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? text}
      style={[{ overflow: 'hidden' }, style]}
    >
      {/* Hidden sizer: defines the container's width/height for this label. */}
      <Text className={className} onLayout={onLayout} style={{ opacity: 0 }} importantForAccessibility="no">
        {text}
      </Text>
      <AnimatePresence initial={false}>
        <MotiView
          key={text}
          from={{ opacity: 1, translateY: 0 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: -roll }}
          transition={{ type: 'timing', duration: 160 }}
          style={{ position: 'absolute', left: 0, top: 0, flexDirection: 'row' }}
        >
          {letters.map((char, i) => (
            <MotiText
              // biome-ignore lint/suspicious/noArrayIndexKey: position is the slot identity — the letter at a position is what rolls.
              key={i}
              className={className}
              from={isFirst ? { opacity: 1, translateY: 0 } : { opacity: 0, translateY: roll }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ ...SPRING_SWAP, delay: isFirst ? 0 : i * CASCADE_STAGGER }}
            >
              {char === ' ' ? ' ' : char}
            </MotiText>
          ))}
        </MotiView>
      </AnimatePresence>
    </View>
  );
}
