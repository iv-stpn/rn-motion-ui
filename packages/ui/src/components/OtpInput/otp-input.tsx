/** biome-ignore-all lint/style/noExcessiveLinesPerFile: OtpSlot helper, editing logic imports, and shake/status animations need shared context in one file */
import { cva } from 'class-variance-authority';
import { useCallback, useRef, useState } from 'react';
import { Animated, Pressable, type StyleProp, TextInput, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { useShakeAnimation } from '../../hooks/use-shake-animation';
import { cn } from '../../lib/cn';
import { Check } from '../../lib/icons';
import { MotiText } from '../../moti/components/text';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { ThemedIcon } from '../Icon/themed-icon';
import { Text } from '../Text/text';
import { applyEdit, sanitize } from './otp-input.logic';

export type OTPStatus = 'idle' | 'error' | 'success';

// Success green mirrors the --color-success token; the icon takes a raw colour.

// biome-ignore lint/style/useExportsLast: props interface kept beside the component's other type declarations for readability
export type OTPInputProps = {
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
  /** Additional NativeWind class names merged onto the outer wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// Slightly tighter travel than Input (5/3/1 px) — the slot grid is smaller.
const OTP_SHAKE_STEPS = [-5, 5, -3, 3, -1, 0] as const;

// Slot border reflects one resolved state: success > error > active > filled > idle.
type SlotState = 'success' | 'error' | 'active' | 'filled' | 'idle';

const slot = cva('relative h-14 w-12 items-center justify-center overflow-hidden rounded-2xl border', {
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

type resolveHintTextParams = {
  showSuccess: boolean;
  successMessage: string | undefined;
  status: OTPStatus;
  errorMessage: string | undefined;
  hint: string | undefined;
};

function resolveHintText({ showSuccess, successMessage, status, errorMessage, hint }: resolveHintTextParams): string | undefined {
  if (showSuccess) return successMessage;
  if (status === 'error') return errorMessage;
  return hint;
}

function resolveSlotState(showSuccess: boolean, status: OTPStatus, isActive: boolean, char: string): SlotState {
  if (showSuccess) return 'success';
  if (status === 'error') return 'error';
  if (isActive) return 'active';
  if (char) return 'filled';
  return 'idle';
}

type OtpSlotProps = {
  index: number;
  char: string;
  state: SlotState;
  isActive: boolean;
  showSuccess: boolean;
  reduce: boolean;
  mask: boolean;
  disabled: boolean;
  testID: string;
  onPressSlot: (index: number) => void;
};

function OtpSlot({ index, char, state, isActive, showSuccess, reduce, mask, disabled, testID, onPressSlot }: OtpSlotProps) {
  const handlePress = useCallback(() => onPressSlot(index), [onPressSlot, index]);
  return (
    <Pressable
      disabled={disabled}
      onPress={handlePress}
      accessible={false}
      focusable={false}
      testID={`${testID}-slot-${index}`}
      className={slot({ state })}
    >
      {isActive && !char && !showSuccess && !reduce ? (
        // Blinking caret — vertically centred (slot 56, caret 24 → top 16),
        // shown only in an EMPTY active slot. A filled active slot signals
        // selection with its border alone: a caret trailing the digit would
        // read as "type into the next cell", but a keystroke overwrites this
        // one in place, so drawing it there is misleading.
        <MotiView
          from={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ type: 'timing', duration: 500, loop: true, repeatReverse: true }}
          className="pointer-events-none absolute top-[16px] left-[23px] h-6 w-px bg-foreground"
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
            className="absolute h-full w-full text-center font-semibold text-foreground text-xl"
            style={{ lineHeight: 56 }}
          >
            {/* biome-ignore lint/suspicious/noLeakedRender: both branches are string literals — no numeric leak */}
            {mask ? '•' : char}
          </MotiText>
        ) : null}
      </AnimatePresence>
    </Pressable>
  );
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: slot-rendering, keyboard handling, and shake animation need shared closure state
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
  className,
  style,
  testID,
}: OTPInputProps) {
  const reduce = useReducedMotion();
  const inputRef = useRef<TextInput>(null);
  const shakeX = useRef(new Animated.Value(0)).current;

  const controlled = controlledValue !== undefined;
  const [internal, setInternal] = useState(() => sanitize(controlled ? controlledValue : defaultValue, length));
  const [focused, setFocused] = useState(false);
  // The edit caret drives everything: which slot is active, where a keystroke
  // lands, and which slot a tap re-selects. Kept as a plain index (0..length)
  // and clamped to the current value on read, so an external value change can
  // never leave it dangling past the last digit.
  const [caret, setCaret] = useState(() => sanitize(controlled ? controlledValue : defaultValue, length).length);

  const value = controlled ? sanitize(controlledValue, length) : internal;
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');
  // Clamp: the caret can sit just past the last digit, but never beyond it.
  const clampedCaret = Math.min(caret, value.length);
  // Highlight the slot the next keystroke overwrites; at the trailing edge of a
  // full field that's the last slot.
  const activeIndex = focused ? Math.min(clampedCaret, length - 1) : -1;

  const handleChange = useCallback(
    (raw: string) => {
      if (disabled) return;
      // Diff the raw <input> string against the current value to recover what
      // was typed, then apply it with overwrite-in-place semantics (see
      // applyEdit). `clampedCaret` is the AUTHORITATIVE write anchor — the cell
      // the user tapped — so a single typed digit lands in that cell even when
      // RNW's controlled selection lets the DOM caret drift to the next slot.
      const { value: next, caret: nextCaret } = applyEdit(value, raw, length, clampedCaret);
      setCaret(nextCaret);
      if (next === value) return;
      if (!controlled) setInternal(next);
      onChange?.(next);
      // Fire on any change that yields a full-length code, not just the first
      // incomplete->complete transition. Retyping a slot of an already-complete
      // code keeps the value full while its content changes; that new code must
      // re-validate.
      if (next.length >= length) onComplete?.(next);
    },
    [disabled, value, length, controlled, onChange, onComplete, clampedCaret],
  );

  // Tapping a slot moves the edit point there (clamped to the filled region) and
  // opens the keyboard, so any cell can be re-selected and retyped — not just the
  // first empty one.
  const handlePressSlot = useCallback(
    (index: number) => {
      if (disabled) return;
      setCaret(Math.min(index, value.length));
      inputRef.current?.focus();
    },
    [disabled, value.length],
  );

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);

  // Error shake — replays on every transition into "error" (mirrors web keyframes).
  useShakeAnimation({ trigger: status === 'error', reduce, shakeX, steps: OTP_SHAKE_STEPS });

  const showSuccess = status === 'success';
  const text = resolveHintText({ showSuccess, successMessage, status, errorMessage, hint });

  return (
    <View className={cn('gap-2', className)} style={style}>
      {label ? <Text className="font-medium text-foreground text-sm">{label}</Text> : null}

      <View className="flex-row items-center self-start" style={{ opacity: disabled ? 0.5 : 1 }}>
        {/* Transparent input owns focus + the keyboard. No maxLength: a keystroke
            on a full field must still reach onChangeText so applyEdit can
            overwrite the active slot (maxLength would swallow it). It paints
            BELOW the slots (no zIndex) so slot taps win; focus is driven
            programmatically from each slot's onPress. */}
        <TextInput
          ref={inputRef}
          value={value}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          caretHidden={true}
          selection={focused ? { start: clampedCaret, end: clampedCaret } : undefined}
          onChangeText={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityLabel={accessibilityLabel}
          testID={testID ?? 'otp-input'}
          className="absolute inset-0 opacity-0"
        />

        {/* Slots paint above the input (relative + zIndex) so a tap lands on the
            Pressable, not the transparent input, letting us position the caret. */}
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
              mask={mask}
              disabled={disabled}
              testID={testID ?? 'otp-input'}
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
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className="pointer-events-none absolute top-[18px]"
              style={{ right: -28 }}
            >
              <ThemedIcon icon={Check} token="success-foreground" size={20} strokeWidth={3} />
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
