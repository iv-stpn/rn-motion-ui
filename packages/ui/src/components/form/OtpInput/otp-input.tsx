/** biome-ignore-all lint/style/noExcessiveLinesPerFile: OtpSlot helper, editing logic imports, shake/status animations, and theme merging need shared context in one file */
import { cva } from 'class-variance-authority';
import { type Ref, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  type StyleProp,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { CheckLine as Check } from 'rn-motion-ui-icons/icons/check-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { useShakeAnimation } from '../../../hooks/use-shake-animation';
import { cn } from '../../../lib/cn';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';
import { applyEdit, sanitize } from './otp-input.logic';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_DIGITS = 6;
const DEFAULT_STICK_BLINK_MS = 500;
const DIGIT_DROP_MS = 220;
const SUCCESS_SPRING = { stiffness: 500, damping: 28 };
const OTP_SHAKE_STEPS = [-5, 5, -3, 3, -1, 0] as const;

// ── Slot styling ──────────────────────────────────────────────────────────────

type SlotState = 'success' | 'error' | 'active' | 'filled' | 'idle';

const slot = cva('relative h-interactive-lg w-interactive-lg items-center justify-center rounded-interactive border', {
  variants: {
    state: {
      success: 'border-success',
      error: 'border-danger/60',
      active: 'border-foreground',
      filled: 'border-foreground/40',
      idle: 'border-border',
    },
  },
  defaultVariants: { state: 'idle' },
});

const message = cva('text-sm', {
  variants: {
    status: {
      success: 'text-success-foreground',
      error: 'text-danger',
      idle: 'text-muted-foreground',
    },
  },
  defaultVariants: { status: 'idle' },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveSlotState(showSuccess: boolean, status: OtpInputStatus, isActive: boolean, char: string): SlotState {
  if (showSuccess) return 'success';
  if (status === 'error') return 'error';
  if (isActive) return 'active';
  if (char) return 'filled';
  return 'idle';
}

type ResolveHintTextParams = {
  showSuccess: boolean;
  successMessage: string | undefined;
  status: OtpInputStatus;
  errorMessage: string | undefined;
  hint: string | undefined;
};

function resolveHintText({ showSuccess, successMessage, status, errorMessage, hint }: ResolveHintTextParams): string | undefined {
  if (showSuccess) return successMessage;
  if (status === 'error') return errorMessage;
  return hint;
}

/** Repeat a single-char placeholder across all slots. */
function expandPlaceholder(raw: string | undefined, digits: number): string | undefined {
  if (!raw) return;
  return raw.length === 1 ? raw.repeat(digits) : raw;
}

// ── OtpSlot ───────────────────────────────────────────────────────────────────

type OtpSlotProps = {
  index: number;
  char: string;
  state: SlotState;
  isActive: boolean;
  showSuccess: boolean;
  reduce: boolean;
  secureTextEntry: boolean;
  disabled: boolean;
  testID: string;
  placeholderChar: string | undefined;
  focusColor: string | undefined;
  hideStick: boolean;
  stickBlinkMs: number;
  theme: OtpInputTheme;
  textProps: TextProps | undefined;
  onPressSlot: (index: number) => void;
};

function OtpSlot({
  index,
  char,
  state,
  isActive,
  showSuccess,
  reduce,
  secureTextEntry,
  disabled,
  testID,
  placeholderChar,
  focusColor,
  hideStick,
  stickBlinkMs,
  theme,
  textProps,
  onPressSlot,
}: OtpSlotProps) {
  const handlePress = useCallback(() => onPressSlot(index), [onPressSlot, index]);

  const slotClassName = slot({ state });

  const slotStyleOverrides = useMemo(() => {
    const styles: ViewStyle[] = [];
    if (theme.pinCodeContainerStyle) styles.push(theme.pinCodeContainerStyle);
    if (isActive && focusColor) styles.push({ borderColor: focusColor });
    if (isActive && theme.focusedPinCodeContainerStyle) styles.push(theme.focusedPinCodeContainerStyle);
    if (char && theme.filledPinCodeContainerStyle) styles.push(theme.filledPinCodeContainerStyle);
    if (disabled && theme.disabledPinCodeContainerStyle) styles.push(theme.disabledPinCodeContainerStyle);
    return styles;
  }, [isActive, focusColor, theme, char, disabled]);

  const displayChar = char && secureTextEntry ? '•' : char;
  const isPlaceholder = !char && Boolean(placeholderChar);

  const renderSlotContent = useCallback(() => {
    if (char)
      return (
        <MotiView
          key={char}
          from={reduce ? { opacity: 0 } : { opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -14 }}
          transition={{ type: 'timing', duration: reduce ? 0 : DIGIT_DROP_MS }}
          className="absolute inset-0 items-center justify-center overflow-hidden"
        >
          <Text
            {...textProps}
            testID={textProps?.testID ? `${textProps.testID}-${index}` : undefined}
            weight="semibold"
            className="text-foreground text-xl"
            style={theme.pinCodeTextStyle}
          >
            {displayChar}
          </Text>
        </MotiView>
      );
    if (isPlaceholder)
      return (
        <MotiView
          key={`ph-${index}`}
          from={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 items-center justify-center overflow-hidden"
        >
          <Text
            {...textProps}
            testID={textProps?.testID ? `${textProps.testID}-ph-${index}` : undefined}
            className="text-foreground/50 text-xl"
            style={[theme.pinCodeTextStyle, theme.placeholderTextStyle]}
          >
            {placeholderChar}
          </Text>
        </MotiView>
      );
    return null;
  }, [char, isPlaceholder, reduce, textProps, index, theme, displayChar, placeholderChar]);

  return (
    <Pressable
      disabled={disabled}
      onPress={handlePress}
      accessible={false}
      focusable={false}
      testID={`${testID}-slot-${index}`}
      className={slotClassName}
      style={slotStyleOverrides}
    >
      {/* Outline ring around the active slot so the selected cell is
          immediately obvious. Rendered as an absolutely-positioned sibling that
          extends beyond the slot bounds — overflow is only hidden on the
          animated content, not the slot itself. */}
      {isActive ? (
        <View className="pointer-events-none absolute -inset-px rounded-interactive border-2 border-foreground" />
      ) : null}

      {/* Blinking caret — shown only in an EMPTY active slot (with stick visible).
          Flexbox wrapper centres the stick; MotiView handles the blink. */}
      {isActive && !char && !showSuccess && !hideStick && !reduce ? (
        <View className="pointer-events-none absolute inset-0 items-center justify-center">
          <MotiView
            from={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ type: 'timing', duration: stickBlinkMs, loop: true, repeatReverse: true }}
            className="h-6 w-px bg-foreground"
            style={focusColor ? { backgroundColor: focusColor } : undefined}
          />
        </View>
      ) : null}

      <AnimatePresence>{renderSlotContent()}</AnimatePresence>
    </Pressable>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

export type OtpInputType = 'alpha' | 'numeric' | 'alphanumeric';
export type OtpInputStatus = 'idle' | 'error' | 'success';

export type OtpInputTheme = {
  containerStyle?: ViewStyle;
  pinCodeContainerStyle?: ViewStyle;
  filledPinCodeContainerStyle?: ViewStyle;
  focusedPinCodeContainerStyle?: ViewStyle;
  disabledPinCodeContainerStyle?: ViewStyle;
  pinCodeTextStyle?: TextStyle;
  focusStickStyle?: ViewStyle;
  placeholderTextStyle?: TextStyle;
};

export type OtpInputRef = { clear: () => void; focus: () => void; setValue: (value: string) => void; blur: () => void };

export type OtpInputProps = {
  // ── Reference library API ──
  numberOfDigits?: number;
  autoFocus?: boolean;
  focusColor?: string;
  onTextChange?: (text: string) => void;
  onFilled?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  blurOnFilled?: boolean;
  hideStick?: boolean;
  focusStickBlinkingDuration?: number;
  secureTextEntry?: boolean;
  theme?: OtpInputTheme;
  disabled?: boolean;
  textInputProps?: TextInputProps;
  textProps?: TextProps;
  type?: OtpInputType;
  placeholder?: string;

  // ── Extended API (beyond the reference library) ──
  /** Controlled value. */
  value?: string;
  /** Uncontrolled default value. */
  defaultValue?: string;
  /** External validation feedback. "error" shakes, "success" draws a check. */
  status?: OtpInputStatus;
  label?: string;
  /** Helper text shown below the slots while idle. */
  hint?: string;
  successMessage?: string;
  errorMessage?: string;
  /** Additional UniWind class names merged onto the outer wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;

  // React 19 ref prop
  ref?: Ref<OtpInputRef>;
};

// ── OTPInput ──────────────────────────────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: slot rendering, keyboard handling, shake animation, and theme merging need shared closure state
export function OTPInput({
  // Reference API
  numberOfDigits = DEFAULT_DIGITS,
  autoFocus = false,
  focusColor,
  onTextChange,
  onFilled,
  onFocus,
  onBlur,
  blurOnFilled,
  hideStick = false,
  focusStickBlinkingDuration,
  secureTextEntry = false,
  theme = {},
  disabled = false,
  textInputProps,
  textProps,
  type = 'numeric',
  placeholder,
  // Extended API
  value: controlledValue,
  defaultValue = '',
  status = 'idle',
  label,
  hint,
  successMessage,
  errorMessage,
  className,
  style,
  testID,
  accessibilityLabel = 'One-time passcode',
  ref,
}: OtpInputProps) {
  const reduce = useReducedMotion();
  const inputRef = useRef<TextInput>(null);
  const shakeX = useRef(new Animated.Value(0)).current;

  const controlled = controlledValue !== undefined;
  const [internal, setInternal] = useState(() => sanitize(controlled ? controlledValue : defaultValue, numberOfDigits, type));
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(() => sanitize(controlled ? controlledValue : defaultValue, numberOfDigits, type).length);

  const value = controlled ? sanitize(controlledValue, numberOfDigits, type) : internal;
  const chars = Array.from({ length: numberOfDigits }, (_, i) => value[i] ?? '');
  const clampedCaret = Math.min(caret, value.length);
  const activeIndex = focused ? Math.min(clampedCaret, numberOfDigits - 1) : -1;
  const expandedPlaceholder = useMemo(() => expandPlaceholder(placeholder, numberOfDigits), [placeholder, numberOfDigits]);

  // ── Imperative handle ──
  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        setInternal('');
        setCaret(0);
        inputRef.current?.focus();
      },
      focus: () => inputRef.current?.focus(),
      setValue: (next: string) => {
        const v = sanitize(next, numberOfDigits, type);
        if (!controlled) setInternal(v);
        setCaret(v.length);
        onTextChange?.(v);
        if (v.length >= numberOfDigits) onFilled?.(v);
      },
      blur: () => inputRef.current?.blur(),
    }),
    [controlled, numberOfDigits, type, onTextChange, onFilled],
  );

  // ── Editing ──
  const handleChange = useCallback(
    (raw: string) => {
      if (disabled) return;
      const { value: next, caret: nextCaret } = applyEdit({
        prev: value,
        raw,
        length: numberOfDigits,
        anchor: clampedCaret,
        type,
      });
      setCaret(nextCaret);
      if (next === value) return;
      if (!controlled) setInternal(next);
      onTextChange?.(next);
      if (next.length >= numberOfDigits) {
        onFilled?.(next);
        if (blurOnFilled) inputRef.current?.blur();
      }
    },
    [disabled, value, numberOfDigits, controlled, onTextChange, onFilled, blurOnFilled, clampedCaret, type],
  );

  const handlePressSlot = useCallback(
    (index: number) => {
      if (disabled) return;
      setCaret(Math.min(index, value.length));
      inputRef.current?.focus();
    },
    [disabled, value.length],
  );

  const handleFocus = useCallback(() => {
    setFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    onBlur?.();
  }, [onBlur]);

  // ── Animations ──
  useShakeAnimation({ trigger: status === 'error', reduce, shakeX, steps: OTP_SHAKE_STEPS });
  const stickBlinkMs = focusStickBlinkingDuration ?? (reduce ? 0 : DEFAULT_STICK_BLINK_MS);

  const showSuccess = status === 'success';
  const hintText = resolveHintText({ showSuccess, successMessage, status, errorMessage, hint });

  return (
    <View className={cn('gap-2', className)} style={[theme.containerStyle, style]}>
      {label ? (
        <Text weight="medium" className="text-foreground text-sm">
          {label}
        </Text>
      ) : null}

      <View className="flex-row items-center self-start" style={{ opacity: disabled ? 0.5 : 1 }}>
        {/* Hidden input owns focus + keyboard. No maxLength: a keystroke on a full
            field must still reach onChangeText so applyEdit can overwrite the active
            slot (maxLength would swallow it). It sits BELOW the slots so slot taps win;
            focus is driven programmatically from each slot's onPress. */}
        <TextInput
          ref={inputRef}
          value={value}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType={type === 'numeric' ? 'number-pad' : 'default'}
          inputMode={type === 'numeric' ? 'numeric' : 'text'}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          caretHidden={true}
          selection={focused ? { start: clampedCaret, end: clampedCaret } : undefined}
          onChangeText={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityLabel={accessibilityLabel}
          testID={testID ?? 'otp-input'}
          {...textInputProps}
          className="absolute inset-0 opacity-0"
        />

        {/* Slots paint above the input (relative + zIndex) so a tap lands on the
            Pressable, not the hidden input, letting us position the caret. */}
        <Animated.View className="relative z-[1] flex-row items-center gap-2" style={{ transform: [{ translateX: shakeX }] }}>
          {chars.map((char, i) => (
            <OtpSlot
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length slot grid, never reordered.
              key={i}
              index={i}
              char={char}
              state={resolveSlotState(showSuccess, status, i === activeIndex, char)}
              isActive={i === activeIndex}
              showSuccess={showSuccess}
              reduce={reduce}
              secureTextEntry={secureTextEntry}
              disabled={disabled}
              testID={testID ?? 'otp-input'}
              placeholderChar={expandedPlaceholder?.[i]}
              focusColor={focusColor}
              hideStick={hideStick}
              stickBlinkMs={stickBlinkMs}
              theme={theme}
              textProps={textProps}
              onPressSlot={handlePressSlot}
            />
          ))}
        </Animated.View>

        <AnimatePresence>
          {showSuccess ? (
            <MotiView
              key="success"
              from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', ...SUCCESS_SPRING }}
              className="pointer-events-none absolute top-[14px]"
              style={{ right: -28 }}
            >
              <ThemedIcon icon={Check} token="success-foreground" size={20} />
            </MotiView>
          ) : null}
        </AnimatePresence>
      </View>

      {hintText ? (
        <Text accessibilityLiveRegion="polite" className={message({ status: showSuccess ? 'success' : status })}>
          {hintText}
        </Text>
      ) : null}
    </View>
  );
}
