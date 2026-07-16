import { cva } from 'class-variance-authority';
import { AnimatePresence, MotiView } from 'moti';
import { useState } from 'react';
import { Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { SPRING_PRESS } from '../../lib/ease';

const CHECK_PATH = 'M5 13l4 4L19 7';
const INDETERMINATE_PATH = 'M6 12h12';

// The box swaps border/fill colour by state; the mark animates in via moti.
const box = cva('h-5 w-5 shrink-0 items-center justify-center rounded-md border-2', {
  variants: {
    marked: {
      true: 'border-primary bg-primary',
      false: 'border-muted-foreground/50 bg-background',
    },
  },
  defaultVariants: { marked: false },
});

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  indeterminate,
  label,
  style,
  accessibilityLabel,
  testID,
}: CheckboxProps) {
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const showMark = checked || !!indeterminate;
  const path = indeterminate ? INDETERMINATE_PATH : CHECK_PATH;

  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-disabled={!!disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID ?? 'checkbox'}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => !disabled && onCheckedChange(!checked)}
      className="flex-row items-center"
      style={[{ gap: 12, opacity: disabled ? 0.6 : 1 }, style]}
    >
      {/* Tap feedback: the box springs down while pressed (Button's idiom). */}
      <MotiView animate={{ scale: pressed && !reduce && !disabled ? 0.92 : 1 }} transition={SPRING_PRESS}>
        <View className={box({ marked: showMark })}>
          <AnimatePresence>
            {showMark ? (
              <MotiView
                key={indeterminate ? 'indeterminate' : 'checked'}
                from={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                transition={{ type: 'timing', duration: reduce ? 0 : 160 }}
              >
                <Svg width={12} height={12} viewBox="0 0 24 24">
                  <Path d={path} fill="none" stroke="#fafafa" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </MotiView>
            ) : null}
          </AnimatePresence>
        </View>
      </MotiView>
      {label ? <Text className="select-none text-sm text-foreground">{label}</Text> : null}
    </Pressable>
  );
}
