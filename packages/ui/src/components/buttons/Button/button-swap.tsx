/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the three swap animations, the two slot primitives and the button that composes them read best in one file */
import type { VariantProps } from 'class-variance-authority';
import { type ReactNode, useCallback, useState } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { usePageVisible } from '../../../hooks/use-page-visible';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { EASE_IN_OUT, EASE_OUT, SPRING_SWAP } from '../../../lib/ease';
import { elevatedShadow, FLOATING_SHADOW_CLASSNAME, type SurfaceElevation } from '../../../lib/elevated';
import { MotiText } from '../../../moti/components/text';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { MOTION_SNAPPY, mergeTransition, TIMING_BASE } from '../../../theme/motion';
import { Text, type TextWeight } from '../../typography/Text/text';
import { type BaseButtonProps, ButtonRipples, pressAnimate, usePressRipples } from './button-internals';
import { BUTTON_BOX, BUTTON_GAP_CLASSNAME, type ButtonShape, type ButtonSize } from './button-scale';
import { buttonContainer as container, FILLED_RIPPLE_VARIANTS, buttonLabel as labelClass } from './button-variants';

// The family's public types, re-exported so a ButtonSwap consumer takes its
// axes from the same place a Button consumer does.
export type { ButtonShape, ButtonSize } from './button-scale';
export type { ButtonVariant } from './button-variants';

export type ButtonSwapItem = { id: string; label: ReactNode; icon?: ReactNode; ariaLabel?: string };

// biome-ignore lint/style/useExportsLast: CoreAnimation narrows this type and must stay immediately below it for readability
export type ButtonSwapAnimation = 'blur' | 'roll' | 'cascade';

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

/** Square edge (px) of the icon slot, matching the adornment icons a Button carries. */
const ICON_SLOT_SIZE = 16;

export type ButtonSwapTextProps = {
  value: string;
  children: ReactNode;
  animation?: ButtonSwapAnimation;
  /** Applied to the outer measured slot. */
  style?: StyleProp<ViewStyle>;
  /** Applied to the rendered text (colour/size). */
  textClassName?: string;
  /** Font weight (resolves a per-weight font token). */
  weight?: TextWeight;
  testID?: string;
};

export type ButtonSwapIconProps = {
  value: string;
  children: ReactNode;
  animation?: ButtonSwapAnimation;
  /** Square edge of the icon slot in px. Default 16. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * A Button whose label and icon swap under it. It carries the whole Button
 * styling surface — the same `variant` table, `size`/`shape` box, `elevation`,
 * `floating` halo, ripples and class overrides — so a swapping button drops into
 * a row of Buttons without a seam. What it does NOT take from Button is content:
 * the label comes from `items`, not `children`, and the state it swaps between is
 * its own (there is no `loading`; reach for {@link StatefulButton} for that).
 */
export interface ButtonSwapProps
  extends VariantProps<typeof container>,
    Omit<BaseButtonProps, 'children' | 'leftAdornment' | 'rightAdornment' | 'loading'> {
  items: ButtonSwapItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, item: ButtonSwapItem) => void;
  size?: ButtonSize;
  /**
   * Corner treatment. Defaults to `pill` — a swapping label reads as a capsule,
   * and that's what this component has always been. Pass `rounded` to take the
   * family's radius ramp instead and match a neighbouring Button exactly.
   */
  shape?: ButtonShape;
  animation?: ButtonSwapAnimation;
  iconOnly?: boolean;
  /** Advance to the next item on press. Default true. */
  cycle?: boolean;

  /**
   * Swap the button's ladder shadow for the input field's large, diffuse halo
   * (`shadow-floating`) — the same recipe {@link Button}'s `floating` prop wears.
   * It *replaces* whatever shadow `elevation` resolved rather than adding to it,
   * since both write `box-shadow`. @default false
   */
  floating?: boolean;

  /**
   * Shadow level (0–8) the button casts. Drives the shadow *only* — the fill
   * comes from `variant`, not the surface ladder — so raising `elevation` floats
   * the button without recolouring it. `0` is flat (no shadow). @default 0
   */
  elevation?: SurfaceElevation;
}

export function ButtonSwapText({
  value,
  children,
  animation = 'blur',
  textClassName = 'text-foreground',
  weight,
  ...props
}: ButtonSwapTextProps) {
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
      <View {...props}>
        {label === null ? (
          children
        ) : (
          <Text className={textClassName} weight={weight}>
            {label}
          </Text>
        )}
      </View>
    );

  return (
    <View className="overflow-hidden" {...props}>
      {/* Hidden sizer establishes the slot width/height for the current label.
          String labels size a Text; arbitrary nodes size a wrapping View. */}
      {label === null ? (
        <View onLayout={onLayout} className="opacity-0" importantForAccessibility="no">
          {children}
        </View>
      ) : (
        <Text className={cn(textClassName, 'opacity-0')} weight={weight} onLayout={onLayout} importantForAccessibility="no">
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
                weight={weight}
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
            {label === null ? (
              children
            ) : (
              <Text className={textClassName} weight={weight}>
                {label}
              </Text>
            )}
          </MotiView>
        </AnimatePresence>
      )}
    </View>
  );
}

export function ButtonSwapIcon({
  value,
  children,
  animation = 'blur',
  size = ICON_SLOT_SIZE,
  style,
  testID,
}: ButtonSwapIconProps) {
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  // Icons are single elements — cascade maps to its closest motion, roll.
  const core: CoreAnimation = animation === 'cascade' ? 'roll' : animation;

  // Same hidden-page fallback as ButtonSwapText — see the comment there.
  if (reduce || !pageVisible)
    return (
      <View testID={testID} className="items-center justify-center" style={[{ width: size, height: size }, style]}>
        {children}
      </View>
    );

  return (
    <View testID={testID} className="items-center justify-center overflow-hidden" style={[{ width: size, height: size }, style]}>
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

export function ButtonSwap({
  items,
  value,
  defaultValue,
  onValueChange,
  variant = 'neutral',
  size = 'md',
  shape = 'pill',
  floating = false,
  elevation,
  animation = 'blur',
  iconOnly = size === 'icon',
  cycle = true,
  onPress,
  disabled,
  ripple = false,
  pressScale = 0.93,
  pressMode = 'scale',
  noDisabledOpacity = false,
  backdropColor,
  pressTransition,
  fitWidth,
  className,
  contentClassName,
  labelClassName,
  style,
  accessibilityLabel,
  testID,
}: ButtonSwapProps) {
  const reduce = useReducedMotion();
  const pressSpring = mergeTransition(MOTION_SNAPPY, pressTransition);
  const v = variant ?? 'neutral';
  const isDisabled = Boolean(disabled);
  // The shadow is `elevation`-driven and defaults to flat (`0`); `floating`
  // swaps whichever rung resolves for the halo.
  const resolvedElevation: SurfaceElevation = elevation ?? 0;

  const { pressed, onLayout, ripples, handlePressIn, handlePressOut } = usePressRipples({
    ripple,
    reduce,
    trackDims: false,
  });

  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.id);
  const currentValue = value ?? internalValue;
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === currentValue),
  );
  const activeItem = items[activeIndex] ?? items[0];
  const hasIcon = items.some((item) => item.icon);
  const nextItem = cycle && items.length > 0 ? items[(activeIndex + 1) % items.length] : undefined;

  const handlePress = useCallback(() => {
    if (disabled) return;
    onPress?.();
    if (!(cycle && nextItem)) return;
    if (value === undefined) setInternalValue(nextItem.id);
    onValueChange?.(nextItem.id, nextItem);
  }, [disabled, cycle, nextItem, value, onValueChange, onPress]);

  if (!activeItem) return null;

  const accessibleLabel =
    accessibilityLabel ??
    activeItem.ariaLabel ??
    (iconOnly && typeof activeItem.label === 'string' ? activeItem.label : undefined);

  return (
    <MotiView
      animate={pressAnimate({ pressed, blocked: reduce || isDisabled, pressMode, pressScale })}
      transition={pressSpring}
      className={cn(fitWidth && 'w-full', className)}
      style={style}
    >
      <Pressable
        accessibilityRole="button"
        aria-disabled={Boolean(isDisabled)}
        accessibilityLabel={accessibleLabel}
        testID={testID ?? 'button-swap'}
        disabled={isDisabled}
        onLayout={onLayout}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        className={cn(
          container({ variant }),
          // After the variant so tailwind-merge lets the halo win over the
          // resolved `shadow-elevated-N` rung.
          floating ? FLOATING_SHADOW_CLASSNAME : elevatedShadow(resolvedElevation),
          BUTTON_BOX[shape][size],
          isDisabled && !noDisabledOpacity && 'opacity-50',
          // Clips the swap — a letter rolling in from below must not escape the box.
          'overflow-hidden',
          BUTTON_GAP_CLASSNAME,
          contentClassName,
        )}
      >
        {/* State backdrop — animates in/out by opacity so the variant background
            shows through when idle and the state colour fills it when set. */}
        <MotiView
          animate={{ opacity: backdropColor === undefined ? 0 : 1 }}
          transition={TIMING_BASE}
          style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor ?? 'transparent', pointerEvents: 'none' }]}
        />
        {hasIcon ? (
          <ButtonSwapIcon value={activeItem.id} animation={animation} size={ICON_SLOT_SIZE}>
            {activeItem.icon ?? null}
          </ButtonSwapIcon>
        ) : null}
        {iconOnly ? null : (
          <ButtonSwapText
            value={activeItem.id}
            animation={animation}
            textClassName={cn(labelClass({ variant: v, size }), labelClassName)}
            weight="medium"
          >
            {activeItem.label}
          </ButtonSwapText>
        )}
        {ripple && !reduce ? <ButtonRipples ripples={ripples} filled={FILLED_RIPPLE_VARIANTS.has(v)} /> : null}
      </Pressable>
    </MotiView>
  );
}
