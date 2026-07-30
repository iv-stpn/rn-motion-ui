/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the three swap animations, the two slot primitives and the button that composes them read best in one file */
import { cva, type VariantProps } from 'class-variance-authority';
import { type ReactNode, useCallback, useState } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { usePageVisible } from '../../hooks/use-page-visible';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { EASE_IN_OUT, EASE_OUT, SPRING_PRESS, SPRING_SWAP } from '../../lib/ease';
import { MotiText } from '../../moti/components/text';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { BUTTON_BOX, BUTTON_GAP_CLASSNAME, type ButtonShape, type ButtonSize, LABEL_TEXT_CLASS } from '../Button/button-scale';
import { Text } from '../Text/text';

export type ActionSwapItem = { id: string; label: ReactNode; icon?: ReactNode; ariaLabel?: string };

export type ActionSwapButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
/** Aliases of the button family's own axes — an ActionSwapButton is a button. */
export type ActionSwapButtonSize = ButtonSize;
export type ActionSwapButtonShape = ButtonShape;
// biome-ignore lint/style/useExportsLast: CoreAnimation narrows this type and must stay immediately below it for readability
export type ActionSwapAnimation = 'blur' | 'roll' | 'cascade';

/** Animations with a single-element variant set (cascade animates per letter). */
type CoreAnimation = 'blur' | 'roll';

const BLUR_TRANSITION = { type: 'timing', duration: 200, easing: EASE_IN_OUT } as const;
const BLUR_EXIT = { type: 'timing', duration: 200, easing: EASE_IN_OUT } as const;
const ROLL_TRANSITION = { type: 'timing', duration: 240, easing: EASE_OUT } as const;
const ROLL_EXIT = { type: 'timing', duration: 180, easing: EASE_IN_OUT } as const;

// Cascade rolls the label one letter at a time, left to right. Each letter
// enters from below on SPRING_SWAP and exits upward on a short tween, and the
// exits are staggered at half the enter rate so the tail of the old label
// lingers briefly — mirroring the web reference (0.025 s stagger, spring in,
// 0.16 s ease-out exit at half stagger).
const CASCADE_STAGGER = 25; // ms between letters (web original: 0.025 s)
const CASCADE_EXIT_DURATION = 160; // ms (web original: 0.16 s)

// Fallback roll distance before the slot has been measured (px).
const ROLL_FALLBACK = 18;

// Colour is the only axis here: the box (height, padding, radius) is the button
// family's, resolved through {@link BUTTON_BOX}, so an ActionSwapButton drops
// into a row of Buttons at the same `size` without a seam. `overflow-hidden`
// clips the swap — a letter rolling in from below must not escape the box.
const container = cva('flex-row items-center justify-center overflow-hidden', {
  variants: {
    variant: {
      primary: 'bg-primary',
      secondary: 'border border-border bg-surface-3',
      outline: 'border border-border bg-transparent',
      ghost: 'bg-transparent',
    },
  },
  defaultVariants: { variant: 'secondary' },
});

// Label colour per variant; the weight and size come from the family's ramp so a
// swapping label is the same text a flat Button paints at that size.
const labelClass = cva('', {
  variants: {
    variant: {
      primary: 'text-primary-foreground',
      secondary: 'text-foreground',
      outline: 'text-foreground',
      ghost: 'text-muted-foreground',
    },
    size: LABEL_TEXT_CLASS,
  },
  defaultVariants: { variant: 'secondary', size: 'md' },
});

export type ActionSwapTextProps = {
  value: string;
  children: ReactNode;
  animation?: ActionSwapAnimation;
  /** Applied to the outer measured slot. */
  style?: StyleProp<ViewStyle>;
  /** Applied to the rendered text (colour/size/weight). */
  textClassName?: string;
  testID?: string;
};

export type ActionSwapIconProps = {
  value: string;
  children: ReactNode;
  animation?: ActionSwapAnimation;
  /** Square edge of the icon slot in px. Default 16. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export interface ActionSwapButtonProps extends VariantProps<typeof container> {
  items: ActionSwapItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, item: ActionSwapItem) => void;
  size?: ButtonSize;
  /**
   * Corner treatment. Defaults to `pill` — a swapping label reads as a capsule,
   * and that's what this component has always been. Pass `rounded` to take the
   * family's radius ramp instead and match a neighbouring Button exactly.
   */
  shape?: ButtonShape;
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
  const pageVisible = usePageVisible();
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
  // Cascade letters travel 105% of the line box (web: y "105%"/"-105%") so
  // ascenders/descenders fully clear the clip before fading.
  const cascadeRoll = Math.round(roll * 1.05);

  // Reduced motion renders statically — and so does a hidden page: rAF is
  // paused in background tabs, so swaps arriving while hidden would queue
  // animations that all replay from their initial state on return. Rendering
  // the settled label instead lands background swaps instantly, and the swap
  // picks up from the current value once the page is visible again.
  if (reduce || !pageVisible)
    return (
      <View testID={testID} style={style}>
        {label === null ? children : <Text className={textClassName}>{label}</Text>}
      </View>
    );

  return (
    <View testID={testID} style={[{ overflow: 'hidden' }, style]}>
      {/* Hidden sizer establishes the slot width/height for the current label.
          String labels size a Text; arbitrary nodes size a wrapping View. */}
      {label === null ? (
        <View onLayout={onLayout} className="opacity-0" importantForAccessibility="no">
          {children}
        </View>
      ) : (
        <Text className={cn(textClassName, 'opacity-0')} onLayout={onLayout} importantForAccessibility="no">
          {label}
        </Text>
      )}
      {cascade && label !== null ? (
        <AnimatePresence initial={false}>
          <MotiView
            key={`cascade-${value}`}
            // The container holds still; each letter enters from below and exits
            // upward, staggered left→right. The parent has no exit of its own so
            // the leaving letters drop away individually rather than as a block.
            from={{ opacity: 1, translateY: 0 }}
            animate={{ opacity: 1, translateY: 0 }}
            className="absolute top-0 left-0 flex-row"
          >
            {Array.from(label).map((char, i) => (
              <MotiText
                // biome-ignore lint/suspicious/noArrayIndexKey: position is the slot identity — the letter at a position is what rolls.
                key={i}
                className={textClassName}
                from={{ opacity: 0, translateY: cascadeRoll }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateY: -cascadeRoll }}
                transition={{ ...SPRING_SWAP, delay: i * CASCADE_STAGGER }}
                // Exit on a timing tween (web parity: 0.16 s ease-out at half the
                // enter stagger). A spring exit would also break presence: re-renders
                // interrupt the spring before its completion callback fires, so the
                // letter never reports safeToUnmount and old layers pile up while
                // cycling. Timing makes opacity and translateY finish together.
                exitTransition={{
                  type: 'timing',
                  duration: CASCADE_EXIT_DURATION,
                  easing: EASE_OUT,
                  delay: i * CASCADE_STAGGER * 0.5,
                }}
              >
                {/* biome-ignore lint/suspicious/noLeakedRender: char is always a string character — safe alternate branch */}
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
            className="absolute top-0 left-0"
          >
            {label === null ? children : <Text className={textClassName}>{label}</Text>}
          </MotiView>
        </AnimatePresence>
      )}
    </View>
  );
}
export function ActionSwapIcon({ value, children, animation = 'blur', size = 16, style, testID }: ActionSwapIconProps) {
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  // Icons are single elements — cascade maps to its closest motion, roll.
  const core: CoreAnimation = animation === 'cascade' ? 'roll' : animation;

  // Same hidden-page fallback as ActionSwapText — see the comment there.
  if (reduce || !pageVisible)
    return (
      <View testID={testID} style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
        {children}
      </View>
    );

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
          className="absolute items-center justify-center"
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
  shape = 'pill',
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

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);
  const handlePress = useCallback(() => {
    if (disabled || !cycle || !nextItem) return;
    if (value === undefined) setInternalValue(nextItem.id);
    onValueChange?.(nextItem.id, nextItem);
  }, [disabled, cycle, nextItem, value, onValueChange]);

  if (!activeItem) return null;

  const accessibleLabel =
    accessibilityLabel ??
    activeItem.ariaLabel ??
    (iconOnly && typeof activeItem.label === 'string' ? activeItem.label : undefined);

  return (
    <MotiView animate={{ scale: pressed && !reduce && !disabled ? pressScale : 1 }} transition={SPRING_PRESS} style={style}>
      <Pressable
        accessibilityRole="button"
        aria-disabled={Boolean(disabled)}
        accessibilityLabel={accessibleLabel}
        testID={testID ?? 'action-swap-button'}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        className={cn(container({ variant }), BUTTON_BOX[shape][size], disabled && 'opacity-50', BUTTON_GAP_CLASSNAME)}
      >
        {hasIcon ? (
          <ActionSwapIcon value={activeItem.id} animation={animation} size={16}>
            {activeItem.icon ?? null}
          </ActionSwapIcon>
        ) : null}
        {iconOnly ? null : (
          <ActionSwapText value={activeItem.id} animation={animation} textClassName={labelClass({ variant, size })}>
            {activeItem.label}
          </ActionSwapText>
        )}
      </Pressable>
    </MotiView>
  );
}
