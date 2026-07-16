import { cva, type VariantProps } from 'class-variance-authority';
import { AnimatePresence, MotiText, MotiView } from 'moti';
import { type ReactNode, useCallback, useState } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { EASE_IN_OUT, EASE_OUT, SPRING_PRESS, SPRING_SWAP } from '../../lib/ease';

export type ActionSwapItem = {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  ariaLabel?: string;
};

export type ActionSwapButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ActionSwapButtonSize = 'sm' | 'md' | 'lg' | 'icon';
export type ActionSwapAnimation = 'blur' | 'roll' | 'cascade';

/** Animations with a single-element variant set (cascade animates per letter). */
type CoreAnimation = 'blur' | 'roll';

// RN FALLBACK vs web: the web variants animate a CSS `filter: blur()` alongside
// opacity/transform. React Native has no animatable blur, so we drop the filter
// and keep the opacity + scale/translate motion (the readable part of the swap).
// The web `width` tween on the text slot is also dropped — the slot snaps to the
// new label width (RN doesn't auto-animate layout). Timing/spring feel is kept.
const BLUR_TRANSITION = { type: 'timing', duration: 200, easing: EASE_IN_OUT } as const;
const BLUR_EXIT = { type: 'timing', duration: 200, easing: EASE_IN_OUT } as const;
const ROLL_TRANSITION = { type: 'timing', duration: 240, easing: EASE_OUT } as const;
const ROLL_EXIT = { type: 'timing', duration: 180, easing: EASE_IN_OUT } as const;

// Cascade rolls the label one letter at a time, left to right.
const CASCADE_STAGGER = 25; // ms between letters
const CASCADE_EXIT = { type: 'timing', duration: 160, easing: EASE_OUT } as const;

// Fallback roll distance before the slot has been measured (px).
const ROLL_FALLBACK = 18;

const container = cva('flex-row items-center justify-center overflow-hidden font-medium', {
  variants: {
    variant: {
      primary: 'bg-primary',
      secondary: 'border border-border bg-card',
      outline: 'border border-border bg-transparent',
      ghost: 'bg-transparent',
    },
    size: {
      sm: 'h-8 gap-1.5 rounded-full px-3',
      md: 'h-10 gap-2 rounded-full px-4',
      lg: 'h-12 gap-2.5 rounded-full px-5',
      icon: 'h-10 w-10 rounded-full',
    },
  },
  defaultVariants: { variant: 'secondary', size: 'md' },
});

const labelClass = cva('font-medium', {
  variants: {
    variant: {
      primary: 'text-primary-foreground',
      secondary: 'text-foreground',
      outline: 'text-foreground',
      ghost: 'text-muted-foreground',
    },
    size: { sm: 'text-xs', md: 'text-sm', lg: 'text-base', icon: 'text-sm' },
  },
  defaultVariants: { variant: 'secondary', size: 'md' },
});

export interface ActionSwapTextProps {
  value: string;
  children: ReactNode;
  animation?: ActionSwapAnimation;
  /** Applied to the outer measured slot. */
  style?: StyleProp<ViewStyle>;
  /** Applied to the rendered text (colour/size/weight). */
  textClassName?: string;
  testID?: string;
}

export interface ActionSwapIconProps {
  value: string;
  children: ReactNode;
  animation?: ActionSwapAnimation;
  /** Square edge of the icon slot in px. Default 16. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface ActionSwapButtonProps extends VariantProps<typeof container> {
  items: ActionSwapItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, item: ActionSwapItem) => void;
  animation?: ActionSwapAnimation;
  iconOnly?: boolean;
  /** Advance to the next item on press. Default true. */
  cycle?: boolean;
  disabled?: boolean;
  /** Scale the button settles to while pressed. */
  pressScale?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function ActionSwapText({
  value,
  children,
  animation = 'blur',
  style,
  textClassName = 'text-foreground',
  testID,
}: ActionSwapTextProps) {
  const reduce = useReducedMotion();
  const [rollHeight, setRollHeight] = useState(0);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h && h !== rollHeight) setRollHeight(h);
    },
    [rollHeight],
  );

  // Cascade needs a plain string to split into letters; non-string content and
  // reduced motion fall back to the closest single-element animation (roll).
  const label = typeof children === 'string' ? children : null;
  const cascade = animation === 'cascade' && label !== null && !reduce;
  const core: CoreAnimation = animation === 'cascade' ? 'roll' : animation;
  const roll = rollHeight || ROLL_FALLBACK;

  if (reduce) {
    return (
      <View testID={testID} style={style}>
        {label !== null ? <Text className={textClassName}>{label}</Text> : children}
      </View>
    );
  }

  return (
    <View testID={testID} style={[{ overflow: 'hidden' }, style]}>
      {/* Hidden sizer establishes the slot width/height for the current label.
          String labels size a Text; arbitrary nodes size a wrapping View. */}
      {label !== null ? (
        <Text className={textClassName} onLayout={onLayout} style={{ opacity: 0 }} importantForAccessibility="no">
          {label}
        </Text>
      ) : (
        <View onLayout={onLayout} style={{ opacity: 0 }} importantForAccessibility="no">
          {children}
        </View>
      )}
      {cascade && label !== null ? (
        <AnimatePresence initial={false}>
          <MotiView
            key={`cascade-${value}`}
            from={{ opacity: 1, translateY: 0 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: -roll }}
            transition={CASCADE_EXIT}
            style={{ position: 'absolute', left: 0, top: 0, flexDirection: 'row' }}
          >
            {Array.from(label).map((char, i) => (
              <MotiText
                // biome-ignore lint/suspicious/noArrayIndexKey: position is the slot identity — the letter at a position is what rolls.
                key={i}
                className={textClassName}
                from={{ opacity: 0, translateY: roll }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ ...SPRING_SWAP, delay: i * CASCADE_STAGGER }}
              >
                {char === ' ' ? ' ' : char}
              </MotiText>
            ))}
          </MotiView>
        </AnimatePresence>
      ) : (
        <AnimatePresence initial={false}>
          <MotiView
            key={`${animation}-${value}`}
            from={core === 'blur' ? { opacity: 0, scale: 0.94 } : { opacity: 0, translateY: roll }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            exit={core === 'blur' ? { opacity: 0, scale: 0.94 } : { opacity: 0, translateY: -roll }}
            transition={core === 'blur' ? BLUR_TRANSITION : ROLL_TRANSITION}
            exitTransition={core === 'blur' ? BLUR_EXIT : ROLL_EXIT}
            style={{ position: 'absolute', left: 0, top: 0 }}
          >
            {label !== null ? <Text className={textClassName}>{label}</Text> : children}
          </MotiView>
        </AnimatePresence>
      )}
    </View>
  );
}
export function ActionSwapIcon({ value, children, animation = 'blur', size = 16, style, testID }: ActionSwapIconProps) {
  const reduce = useReducedMotion();
  // Icons are single elements — cascade maps to its closest motion, roll.
  const core: CoreAnimation = animation === 'cascade' ? 'roll' : animation;

  if (reduce) {
    return (
      <View
        testID={testID}
        style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      testID={testID}
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}
    >
      <AnimatePresence initial={false}>
        <MotiView
          key={`${animation}-${value}`}
          from={core === 'blur' ? { opacity: 0, scale: 0.25 } : { opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          exit={core === 'blur' ? { opacity: 0, scale: 0.25 } : { opacity: 0, translateY: -16 }}
          transition={core === 'blur' ? BLUR_TRANSITION : ROLL_TRANSITION}
          exitTransition={core === 'blur' ? BLUR_EXIT : ROLL_EXIT}
          style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}
        >
          {children}
        </MotiView>
      </AnimatePresence>
    </View>
  );
}

export function ActionSwapButton({
  items,
  value,
  defaultValue,
  onValueChange,
  variant = 'secondary',
  size = 'md',
  animation = 'blur',
  iconOnly = size === 'icon',
  cycle = true,
  disabled,
  pressScale = 0.97,
  style,
  accessibilityLabel,
  testID,
}: ActionSwapButtonProps) {
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.id);
  const currentValue = value ?? internalValue;
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === currentValue),
  );
  const activeItem = items[activeIndex] ?? items[0];
  const hasIcon = items.some((item) => item.icon);
  const nextItem = cycle && items.length > 0 ? items[(activeIndex + 1) % items.length] : undefined;

  if (!activeItem) return null;

  const accessibleLabel =
    accessibilityLabel ??
    activeItem.ariaLabel ??
    (iconOnly && typeof activeItem.label === 'string' ? activeItem.label : undefined);

  return (
    <MotiView
      animate={{ scale: pressed && !reduce && !disabled ? pressScale : 1 }}
      transition={SPRING_PRESS}
      style={style}
    >
      <Pressable
        accessibilityRole="button"
        aria-disabled={!!disabled}
        accessibilityLabel={accessibleLabel}
        testID={testID ?? 'action-swap-button'}
        disabled={disabled}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={() => {
          if (disabled || !cycle || !nextItem) return;
          if (value === undefined) setInternalValue(nextItem.id);
          onValueChange?.(nextItem.id, nextItem);
        }}
        className={container({ variant, size })}
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        {hasIcon ? (
          <ActionSwapIcon value={activeItem.id} animation={animation} size={16}>
            {activeItem.icon ?? null}
          </ActionSwapIcon>
        ) : null}
        {!iconOnly ? (
          <ActionSwapText value={activeItem.id} animation={animation} textClassName={labelClass({ variant, size })}>
            {activeItem.label}
          </ActionSwapText>
        ) : null}
      </Pressable>
    </MotiView>
  );
}
