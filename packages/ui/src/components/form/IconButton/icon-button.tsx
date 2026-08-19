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
import type { ButtonVariant } from '../Button/button';
import { ButtonRipples, ButtonSpinner, pressAnimate, usePressRipples } from '../Button/button-internals';

// ── Types ────────────────────────────────────────────────────────────────────

type IconButtonSize = 'sm' | 'md' | 'lg';
type IconButtonShape = 'rounded' | 'pill';

// ── Box geometry ─────────────────────────────────────────────────────────────
// Static literals so the uniwind/Tailwind scanner registers every class.
// Tracks the BUTTON_BOX.icon pattern: square at each interactive height.

const ICON_BUTTON_BOX: Record<IconButtonShape, Record<IconButtonSize, string>> = {
  rounded: {
    sm: 'h-interactive-sm w-interactive-sm rounded-interactive',
    md: 'h-interactive-md w-interactive-md rounded-interactive',
    lg: 'h-interactive-lg w-interactive-lg rounded-interactive',
  },
  pill: {
    sm: 'h-interactive-sm w-interactive-sm rounded-full',
    md: 'h-interactive-md w-interactive-md rounded-full',
    lg: 'h-interactive-lg w-interactive-lg rounded-full',
  },
};

// ── Per-size metrics ─────────────────────────────────────────────────────────

/** Icon size in px when rendered without a background tile. */
const ICON_SIZE: Record<IconButtonSize, number> = { sm: 14, md: 16, lg: 20 };

/** Tile dimensions and inner icon size when `iconBackgroundColor` is set. */
const ICON_TILE: Record<IconButtonSize, { tileClass: string; iconSize: number }> = {
  sm: { tileClass: 'h-4 w-4 rounded-sm', iconSize: 10 },
  md: { tileClass: 'h-5 w-5 rounded-[5px]', iconSize: 12 },
  lg: { tileClass: 'h-6 w-6 rounded-md', iconSize: 14 },
};

/** Spinner diameter per button size. */
const SPINNER_SIZE: Record<IconButtonSize, number> = { sm: 12, md: 16, lg: 20 };

// ── Variant styling ──────────────────────────────────────────────────────────
// Same 8-variant table as Button, driving the fill / border / shadow of the
// outer Pressable.

const container = cva('flex-row items-center justify-center', {
  variants: {
    variant: {
      neutral: SURFACE_CLASSNAME[3],
      inverse: 'border border-border bg-foreground',
      ghost: 'bg-transparent',
      outline: 'border border-border bg-transparent',
      danger: 'bg-danger shadow-elevated-3',
      special: 'bg-special shadow-elevated-3',
      outlineDanger: 'border border-danger bg-transparent',
      ghostDanger: 'bg-transparent',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

// ── Colour helpers ───────────────────────────────────────────────────────────

/**
 * Resolved icon stroke colour from the variant's foreground token.
 * Mirrors the variant→foreground mapping from Button's label cva and
 * ThemedIcon's VARIANT_TOKEN table.
 */
function resolveIconColor(variant: ButtonVariant, colors: ReturnType<typeof useThemeColors>): string {
  switch (variant) {
    case 'neutral':
    case 'danger':
      return colors['primary-foreground'];
    case 'inverse':
      return colors['surface-1'];
    case 'special':
      return colors['special-foreground'];
    case 'outlineDanger':
    case 'ghostDanger':
      return colors.danger;
    default:
      return colors.foreground;
  }
}

/** Loading-spinner stroke colour, matching the variant's foreground. */
function spinnerColor(variant: ButtonVariant, colors: ReturnType<typeof useThemeColors>): string {
  return resolveIconColor(variant, colors);
}

/**
 * Variants whose fill is opaque and dark-or-vivid, so a ripple must shimmer
 * white to be visible. Same set as Button's FILLED_RIPPLE_VARIANTS.
 */
const FILLED_RIPPLE_VARIANTS = new Set<ButtonVariant>(['inverse', 'danger', 'special']);

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
   * `'white'`; otherwise it is derived from the `variant`'s foreground token.
   */
  iconColor?: string;

  /** Visual variant — controls the button's fill, border, and shadow. @default 'neutral' */
  variant?: ButtonVariant;

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
 * with the same 8 variants as {@link Button} and the same
 * `icon`/`iconBackgroundColor`/`iconColor` API as {@link MenuItem}.
 *
 * Supersedes `<Button size="icon">`: every prop is meaningful for an icon-only
 * control, and `accessibilityLabel` is required so no instance ships without an
 * accessible name.
 *
 * @example
 * // A ghost delete button — icon colour auto-derived from the variant
 * <IconButton icon={Trash2} variant="ghostDanger" accessibilityLabel="Delete" onPress={handleDelete} />
 *
 * @example
 * // iOS Settings-style icon tile
 * <IconButton
 *   icon={Bell}
 *   variant="ghost"
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

  // Icon colour: explicit prop wins; tile mode defaults to white; otherwise
  // derive from the variant so it stays legible on the fill.
  const resolvedIconColor = iconColor ?? (hasTile ? 'white' : resolveIconColor(v, colors));

  let iconElement: React.ReactNode;
  if (loading) iconElement = <ButtonSpinner color={spinnerColor(v, colors)} reduce={reduce} size={SPINNER_SIZE[size]} />;
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
        {ripple && !reduce ? <ButtonRipples ripples={ripples} filled={FILLED_RIPPLE_VARIANTS.has(v)} /> : null}
      </Pressable>
    </MotiView>
  );
}
