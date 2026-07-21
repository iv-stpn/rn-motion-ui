import { cva } from 'class-variance-authority';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import {
  Animated,
  type KeyboardTypeOptions,
  Platform,
  type StyleProp,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { useMountEffect } from '../../hooks/use-mount-effect';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { useShakeAnimation } from '../../hooks/use-shake-animation';
import { cn } from '../../lib/cn';
import { Check } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';

// Success green mirrors the --color-success token (oklch(70% 0.18 155)); the
// icon takes a raw colour prop, so we can't drive it through a className.
const SUCCESS_COLOR = '#22c55e';
const PLACEHOLDER_COLOR = 'rgba(128,128,128,0.6)';

function resolveInputState(hasError: boolean, focused: boolean): 'error' | 'focused' | 'idle' {
  if (hasError) return 'error';
  if (focused) return 'focused';
  return 'idle';
}

// Border colour swaps by state; error wins over focus, focus over idle.
const field = cva('relative flex-row items-center overflow-hidden border', {
  variants: {
    state: {
      idle: 'border-border',
      focused: 'border-foreground/40',
      error: 'border-destructive',
    },
    size: {
      sm: 'h-9',
      md: 'h-11',
      lg: 'h-13',
    },
    shape: {
      rounded: 'rounded-xl',
      pill: 'rounded-full',
    },
  },
  defaultVariants: { state: 'idle', size: 'md', shape: 'rounded' },
});

// Padding shifts to make room for icon slots.
const inputBox = cva('h-full flex-1 bg-transparent text-base text-foreground', {
  variants: {
    left: { true: 'pl-10', false: 'pl-3.5' },
    right: { true: 'pr-10', false: 'pr-3.5' },
  },
  defaultVariants: { left: false, right: false },
});

/** Semantic input type — drives keyboard, autoComplete, and textContentType automatically. */
export type InputType = 'text' | 'name' | 'email' | 'number' | 'otp' | 'password' | 'new-password' | 'phone';

const autocompleteMap: Partial<Record<InputType, TextInputProps['autoComplete']>> = {
  name: 'name',
  email: 'email',
  otp: 'one-time-code',
  'new-password': 'new-password',
  password: 'password',
  phone: 'tel',
};

const keyboardTypeMap: Partial<Record<InputType, KeyboardTypeOptions>> = {
  number: 'numeric',
  otp: 'number-pad',
  email: 'email-address',
  phone: 'phone-pad',
};

const textContentTypeMap: Partial<Record<InputType, TextInputProps['textContentType']>> = {
  name: 'name',
  email: 'emailAddress',
  otp: 'oneTimeCode',
  'new-password': 'newPassword',
  password: 'password',
  phone: 'telephoneNumber',
};

export type InputProps = {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Truthy error triggers a shake, red border and (if a string) a message. */
  error?: string | boolean;
  /** Show the error border without a message. Useful when validation is shown elsewhere. */
  invalid?: boolean;
  /** Helper text shown below the field (hidden when an error is present). */
  hint?: string;
  success?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** Semantic type — automatically wires keyboard, autoComplete, and textContentType. */
  inputType?: InputType;
  /** Field height variant. Default: `md`. */
  size?: 'sm' | 'md' | 'lg';
  /** Border-radius variant. `rounded` (default) for a standard input, `pill` for a full-circle shape. */
  shape?: 'rounded' | 'pill';
  disabled?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  /** NativeWind class names merged onto the outer wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** NativeWind class names applied to the TextInput element. */
  inputClassName?: string;
  inputStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
  /** Ref forwarded to the underlying TextInput (React 19 direct-prop style). */
  ref?: React.Ref<TextInput>;
};

type RightElementProps = { success: boolean | undefined; rightSlot: ReactNode; reduce: boolean };
function renderRightElement({ success, rightSlot, reduce }: RightElementProps): ReactNode {
  if (success)
    return (
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
  if (rightSlot) return <View className="absolute top-0 right-3 bottom-0 z-10 items-center justify-center">{rightSlot}</View>;
  return null;
}

type SubtextProps = { errorMessage: string | null; hint: string | undefined; reduce: boolean };
function renderSubtext({ errorMessage, hint, reduce }: SubtextProps): ReactNode {
  if (errorMessage)
    return (
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
    );
  if (hint)
    return (
      <MotiView
        key="hint"
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'timing', duration: 200 }}
      >
        <Text className="px-1 text-muted-foreground text-xs">{hint}</Text>
      </MotiView>
    );
  return null;
}

export function Input({
  label,
  value: valueProp,
  defaultValue,
  onChange,
  placeholder,
  error,
  invalid,
  hint,
  success,
  leftIcon,
  rightIcon,
  inputType = 'text',
  size = 'md',
  shape = 'rounded',
  disabled,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  multiline,
  autoFocus,
  onFocus,
  onBlur,
  className,
  style,
  inputClassName,
  inputStyle,
  accessibilityLabel,
  testID,
  ref,
}: InputProps) {
  const reduce = useReducedMotion();
  const controlled = valueProp !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const value = controlled ? (valueProp ?? '') : internal;
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const shakeX = useRef(new Animated.Value(0)).current;

  const hasError = Boolean(error) || Boolean(invalid);
  const errorMessage = typeof error === 'string' ? error : null;
  // Right edge shows the success check, otherwise the caller's right icon.
  const rightSlot = success ? null : rightIcon;
  const state = resolveInputState(hasError, focused);

  // Shake the field when an error appears (mirrors the web keyframe sequence).
  useShakeAnimation({ trigger: hasError, reduce, shakeX });

  // Sync the forwarded ref with the internal ref.
  const setRef = useCallback(
    (node: TextInput | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref !== null && typeof ref === 'object' && Object.hasOwn(ref, 'current')) ref.current = node;
    },
    [ref],
  );

  // Auto-focus after mount, matching browser behaviour.
  useMountEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  });

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

  // Resolve inputType-driven props (caller can still override individually).
  const resolvedKeyboardType = keyboardType ?? keyboardTypeMap[inputType];
  const resolvedAutoCapitalize = autoCapitalize ?? (inputType === 'name' || inputType === 'text' ? 'sentences' : 'none');
  const resolvedSecureTextEntry = secureTextEntry ?? (inputType === 'password' || inputType === 'new-password');

  const rightElement = renderRightElement({ success, rightSlot, reduce });

  return (
    <View className={cn('gap-1.5', className)} style={style}>
      {label ? <Text className="px-1 font-medium text-foreground text-sm">{label}</Text> : null}

      <Animated.View
        className={field({ state, size, shape })}
        style={{ opacity: disabled ? 0.6 : 1, transform: [{ translateX: shakeX }] }}
      >
        {leftIcon ? (
          <View style={{ pointerEvents: 'none' }} className="absolute top-0 bottom-0 left-3 z-10 items-center justify-center">
            {leftIcon}
          </View>
        ) : null}

        <TextInput
          ref={setRef}
          value={value}
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor={PLACEHOLDER_COLOR}
          secureTextEntry={resolvedSecureTextEntry}
          keyboardType={resolvedKeyboardType}
          autoCapitalize={resolvedAutoCapitalize}
          autoComplete={autocompleteMap[inputType]}
          textContentType={textContentTypeMap[inputType]}
          multiline={multiline}
          allowFontScaling={true}
          maxFontSizeMultiplier={1.45}
          clearButtonMode={Platform.OS === 'ios' && !multiline ? 'while-editing' : 'never'}
          onChangeText={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityLabel={accessibilityLabel ?? label}
          testID={testID ?? 'input'}
          className={cn(inputBox({ left: Boolean(leftIcon), right: Boolean(rightSlot || success) }), inputClassName)}
          style={inputStyle}
        />

        {rightElement}
      </Animated.View>

      <AnimatePresence initial={false}>{renderSubtext({ errorMessage, hint, reduce })}</AnimatePresence>
    </View>
  );
}
