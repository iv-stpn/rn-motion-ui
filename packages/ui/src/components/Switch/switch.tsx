import { cva } from 'class-variance-authority';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { THUMB_SPRING } from '../../lib/ease';

// Track colour swaps on checked; the thumb translate/squish stay inline (animated).
const track = cva('h-7 w-12 flex-row items-center rounded-full px-1', {
  variants: {
    checked: { true: 'bg-primary', false: 'bg-muted-foreground/60' },
  },
  defaultVariants: { checked: false },
});

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

// Thumb travels 20px (track 48 − padding 8 − thumb 20). Kept as an Animated.Value
// so the disabled-shake sequence can drive x directly.
const TRAVEL = 20;

export function Switch({ checked, onCheckedChange, disabled, label, style, accessibilityLabel, testID }: SwitchProps) {
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const shakeX = useRef(new Animated.Value(0)).current;
  const squish = pressed && !disabled && !reduce;

  // Disabled + pressed → a short horizontal shake to signal "can't toggle".
  useEffect(() => {
    if (disabled && pressed && !reduce)
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -2, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 2, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
  }, [disabled, pressed, reduce, shakeX]);

  return (
    <View className="flex-row items-center" style={[{ gap: 12 }, style]}>
      <Pressable
        accessibilityRole="switch"
        aria-checked={checked}
        aria-disabled={!!disabled}
        accessibilityLabel={accessibilityLabel ?? label}
        testID={testID ?? 'switch'}
        disabled={disabled}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={() => !disabled && onCheckedChange(!checked)}
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
            transition={{
              type: 'spring',
              stiffness: THUMB_SPRING.stiffness,
              damping: THUMB_SPRING.damping,
              mass: THUMB_SPRING.mass,
            }}
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: '#ffffff',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 3,
              elevation: 3,
            }}
          />
        </Animated.View>
      </Pressable>
      {label ? (
        <Text
          className="text-sm text-foreground"
          style={{ opacity: disabled ? 0.6 : 1 }}
          onPress={() => !disabled && onCheckedChange(!checked)}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
