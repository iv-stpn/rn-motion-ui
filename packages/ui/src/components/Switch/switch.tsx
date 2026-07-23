import { cva } from 'class-variance-authority';
import { useCallback, useRef, useState } from 'react';
import { Animated, Platform, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { useShakeAnimation } from '../../hooks/use-shake-animation';
import { cn } from '../../lib/cn';
import { THUMB_SPRING } from '../../lib/ease';
import { MotiView } from '../../moti/components/view';
import { type MotiTransitionProp, mergeTransition } from '../../theme/motion';
import { useThemeColor } from '../../theme/use-theme-color';
import { Text } from '../Text/text';

// Track colour swaps on checked; the thumb translate/squish stay inline (animated).
const track = cva('h-7 w-12 flex-row items-center rounded-full px-1', {
  variants: {
    checked: { true: 'bg-primary', false: 'bg-muted-foreground/60' },
  },
  defaultVariants: { checked: false },
});

// Thumb travels 20px (track 48 − padding 8 − thumb 20). Kept as an Animated.Value
// so the disabled-shake sequence can drive x directly.
const TRAVEL = 20;
// Shorter 4-step shake for the toggle: constrained travel (2px) for a subtle signal.
const SWITCH_SHAKE_STEPS = [-2, 2, -1, 0] as const;

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  /** Additional NativeWind class names merged onto the outer row. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  /**
   * Override the thumb slide spring. Partial — only the fields you pass are changed.
   * Default: `THUMB_SPRING` (stiffness 800, damping 80, mass 4).
   */
  thumbTransition?: Partial<MotiTransitionProp>;
};

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  className,
  style,
  accessibilityLabel,
  testID,
  thumbTransition,
}: SwitchProps) {
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const shakeX = useRef(new Animated.Value(0)).current;
  const squish = pressed && !disabled && !reduce;
  // The thumb is a lifted control — surface-3 (white in light, a raised tinted
  // step in dark) keeps it distinct from both track states.
  const thumbBackground = useThemeColor('surface-3');
  const thumbSpring = mergeTransition(
    { type: 'spring' as const, stiffness: THUMB_SPRING.stiffness, damping: THUMB_SPRING.damping, mass: THUMB_SPRING.mass },
    thumbTransition,
  );

  // Disabled + pressed → a short horizontal shake to signal "can't toggle".
  useShakeAnimation({ trigger: Boolean(disabled && pressed), reduce, shakeX, steps: SWITCH_SHAKE_STEPS, duration: 60 });

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);
  const handleToggle = useCallback(() => {
    if (!disabled) onCheckedChange(!checked);
  }, [disabled, onCheckedChange, checked]);

  return (
    <View className={cn('flex-row items-center', className)} style={[{ gap: 12 }, style]}>
      <Pressable
        accessibilityRole="switch"
        aria-checked={checked}
        aria-disabled={Boolean(disabled)}
        accessibilityLabel={accessibilityLabel ?? label}
        testID={testID ?? 'switch'}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handleToggle}
      >
        <Animated.View
          className={track({ checked })}
          style={{ opacity: disabled ? 0.6 : 1, transform: [{ translateX: shakeX }] }}
        >
          <MotiView
            animate={{
              translateX: checked ? TRAVEL : 0,
              scaleX: squish ? 1.15 : 1,
              scale: squish ? 0.92 : 1,
            }}
            transition={thumbSpring}
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: thumbBackground,
              ...Platform.select({
                default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
                web: { boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.2)' },
              }),
              elevation: 3,
            }}
          />
        </Animated.View>
      </Pressable>
      {label ? (
        <Text className="text-foreground text-sm" style={{ opacity: disabled ? 0.6 : 1 }} onPress={handleToggle}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
