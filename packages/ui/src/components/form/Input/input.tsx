import { cva } from 'class-variance-authority';
import { type ReactNode, type Ref, useCallback, useRef, useState } from 'react';
import {
  Animated,
  type KeyboardTypeOptions,
  Platform,
  type StyleProp,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { CheckLine as Check } from 'rn-motion-ui-icons/icons/check-line';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { useShakeAnimation } from '../../../hooks/use-shake-animation';
import { cn } from '../../../lib/cn';
import { elevated as elevatedSurface, type SurfaceElevation } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { TIMING_BASE } from '../../../theme/motion';
import { useThemeColor } from '../../../theme/use-theme-color';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';

// Success green and placeholder colour are resolved from the theme at runtime.

function resolveInputState(hasError: boolean, focused: boolean): 'error' | 'focused' | 'idle' {
  if (hasError) return 'error';
  if (focused) return 'focused';
  return 'idle';
}

// State drives the border colour, not a shadow: the field carries a 1px border
// on web only while flat (`elevation` 0), tinted by state (border on idle,
// foreground on focus, danger on error); error wins over focus. Above 0 the
// `shadow-elevated-N` recipe already draws the dark-mode rim, so a border would
// double up. The fill and the float are *not* in this table — they come from the
// shared surface ladder (`elevation` + `floating`) and are merged on at the call
// site, exactly as every other surface does it.
const field = cva('relative flex-row items-center overflow-hidden', {
  variants: {
    size: {
      sm: 'min-h-interactive-sm',
      md: 'min-h-interactive-md',
      lg: 'min-h-interactive-lg',
    },
    shape: {
      rounded: 'rounded-interactive',
      pill: 'rounded-full',
    },
  },
  defaultVariants: { size: 'md', shape: 'pill' },
});

// The state-tinted border, applied only while the field is flat (elevation 0) —
// the ladder's `shadow-elevated-N` rim supersedes it above 0. Kept out of the
// cva so the call site can gate it on `elevation` without fighting cva's variant
// types.
const stateBorder = {
  idle: 'web:border-[1.5px] web:border-border',
  focused: 'web:border-[1.5px] web:border-foreground/40',
  error: 'web:border-[1.5px] web:border-danger',
} as const;

// Size-aware input box: font size and padding track --spacing-interactive-* tokens.
// `font-sans-normal` is the same per-weight-family token the `Text` component
// resolves by default, so the typed value and the placeholder both use the app's
// custom typeface (e.g. Geist) instead of the platform's default font.
const inputBox = cva('flex-1 bg-transparent font-sans-normal text-foreground outline-none', {
  variants: {
    left: { true: 'pl-8', false: '' },
    right: { true: 'pr-8', false: '' },
    size: {
      sm: 'py-1 text-xs',
      md: 'py-1.5 text-sm',
      lg: 'py-2 text-base',
    },
  },
  compoundVariants: [
    { left: false, size: 'sm', class: 'pl-2' },
    { left: false, size: 'md', class: 'pl-2.5' },
    { left: false, size: 'lg', class: 'pl-3' },
    { right: false, size: 'sm', class: 'pr-2' },
    { right: false, size: 'md', class: 'pr-2.5' },
    { right: false, size: 'lg', class: 'pr-3' },
  ],
  defaultVariants: { left: false, right: false, size: 'md' },
});

/** Semantic input type — drives keyboard, autoComplete, and textContentType automatically. */
type InputType = 'text' | 'name' | 'email' | 'number' | 'otp' | 'password' | 'new-password' | 'phone';

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

// biome-ignore lint/plugin: 4-field props type is more readable across multiple lines
type RightElementProps = {
  success: boolean | undefined;
  rightSlot: ReactNode;
  reduce: boolean;
  successIcon?: ReactNode;
};
function renderRightElement({ success, rightSlot, reduce, successIcon }: RightElementProps): ReactNode {
  if (success)
    return (
      <MotiView
        className="pointer-events-none absolute top-0 right-2.5 bottom-0 items-center justify-center"
        from={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: reduce ? 0 : 250 }}
      >
        {successIcon ?? <ThemedIcon icon={Check} token="success-foreground" size={20} />}
      </MotiView>
    );
  if (rightSlot) return <View className="absolute top-0 right-2.5 bottom-0 z-10 items-center justify-center">{rightSlot}</View>;
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
        transition={TIMING_BASE}
      >
        <Text accessibilityRole="alert" className="px-1 text-danger text-xs">
          {errorMessage}
        </Text>
      </MotiView>
    );
  if (hint)
    return (
      <MotiView key="hint" from={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={TIMING_BASE}>
        <Text className="px-1 text-muted-foreground text-xs">{hint}</Text>
      </MotiView>
    );
  return null;
}

export type InputProps = {
  /** Ref forwarded to the underlying TextInput (React 19 direct-prop style). */
  ref?: Ref<TextInput>;
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
  /** Replace the success checkmark icon. Default: `<Check size={20} color={successColor} />`. */
  successIcon?: ReactNode;
  /** Semantic type — automatically wires keyboard, autoComplete, and textContentType. */
  inputType?: InputType;
  /** Field height variant. Default: `md`. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Swap the field's ladder shadow for the large, diffuse halo
   * (`shadow-floating`) — the recipe the old `variant="floating"` wore. It
   * replaces the `shadow-elevated-N` rung rather than adding to it, so the field
   * keeps its `elevation` tint but trades the layered drop for the halo.
   * @default false
   */
  floating?: boolean;
  /**
   * Surface elevation level (0–8) — drives the field fill (`bg-surface-N`) and
   * the `shadow-elevated-N` recipe. `0` is the flat resting surface — a
   * `surface-3` fill with no shadow — which is what a text field usually wants,
   * so unlike the panel surfaces this one rests at `0` rather than `3`. The
   * state-tinted web border is drawn only at `0`; above it the elevation shadow
   * already carries the rim. @default 0
   */
  elevation?: SurfaceElevation;
  /** Border-radius variant. `pill` (default) for a full-circle shape, `rounded` for a standard input. */
  shape?: 'rounded' | 'pill';
  disabled?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  /** UniWind class names merged onto the outer wrapper. */
  className?: string;
  /** UniWind class names merged onto the label Text. */
  labelClassName?: string;
  style?: StyleProp<ViewStyle>;
  /** UniWind class names applied to the TextInput element. */
  inputClassName?: string;
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
  invalid,
  hint,
  success,
  leftIcon,
  rightIcon,
  successIcon,
  inputType = 'text',
  size = 'md',
  floating = false,
  elevation = 0,
  shape = 'pill',
  disabled,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  multiline,
  autoFocus,
  onFocus,
  onBlur,
  className,
  labelClassName,
  style,
  inputClassName,
  inputStyle,
  accessibilityLabel,
  testID,
  ref,
}: InputProps) {
  const reduce = useReducedMotion();
  const placeholderColor = useThemeColor('muted-foreground');
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

  const rightElement = renderRightElement({ success, rightSlot, reduce, successIcon });

  return (
    <View className={cn('gap-1.5', className)} style={style}>
      {label ? (
        <Text weight="medium" className={cn('px-1 text-foreground text-sm', labelClassName)}>
          {label}
        </Text>
      ) : null}

      <Animated.View
        className={cn(
          field({ size, shape }),
          // The fill follows `elevation`; `floating` swaps that rung's shadow
          // for the diffuse halo. At the default `0` this is a bare
          // `bg-surface-3` — a flat field, as before. The state border is
          // drawn only at 0: above it the elevation shadow already carries the
          // rim, so a border would double up.
          elevation === 0 && stateBorder[state],
          elevatedSurface(elevation, elevation, floating),
          disabled ? 'opacity-60' : 'opacity-100',
        )}
        style={{ transform: [{ translateX: shakeX }] }}
      >
        {leftIcon ? (
          <View className="pointer-events-none absolute top-0 bottom-0 left-2.5 z-10 items-center justify-center">
            {leftIcon}
          </View>
        ) : null}

        <TextInput
          ref={setRef}
          value={value}
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
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
          className={cn(inputBox({ left: Boolean(leftIcon), right: Boolean(rightSlot || success), size }), inputClassName)}
          style={[{ textAlignVertical: 'center' }, Platform.OS === 'ios' && { lineHeight: 0 }, inputStyle]}
        />

        {rightElement}
      </Animated.View>

      <AnimatePresence initial={false}>{renderSubtext({ errorMessage, hint, reduce })}</AnimatePresence>
    </View>
  );
}
