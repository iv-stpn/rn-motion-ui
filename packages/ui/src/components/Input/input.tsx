import { useReducedMotion } from '@rn-motion-ui/hooks/use-reduced-motion';
import { useShakeAnimation } from '@rn-motion-ui/hooks/use-shake-animation';
import { AnimatePresence } from '@rn-motion-ui/moti/presence';
import { MotiView } from '@rn-motion-ui/moti/view';
import { cva } from 'class-variance-authority';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import {
  Animated,
  type KeyboardTypeOptions,
  type StyleProp,
  Text,
  TextInput,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { Check } from '../../lib/icons';

// Success green mirrors the --color-success token (oklch(70% 0.18 155)); the
// icon takes a raw colour prop, so we can't drive it through a className.
const SUCCESS_COLOR = '#22c55e';
const PLACEHOLDER_COLOR = 'rgba(128,128,128,0.6)';

function resolveInputState(hasError: boolean, focused: boolean): 'error' | 'focused' | 'idle' {
  if (hasError) return 'error';
  if (focused) return 'focused';
  return 'idle';
}

// Border colour swaps by state; error wins over focus, focus over idle. Ring
// utilities from the web original are dropped (no box-shadow ring on RN).
const field = cva('relative h-11 flex-row items-center overflow-hidden rounded-full border', {
  variants: {
    state: {
      idle: 'border-border',
      focused: 'border-foreground/40',
      error: 'border-destructive',
    },
  },
  defaultVariants: { state: 'idle' },
});

// Padding shifts to make room for icon slots; cva keeps each class a static literal.
const inputBox = cva('h-full flex-1 bg-transparent text-base text-foreground', {
  variants: {
    left: { true: 'pl-10', false: 'pl-3.5' },
    right: { true: 'pr-10', false: 'pr-3.5' },
  },
  defaultVariants: { left: false, right: false },
});

export type InputProps = {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Truthy error triggers a shake, red border and (if a string) a message. */
  error?: string | boolean;
  success?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  disabled?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  onFocus?: () => void;
  onBlur?: () => void;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

export function Input({
  label,
  value: valueProp,
  defaultValue,
  onChange,
  placeholder,
  error,
  success,
  leftIcon,
  rightIcon,
  disabled,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  onFocus,
  onBlur,
  style,
  inputStyle,
  accessibilityLabel,
  testID,
}: InputProps) {
  const reduce = useReducedMotion();
  const controlled = valueProp !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const value = controlled ? (valueProp ?? '') : internal;
  const [focused, setFocused] = useState(false);
  const shakeX = useRef(new Animated.Value(0)).current;

  const hasError = Boolean(error);
  const errorMessage = typeof error === 'string' ? error : null;
  // Right edge shows the success check, otherwise the caller's right icon.
  const rightSlot = success ? null : rightIcon;
  const state = resolveInputState(hasError, focused);

  // Shake the field when an error appears (mirrors the web keyframe sequence).
  useShakeAnimation({ trigger: hasError, reduce, shakeX });

  const handleChange = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );

  const handleFocus = useCallback(() => {
    setFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    onBlur?.();
  }, [onBlur]);

  let rightElement: ReactNode = null;
  if (success)
    rightElement = (
      <MotiView
        style={{ pointerEvents: 'none' }}
        className="absolute top-0 right-3.5 bottom-0 items-center justify-center"
        from={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: reduce ? 0 : 250 }}
      >
        <Check size={20} color={SUCCESS_COLOR} strokeWidth={2.5} />
      </MotiView>
    );
  else if (rightSlot)
    rightElement = <View className="absolute top-0 right-3 bottom-0 z-10 items-center justify-center">{rightSlot}</View>;

  return (
    <View className="gap-1.5" style={style}>
      {label ? <Text className="px-1 font-medium text-foreground text-sm">{label}</Text> : null}

      <Animated.View className={field({ state })} style={{ opacity: disabled ? 0.6 : 1, transform: [{ translateX: shakeX }] }}>
        {leftIcon ? (
          <View style={{ pointerEvents: 'none' }} className="absolute top-0 bottom-0 left-3 z-10 items-center justify-center">
            {leftIcon}
          </View>
        ) : null}

        <TextInput
          value={value}
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor={PLACEHOLDER_COLOR}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onChangeText={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityLabel={accessibilityLabel ?? label}
          testID={testID ?? 'input'}
          className={inputBox({ left: Boolean(leftIcon), right: Boolean(rightSlot || success) })}
          style={inputStyle}
        />

        {rightElement}
      </Animated.View>

      <AnimatePresence initial={false}>
        {errorMessage ? (
          <MotiView
            key="error"
            from={reduce ? { opacity: 0 } : { opacity: 0, translateY: -4 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -4 }}
            transition={{ type: 'timing', duration: 200 }}
          >
            <Text accessibilityRole="alert" className="px-1 text-destructive text-xs">
              {errorMessage}
            </Text>
          </MotiView>
        ) : null}
      </AnimatePresence>
    </View>
  );
}
