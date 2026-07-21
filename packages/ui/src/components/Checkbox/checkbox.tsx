import { useCallback, useState } from 'react';
import { Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { SPRING_PRESS } from '../../lib/ease';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';

const CHECK_PATH = 'M5 13l4 4L19 7';
const INDETERMINATE_PATH = 'M6 12h12';

export type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  label?: string;
  /** Additional NativeWind class names merged onto the outer row. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  indeterminate,
  label,
  className,
  style,
  accessibilityLabel,
  testID,
}: CheckboxProps) {
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const showMark = checked || Boolean(indeterminate);
  const path = indeterminate ? INDETERMINATE_PATH : CHECK_PATH;

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);
  const handlePress = useCallback(() => {
    if (!disabled) onCheckedChange(!checked);
  }, [disabled, onCheckedChange, checked]);

  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-disabled={Boolean(disabled)}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID ?? 'checkbox'}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      className={cn('flex-row items-center', className)}
      style={[{ gap: 12, opacity: disabled ? 0.6 : 1 }, style]}
    >
      {/* Tap feedback: the box springs down while pressed (Button's idiom). */}
      <MotiView animate={{ scale: pressed && !reduce && !disabled ? 0.92 : 1 }} transition={SPRING_PRESS}>
        {/* Base box is always in the unchecked state; the primary fill animates in/out. */}
        <View
          className={`h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 bg-surface ${showMark ? 'border-primary' : 'border-muted-foreground/50'}`}
        >
          {/* Fill fades in on check and out on uncheck, same 160 ms timing as the mark. */}
          <MotiView
            animate={{ opacity: showMark ? 1 : 0 }}
            transition={{ type: 'timing', duration: reduce ? 0 : 160 }}
            className="absolute inset-0 bg-primary"
          />
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
      {label ? <Text className="select-none text-foreground text-sm">{label}</Text> : null}
    </Pressable>
  );
}
