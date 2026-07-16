import { cva } from 'class-variance-authority';
import { AnimatePresence, MotiText, MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { Animated, type StyleProp, Text, TextInput, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { Check } from '../../lib/icons';

export type OTPStatus = 'idle' | 'error' | 'success';

// Success green mirrors the --color-success token; the icon takes a raw colour.
const SUCCESS_COLOR = '#22c55e';

export interface OTPInputProps {
  /** Number of slots. Default 6. */
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Fires once every slot is filled. */
  onComplete?: (value: string) => void;
  label?: string;
  /** Helper text shown below the slots while idle. */
  hint?: string;
  successMessage?: string;
  errorMessage?: string;
  /** External validation feedback. "error" shakes, "success" draws a check. */
  status?: OTPStatus;
  /** Render dots instead of the typed digits. */
  mask?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Slot border reflects one resolved state: success > error > active > filled > idle.
const slot = cva('relative h-14 w-12 items-center justify-center overflow-hidden rounded-xl border', {
  variants: {
    state: {
      success: 'border-success/60',
      error: 'border-destructive/60',
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
      success: 'text-success',
      error: 'text-destructive',
      idle: 'text-muted-foreground',
    },
  },
  defaultVariants: { status: 'idle' },
});

function sanitize(raw: string, length: number) {
  return raw.replace(/\D/g, '').slice(0, length);
}

export function OTPInput({
  length = 6,
  value: controlledValue,
  defaultValue = '',
  onChange,
  onComplete,
  label,
  hint,
  successMessage,
  errorMessage,
  status = 'idle',
  mask = false,
  disabled = false,
  autoFocus = false,
  accessibilityLabel = 'One-time passcode',
  style,
  testID,
}: OTPInputProps) {
  const reduce = useReducedMotion();
  const inputRef = useRef<TextInput>(null);
  const shakeX = useRef(new Animated.Value(0)).current;

  const controlled = controlledValue !== undefined;
  const [internal, setInternal] = useState(() => sanitize(controlled ? controlledValue : defaultValue, length));
  const [focused, setFocused] = useState(false);

  // RN fallback: the web keeps a fixed-length array so a cleared MIDDLE slot stays
  // an in-place hole (native keydown preventDefault). RN's TextInput has no
  // reliable keydown intercept, so the value is a left-packed string and the
  // active slot is always the first empty one — matching mobile OTP fields.
  const value = controlled ? sanitize(controlledValue, length) : internal;
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');
  const activeIndex = focused ? Math.min(value.length, length - 1) : -1;

  const commit = (next: string) => {
    const wasComplete = value.length >= length;
    if (!controlled) setInternal(next);
    onChange?.(next);
    if (!wasComplete && next.length >= length) onComplete?.(next);
  };

  const handleChange = (raw: string) => {
    if (disabled) return;
    commit(sanitize(raw, length));
  };

  // Error shake — replays on every transition into "error" (mirrors web keyframes).
  useEffect(() => {
    if (status !== 'error' || reduce) return;
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -5, duration: 65, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 5, duration: 65, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -3, duration: 65, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 3, duration: 65, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -1, duration: 65, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 65, useNativeDriver: true }),
    ]).start();
  }, [status, reduce, shakeX]);

  const showSuccess = status === 'success';
  const text = showSuccess ? successMessage : status === 'error' ? errorMessage : hint;

  return (
    <View className="gap-2" style={style}>
      {label ? <Text className="text-sm font-medium text-foreground">{label}</Text> : null}

      <View className="flex-row items-center self-start" style={{ opacity: disabled ? 0.5 : 1 }}>
        {/* Transparent input owns focus + the keyboard; slots are presentational. */}
        <TextInput
          ref={inputRef}
          value={value}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          caretHidden
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={accessibilityLabel}
          testID={testID ?? 'otp-input'}
          style={{ position: 'absolute', inset: 0, opacity: 0, zIndex: 20 }}
        />

        <Animated.View className="flex-row items-center gap-2" style={{ transform: [{ translateX: shakeX }] }}>
          {chars.map((char, i) => {
            const isActive = i === activeIndex;
            const state = showSuccess
              ? 'success'
              : status === 'error'
                ? 'error'
                : isActive
                  ? 'active'
                  : char
                    ? 'filled'
                    : 'idle';
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length slot grid, never reordered.
              <View key={i} className={slot({ state })}>
                {isActive && !showSuccess && !reduce ? (
                  // Blinking caret — vertically centred (slot 56, caret 24 → top 16),
                  // trailing the digit when filled, centred in an empty slot.
                  <MotiView
                    pointerEvents="none"
                    from={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ type: 'timing', duration: 500, loop: true, repeatReverse: true }}
                    className="absolute h-6 w-px bg-foreground"
                    style={char ? { top: 16, right: 10 } : { top: 16, left: 23 }}
                  />
                ) : null}

                <AnimatePresence>
                  {char ? (
                    // Absolutely centred so enter/exit overlap in place — no reflow.
                    <MotiText
                      key={char}
                      from={reduce ? { opacity: 0 } : { opacity: 0, translateY: 14 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -14 }}
                      transition={{ type: 'timing', duration: reduce ? 0 : 220 }}
                      className="text-xl font-semibold text-foreground"
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        textAlign: 'center',
                        lineHeight: 56,
                      }}
                    >
                      {mask ? '•' : char}
                    </MotiText>
                  ) : null}
                </AnimatePresence>
              </View>
            );
          })}
        </Animated.View>

        <AnimatePresence>
          {showSuccess ? (
            <MotiView
              key="success"
              pointerEvents="none"
              from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className="absolute"
              style={{ right: -28, top: 18 }}
            >
              <Check size={20} color={SUCCESS_COLOR} strokeWidth={3} />
            </MotiView>
          ) : null}
        </AnimatePresence>
      </View>

      {text ? (
        <Text accessibilityLiveRegion="polite" className={message({ status: showSuccess ? 'success' : status })}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}
