import { cva } from 'class-variance-authority';
import type { ComponentType } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { SURFACE_CLASSNAME } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import type { MotiTransitionProp } from '../../../theme/motion';
import { MOTION_SNAPPY, mergeTransition } from '../../../theme/motion';
import { useThemeColors } from '../../../theme/use-theme-color';
import { ButtonRipples, ButtonSpinner, pressAnimate, usePressRipples } from '../Button/button-internals';

// ── Types ────────────────────────────────────────────────────────────────────

type IconButtonSize = 'sm' | 'md' | 'lg';
type IconButtonShape = 'rounded' | 'pill';

/** IconButton's variant union — `neutral` (a surface-3 plate) or `elevated`
 *  (surface-3 plus the input's diffuse floating shadow). */
// biome-ignore lint/style/useExportsLast: the IconButtonVariant type heads the module next to the size/shape unions and the variant table it enumerates, keeping them readable together
export type IconButtonVariant = 'neutral' | 'elevated';

// ── Box geometry ─────────────────────────────────────────────────────────────
// Static literals so the uniwind/Tailwind scanner registers every class.
// Tracks the BUTTON_BOX.icon pattern: square at each interactive height.
// `lg` steps OFF the interactive ramp (24/32/40px) to 48px — the MorphingFAB
// trigger size — so the FAB can render as an IconButton.

const ICON_BUTTON_BOX: Record<IconButtonShape, Record<IconButtonSize, string>> = {
  rounded: {
    sm: 'h-interactive-sm w-interactive-sm rounded-interactive',
    md: 'h-interactive-md w-interactive-md rounded-interactive',
    lg: 'h-12 w-12 rounded-interactive',
  },
  pill: {
    sm: 'h-interactive-sm w-interactive-sm rounded-full',
    md: 'h-interactive-md w-interactive-md rounded-full',
    lg: 'h-12 w-12 rounded-full',
  },
};

// ── Per-size metrics ─────────────────────────────────────────────────────────

/** Icon size in px when rendered without a background tile. */
const ICON_SIZE: Record<IconButtonSize, number> = { sm: 14, md: 16, lg: 20 };

/** Tile dimensions and inner icon size when `iconBackgroundColor` is set. */
const ICON_TILE: Record<IconButtonSize, { tileClass: string; iconSize: number }> = {
  sm: { tileClass: 'h-4 w-4 rounded-sm', iconSize: 10 },
  md: { tileClass: 'h-5 w-5 rounded-[5px]', iconSize: 12 },
  lg: { tileClass: 'h-7 w-7 rounded-lg', iconSize: 16 },
};

/** Spinner diameter per button size. */
const SPINNER_SIZE: Record<IconButtonSize, number> = { sm: 12, md: 16, lg: 20 };

// ── Variant styling ──────────────────────────────────────────────────────────
// Two surface-3 fills: `neutral` is the plain plate, `elevated` adds the input's
// large diffuse drop so an icon-only control reads as a raised card without a
// rim.

const container = cva('flex-row items-center justify-center', {
  variants: {
    variant: {
      neutral: SURFACE_CLASSNAME[3],
      // Surface-3 fill + the input's large diffuse drop — the floating-input
      // recipe, so an icon-only control reads as a raised card without a rim.
      elevated: 'bg-surface-3 shadow-floating',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

// ── Component ────────────────────────────────────────────────────────────────

export type IconButtonProps = {
  /** Icon component — any function accepting {@link IconProps} (e.g. a MingCute icon from `rn-motion-ui-icons`). */
  icon: ComponentType<IconProps>;

  /**
   * When set, the icon is placed inside a coloured rounded-square tile
   * (iOS Settings style), inside the button's touch area.
   */
  iconBackgroundColor?: string;

  /**
   * Icon stroke colour. When `iconBackgroundColor` is set this defaults to
   * `'white'`; otherwise it uses the plain foreground token.
   */
  iconColor?: string;

  /** Visual variant — `neutral` (surface-3 plate) or `elevated` (surface-3 fill with the input's diffuse floating shadow). @default 'neutral' */
  variant?: IconButtonVariant;

  /** Button size — controls the outer square and the icon or tile inside it. @default 'md' */
  size?: IconButtonSize;

  /** Corner shape. @default 'pill' */
  shape?: IconButtonShape;

  // ── Interaction ────────────────────────────────────────────────────────────

  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Spawn a Material-style ripple from the press point. Off by default. */
  ripple?: boolean;
  /** Scale the button settles to while pressed. @default 0.93 */
  pressScale?: number;
  /**
   * Shape of the press animation.
   * - `scale` (default) — uniform pressScale.
   * - `scaleY` — compresses vertically and nudges down.
   * - `scaleX` — compresses horizontally.
   * - `none` — no press animation at all.
   */
  pressMode?: 'scale' | 'scaleY' | 'scaleX' | 'none';
  /** When true, skip the 0.5 opacity applied to disabled buttons. */
  noDisabledOpacity?: boolean;
  /** Override the press-scale spring. Partial — only the fields you pass are changed. */
  pressTransition?: Partial<MotiTransitionProp>;
  /** Stretch the button to fill its container width. */
  fitWidth?: boolean;

  // ── Layout ─────────────────────────────────────────────────────────────────

  /** Additional UniWind class names merged onto the outer wrapper. */
  className?: string;
  /** Tailwind classes merged onto the Pressable container. */
  contentClassName?: string;
  style?: StyleProp<ViewStyle>;

  // ── Accessibility ──────────────────────────────────────────────────────────

  /**
   * Accessible name announced to assistive tech. **Required** — an icon-only
   * button without a label is invisible to screen readers.
   */
  accessibilityLabel: string;
  testID?: string;
};

/**
 * A purpose-built icon-only button — a square pressable that displays an icon,
 * with two surface-3 variants (`neutral` / `elevated`) and the same
 * `icon`/`iconBackgroundColor`/`iconColor` API as {@link MenuItem}.
 *
 * Supersedes `<Button size="icon">`: every prop is meaningful for an icon-only
 * control, and `accessibilityLabel` is required so no instance ships without an
 * accessible name.
 *
 * @example
 * // A raised delete button — surface-3 fill + floating-input shadow
 * <IconButton icon={Trash2} variant="elevated" accessibilityLabel="Delete" onPress={handleDelete} />
 *
 * @example
 * // iOS Settings-style icon tile
 * <IconButton
 *   icon={Bell}
 *   variant="neutral"
 *   iconBackgroundColor="#FF3B30"
 *   accessibilityLabel="Notifications"
 *   onPress={handleNotifications}
 * />
 *
 * @example
 * // Loading state — spinner replaces the icon
 * <IconButton icon={Download} variant="neutral" loading accessibilityLabel="Downloading" />
 */
export function IconButton({
  icon: IconComponent,
  variant = 'neutral',
  size = 'md',
  shape = 'pill',
  onPress,
  disabled,
  loading,
  ripple = false,
  pressScale = 0.93,
  pressMode = 'scale',
  noDisabledOpacity = false,
  pressTransition,
  fitWidth,
  className,
  contentClassName,
  style,
  iconColor,
  iconBackgroundColor,
  accessibilityLabel,
  testID,
}: IconButtonProps) {
  const reduce = useReducedMotion();
  const colors = useThemeColors();
  const pressSpring = mergeTransition(MOTION_SNAPPY, pressTransition);
  const isDisabled = Boolean(disabled || loading);
  const v = variant ?? 'neutral';

  const { pressed, onLayout, ripples, handlePressIn, handlePressOut } = usePressRipples({
    ripple,
    reduce,
    trackDims: false,
  });

  const boxClass = ICON_BUTTON_BOX[shape][size];
  const hasTile = Boolean(iconBackgroundColor);

  // Icon colour: explicit prop wins; tile mode defaults to white; otherwise the
  // plain foreground stroke (both variants are light surface-3 fills).
  const resolvedIconColor = iconColor ?? (hasTile ? 'white' : colors.foreground);

  let iconElement: React.ReactNode;
  if (loading) iconElement = <ButtonSpinner color={colors.foreground} reduce={reduce} size={SPINNER_SIZE[size]} />;
  else if (hasTile) {
    const { tileClass, iconSize } = ICON_TILE[size];
    iconElement = (
      <View className={cn('items-center justify-center', tileClass)} style={{ backgroundColor: iconBackgroundColor }}>
        <IconComponent size={iconSize} color={resolvedIconColor} />
      </View>
    );
  } else iconElement = <IconComponent size={ICON_SIZE[size]} color={resolvedIconColor} />;

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
        aria-busy={Boolean(loading)}
        accessibilityLabel={accessibilityLabel}
        testID={testID ?? 'icon-button'}
        disabled={isDisabled}
        onLayout={onLayout}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        className={cn(
          container({ variant: v }),
          boxClass,
          isDisabled && !noDisabledOpacity && 'opacity-50',
          'overflow-hidden',
          contentClassName,
        )}
      >
        {iconElement}
        {ripple && !reduce ? <ButtonRipples ripples={ripples} filled={false} /> : null}
      </Pressable>
    </MotiView>
  );
}
