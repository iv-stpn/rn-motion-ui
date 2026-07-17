import { MotiView } from '@rn-motion-ui/moti/view';
import { type ReactNode, type RefObject, useCallback, useState } from 'react';
import { Pressable, type ScrollView, type StyleProp, Text, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

export type ScrollToProps = {
  /** The ScrollView to drive. Pass the same ref given to your <ScrollView>. */
  scrollRef: RefObject<ScrollView | null>;
  /** Target offset in px along the scroll axis. */
  to: number;
  /** Extra px offset from the target (e.g. to clear a sticky header). */
  offset?: number;
  /** Horizontal scroll axis. Defaults to vertical. */
  horizontal?: boolean;
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Scale the control settles to while pressed. */
  pressScale?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Button that smooth-scrolls a ScrollView to a target offset via its imperative
 * `scrollTo`. Respects reduced motion — jumps instantly.
 *
 * RN adaptation: the web original resolved `to` from a px offset, a CSS selector
 * or an element (via a Lenis/native engine). RN's `ScrollView.scrollTo` only
 * takes a px offset, so `to` is always numeric here (measure a section's
 * `onLayout` y and pass it in — see the story).
 */
export function ScrollTo({
  scrollRef,
  to,
  offset = 0,
  horizontal = false,
  children,
  onPress,
  disabled,
  pressScale = 0.96,
  style,
  accessibilityLabel,
  testID,
}: ScrollToProps) {
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);

  const handlePress = useCallback(() => {
    const target = to + offset;
    const animated = !reduce;
    scrollRef.current?.scrollTo(horizontal ? { x: target, animated } : { y: target, animated });
    onPress?.();
  }, [to, offset, reduce, scrollRef, horizontal, onPress]);

  return (
    <MotiView
      animate={{ scale: pressed && !reduce && !disabled ? pressScale : 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.6 }}
      style={style}
    >
      <Pressable
        accessibilityRole="button"
        aria-disabled={Boolean(disabled)}
        accessibilityLabel={accessibilityLabel}
        testID={testID ?? 'scroll-to'}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        {typeof children === 'string' || typeof children === 'number' ? (
          <Text className="font-medium text-foreground text-sm">{children}</Text>
        ) : (
          children
        )}
      </Pressable>
    </MotiView>
  );
}
