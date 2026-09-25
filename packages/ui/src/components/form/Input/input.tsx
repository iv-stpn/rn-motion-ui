import { cva } from 'class-variance-authority';
import { type ReactNode, type Ref, useCallback, useRef, useState } from 'react';
import type { KeyboardTypeOptions, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Animated, Platform, TextInput, View } from 'react-native';
import { CheckLine as Check } from 'rn-motion-ui-icons/icons/check-line';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { useShakeAnimation } from '../../../hooks/use-shake-animation';
import { cn } from '../../../lib/cn';
import { elevated as elevatedSurface, type SurfaceElevation } from '../../../lib/elevated';
import { INTERACTIVE_HEIGHT, INTERACTIVE_RADIUS } from '../../../lib/radius';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { TIMING_BASE } from '../../../theme/motion';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Surface } from '../../display/Surface/surface';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';
import { type InputType, resolveInputState, resolveInputTypeProps } from './input.logic';

// Success green and placeholder colour are resolved from the theme at runtime.

// Resolved corner radius in px for the Rim / blur clip — the field's `shape`
// class is a CSS token an SVG stroke cannot read back, so the effect layer needs
// the number. A square is sharp (`0`), `rounded` takes the shared interactive
// radius, and `pill` / `circle` round to half the single-line height — the same
// curve `rounded-full` draws.
function inputRadius(shape: 'square' | 'rounded' | 'pill' | 'circle', size: 'xs' | 'sm' | 'md' | 'lg'): number {
  if (shape === 'square') return 0;
  if (shape === 'rounded') return INTERACTIVE_RADIUS;
  return INTERACTIVE_HEIGHT[size] / 2;
}

// State drives the border colour, not a shadow: the field carries a border
// on web only while flat (`elevation` 0), tinted by state (border on idle,
// foreground on focus, danger on error); error wins over focus. Above 0 the
// `shadow-elevated-N` recipe already draws the dark-mode rim, so a border would
// double up. The fill and the float are *not* in this table — they come from the
// shared surface ladder (`elevation` + `floating`) and are merged on at the call
// site, exactly as every other surface does it.
const field = cva('relative flex-row items-center overflow-hidden', {
  variants: {
    size: {
      xs: 'min-h-interactive-xs',
      sm: 'min-h-interactive-sm',
      md: 'min-h-interactive-md',
      lg: 'min-h-interactive-lg',
    },
    shape: {
      square: 'rounded-none',
      rounded: 'rounded-interactive',
      pill: 'rounded-full',
      circle: 'rounded-full',
    },
  },
  defaultVariants: { size: 'md', shape: 'rounded' },
});

// The state-tinted border, applied only while the field is flat (elevation 0) —
// the ladder's `shadow-elevated-N` rim supersedes it above 0. Kept out of the
// cva so the call site can gate it on `elevation` without fighting cva's variant
// types.
const stateBorder = {
  idle: 'web:hairline web:border-border',
  focused: 'web:hairline web:border-foreground/40',
  error: 'web:hairline web:border-danger',
} as const;

// Size-aware input box: font size and padding track --spacing-interactive-* tokens.
// `font-sans-normal` is the same per-weight-family token the `Text` component
// resolves by default, so the typed value and the placeholder both use the app's
// custom typeface (e.g. Geist) instead of the platform's default font.
const inputBox = cva('flex-1 bg-transparent font-sans-normal text-foreground outline-none', {
  variants: {
    left: { true: 'pl-8', false: '' },
    right: { true: 'pr-8', false: '' },
    size: { xs: 'py-0.5 text-xs', sm: 'py-1 text-sm', md: 'py-1.5 text-base', lg: 'py-2 text-lg' },
  },
  compoundVariants: [
    { left: false, size: 'xs', class: 'pl-1.5' },
    { left: false, size: 'sm', class: 'pl-2' },
    { left: false, size: 'md', class: 'pl-2.5' },
    { left: false, size: 'lg', class: 'pl-3' },
    { right: false, size: 'xs', class: 'pr-1.5' },
    { right: false, size: 'sm', class: 'pr-2' },
    { right: false, size: 'md', class: 'pr-2.5' },
    { right: false, size: 'lg', class: 'pr-3' },
  ],
  defaultVariants: { left: false, right: false, size: 'md' },
});

type RightElementProps = { success?: boolean; rightSlot: ReactNode; reduce: boolean; successIcon?: ReactNode };
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

type FieldHostProps = {
  /** Pre-composed container classes — `field({size,shape})` + state border + disabled opacity. */
  className: string;
  elevation: SurfaceElevation;
  floating: boolean;
  blurRadius: number;
  opacity: number;
  rim: boolean;
  rimWidth?: number;
  intensity?: number;
  inline: boolean;
  /** Resolved corner radius in px for the Rim + blur clip (see `inputRadius`). */
  borderRadius: number;
  shakeX: Animated.Value;
  children: ReactNode;
};

// The field's container host. A frosted field (`blurRadius > 0`) renders through
// the shared `Surface` primitive, which owns the `glass` tint, backdrop blur and
// rim; a solid field wears the elevation ladder directly. Both carry the shake
// transform, so the two hosts stay pixel-identical apart from the frost.
function FieldHost({
  className,
  elevation,
  floating,
  blurRadius,
  opacity,
  rim,
  rimWidth,
  intensity,
  inline,
  borderRadius,
  shakeX,
  children,
}: FieldHostProps) {
  const style = { transform: [{ translateX: shakeX }] };
  if (blurRadius > 0) {
    // Spread the glass props as a pre-built object (rather than inline) so the
    // native-only `inline` prop doesn't trip the web Surface's excess-property
    // check — the same pattern Card uses.
    const surfaceProps = { elevation, floating, blurRadius, opacity, rim, rimWidth, intensity, inline, borderRadius };
    return (
      <Surface {...surfaceProps} as={Animated.View} className={className} style={style}>
        {children}
      </Surface>
    );
  }
  return (
    <Animated.View className={cn(className, elevatedSurface(elevation, elevation, floating))} style={style}>
      {children}
    </Animated.View>
  );
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
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /**
   * Swap the field's ladder shadow for the large, diffuse halo
   * (`shadow-floating`) — the recipe the old `variant="floating"` wore. It
   * replaces the `shadow-elevated-N` rung rather than adding to it, so the field
   * keeps its `elevation` tint but trades the layered drop for the halo.
   * @default false
   */
  floating?: boolean;
  /**
   * Surface elevation level (0–3) — drives the field fill (`bg-surface-N`) and
   * the `shadow-elevated-N` recipe. `0` is the flat resting surface — a
   * `surface-3` fill with no shadow — which is what a text field usually wants,
   * so unlike the panel surfaces this one rests at `0` rather than `3`. The
   * state-tinted web border is drawn only at `0`; above it the elevation shadow
   * already carries the rim. @default 0
   */
  elevation?: SurfaceElevation;
  /**
   * Border-radius variant. `square` for sharp corners, `rounded` (default, 8px)
   * for a standard input, `pill` / `circle` for a fully rounded shape.
   */
  shape?: 'square' | 'rounded' | 'pill' | 'circle';
  /**
   * Backdrop blur radius in px/dp. `0` keeps the field a solid surface; any
   * positive value frosts it — a `glass` tint over a backdrop blur, with the
   * specular edge light when `rim` is also set. @default 0
   */
  blurRadius?: number;
  /** Opacity of the frosted tint (0–1); only thins the fill when `blurRadius` is set. @default 1 */
  opacity?: number;
  /** Draw the glass edge light — the `Rim` specular ring around the field. @default false */
  rim?: boolean;
  /** Rim width in px/dp. @default 1 */
  rimWidth?: number;
  /** Peak alpha (0–1) of the rim's specular highlight — lower is subtler. @default 0.5 */
  intensity?: number;
  /**
   * Set true when the field renders inside the `BlurTarget` it blurs on Android
   * (a field in the page). An inline pane degrades to the tint fill rather than
   * crash. @default false
   */
  inline?: boolean;
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
  shape = 'rounded',
  blurRadius = 0,
  opacity = 1,
  rim = false,
  rimWidth,
  intensity,
  inline = false,
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
  const semantics = resolveInputTypeProps(inputType);
  const resolvedKeyboardType = keyboardType ?? semantics.keyboardType;
  const resolvedAutoCapitalize = autoCapitalize ?? semantics.autoCapitalize;
  const resolvedSecureTextEntry = secureTextEntry ?? semantics.secureTextEntry;

  const rightElement = renderRightElement({ success, rightSlot, reduce, successIcon });

  return (
    <View className={cn('gap-1.5', className)} style={style}>
      {label ? (
        <Text weight="medium" className={cn('px-1 text-foreground text-sm', labelClassName)}>
          {label}
        </Text>
      ) : null}

      <FieldHost
        className={cn(
          field({ size, shape }),
          // The state border is drawn only while flat: above elevation 0 the
          // shadow rim already carries the edge, so a border would double up.
          elevation === 0 && (!(blurRadius > 0 && rim) || state !== 'idle') && stateBorder[state],
          disabled ? 'opacity-60' : 'opacity-100',
        )}
        elevation={elevation}
        floating={floating}
        blurRadius={blurRadius}
        opacity={opacity}
        rim={rim}
        rimWidth={rimWidth}
        intensity={intensity}
        inline={inline}
        borderRadius={inputRadius(shape, size)}
        shakeX={shakeX}
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
          autoComplete={semantics.autoComplete}
          textContentType={semantics.textContentType}
          multiline={multiline}
          allowFontScaling={true}
          maxFontSizeMultiplier={1.45}
          clearButtonMode={Platform.OS === 'ios' && !multiline ? 'while-editing' : 'never'}
          onChangeText={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityLabel={accessibilityLabel ?? label}
          testID={testID ?? 'input'}
          className={cn(
            inputBox({ left: Boolean(leftIcon), right: Boolean(rightSlot || success), size }),
            !multiline && 'input-vcenter',
            inputClassName,
          )}
          style={inputStyle}
        />

        {rightElement}
      </FieldHost>

      <AnimatePresence initial={false}>{renderSubtext({ errorMessage, hint, reduce })}</AnimatePresence>
    </View>
  );
}
