import { AnimatePresence } from '@rn-motion-ui/moti/presence';
import { MotiView } from '@rn-motion-ui/moti/view';
import { useCallback, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { usePageVisible } from '../../hooks/use-page-visible';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { EASE_IN_OUT } from '../../lib/ease';

// Spring enter mirrors the reference (soft, slightly heavy feel).
const ENTER_TRANSITION = { type: 'spring', damping: 32, stiffness: 160, mass: 0.75 } as const;
// Timing exit: a clean, quick fade-slide out.
const EXIT_TRANSITION = { type: 'timing', duration: 250, easing: EASE_IN_OUT } as const;
// Fallback roll distance before the slot has been measured (px).
const ROLL_FALLBACK = 32;

export type TextRollingDirection =
  /** New label enters from below; old exits to the top. Default. */
  | 'forward'
  /** New label enters from above; old exits to the bottom. */
  | 'backward';

export type TextRollingProps = {
  /** Current text. Changing it rolls the whole label to the new value. */
  text: string;
  /**
   * Rolling direction. `'forward'` (default) — new text enters from below.
   * `'backward'` — new text enters from above.
   */
  direction?: TextRollingDirection;
  /** Text styling (size/weight/colour). */
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Rolls the whole text label as a single block when `text` changes — the old
 * value slides out and the new value slides in from the opposite side.
 *
 * A hidden sizer `Text` establishes the clip height; the visible label sits
 * absolutely on top of it. `AnimatePresence initial={false}` skips the enter
 * animation on the first mount so the text appears instantly.
 *
 * Use this when you want the full string to move together (e.g. a status
 * label cycling through states). For a character-by-character cascade see
 * `TextCascade`; for digit-by-digit rolling numbers see `NumberTicker`.
 */
export function TextRolling({ text, direction = 'forward', className, style, accessibilityLabel, testID }: TextRollingProps) {
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const [rollHeight, setRollHeight] = useState(0);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h && h !== rollHeight) setRollHeight(h);
    },
    [rollHeight],
  );

  // Reduced motion or hidden page: render the label statically. Background tabs
  // would queue then replay all queued swaps on return — settled label avoids that.
  if (reduce || !pageVisible)
    return (
      <View testID={testID} accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? text} style={style}>
        <Text className={className}>{text}</Text>
      </View>
    );

  const roll = rollHeight || ROLL_FALLBACK;
  // 'forward': enters from below (+roll), exits to top (-roll).
  // 'backward': enters from above (-roll), exits to bottom (+roll).
  const enterY = direction === 'backward' ? -roll : roll;
  const exitY = direction === 'backward' ? roll : -roll;

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? text}
      style={[{ overflow: 'hidden' }, style]}
    >
      {/* Hidden sizer keeps the slot at the correct line height. Always renders
          the current text so the clip region tracks text size changes. */}
      <Text className={className} onLayout={onLayout} style={{ opacity: 0 }} importantForAccessibility="no">
        {text}
      </Text>
      {/* initial={false}: skip enter animation on first mount — text appears
          instantly. Subsequent key changes animate normally. */}
      <AnimatePresence initial={false}>
        <MotiView
          key={text}
          from={{ opacity: 0, translateY: enterY }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: exitY }}
          transition={ENTER_TRANSITION}
          exitTransition={EXIT_TRANSITION}
          style={{ position: 'absolute', left: 0, top: 0, right: 0 }}
        >
          <Text numberOfLines={1} className={className}>
            {text}
          </Text>
        </MotiView>
      </AnimatePresence>
    </View>
  );
}
