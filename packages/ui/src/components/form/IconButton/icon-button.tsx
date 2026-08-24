import type { ComponentType } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { elevated as elevatedSurface, type SurfaceElevation } from '../../../lib/elevated';
import { INTERACTIVE_HEIGHT } from '../../../lib/radius';
import { MotiView } from '../../../moti/components/view';
import type { MotiTransitionProp } from '../../../theme/motion';
import { MOTION_SNAPPY, mergeTransition } from '../../../theme/motion';
import { useThemeColors } from '../../../theme/use-theme-color';
import { ButtonRipples, ButtonSpinner, pressAnimate, usePressRipples } from '../Button/button-internals';

// ── Types ────────────────────────────────────────────────────────────────────

type IconButtonSize = 'sm' | 'md' | 'lg';
type IconButtonShape = 'rounded' | 'pill';

// ── Box geometry ─────────────────────────────────────────────────────────────
// Static literals so the uniwind/Tailwind scanner registers every class.
// Tracks the BUTTON_BOX.icon pattern: the square at each interactive height.
// Every size sits on the shared ramp (24/32/40px), so an IconButton and a Button
// of the same `size` are the same height and a row of the two lines up.

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

// biome-ignore lint/style/useComponentExportOnlyModules: the `lg` box's pixel twin — the MorphingFAB reads it so its trigger shell stays exactly the size of an `lg` IconButton
// biome-ignore lint/style/useExportsLast: same reason — it must sit against ICON_BUTTON_BOX above, whose `lg` height it mirrors, so the two can never drift apart
export const ICON_BUTTON_LG_SIZE = INTERACTIVE_HEIGHT.lg;

// ── Per-size metrics ─────────────────────────────────────────────────────────

/** Icon size in px when rendered without a background tile. */
const ICON_SIZE: Record<IconButtonSize, number> = { sm: 14, md: 16, lg: 20 };

/**
 * Tile dimensions and inner icon size when `iconBackgroundColor` is set. The
 * tile steps 16/20/24px against the box's 24/32/40px, so every size keeps the
 * same ring of breathing room around the plate.
 */
const ICON_TILE: Record<IconButtonSize, { tileClass: string; iconSize: number }> = {
  sm: { tileClass: 'h-4 w-4 rounded-sm', iconSize: 10 },
  md: { tileClass: 'h-5 w-5 rounded-[5px]', iconSize: 12 },
  lg: { tileClass: 'h-6 w-6 rounded-md', iconSize: 14 },
};

/** Spinner diameter per button size. */
const SPINNER_SIZE: Record<IconButtonSize, number> = { sm: 12, md: 16, lg: 20 };

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

  /**
   * Whether the button casts the `shadow-elevated-N` recipe (drop + dark rim).
   * `false` drops the shadow so the plate sits flat, keeping its surface tint.
   * @default true
   */
  elevated?: boolean;

  /**
   * Surface elevation level (0–8) — drives the background tint (`bg-surface-N`)
   * and, when `elevated`, the `shadow-elevated-N` recipe. `0` is the flat resting
   * surface — a `surface-3` fill with no shadow or border. @default 3
   */
  elevation?: SurfaceElevation;

  /** Button size — the square, and the icon or tile inside it. Shares
   *  {@link Button}'s height ramp (24/32/40px), so the two line up in a row. @default 'md' */
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
 * on a surface-3 plate that can be raised via `elevated`/`elevation`, with the
 * same `icon`/`iconBackgroundColor`/`iconColor` API as {@link MenuItem}.
 *
 * Supersedes `<Button size="icon">`: every prop is meaningful for an icon-only
 * control, and `accessibilityLabel` is required so no instance ships without an
 * accessible name.
 *
 * @example
 * // A raised delete button — surface-3 fill + elevation shadow
 * <IconButton icon={Trash2} accessibilityLabel="Delete" onPress={handleDelete} />
 *
 * @example
 * // A flat plate, no shadow
 * <IconButton icon={Trash2} elevated={false} accessibilityLabel="Delete" onPress={handleDelete} />
 *
 * @example
 * // iOS Settings-style icon tile
 * <IconButton
 *   icon={Bell}
 *   iconBackgroundColor="#FF3B30"
 *   accessibilityLabel="Notifications"
 *   onPress={handleNotifications}
 * />
 *
 * @example
 * // Loading state — spinner replaces the icon
 * <IconButton icon={Download} loading accessibilityLabel="Downloading" />
 */
export function IconButton({
  icon: IconComponent,
  elevated = true,
  elevation = 3,
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
  const surfaceClass = elevatedSurface(elevation, elevation, elevated);

  const { pressed, onLayout, ripples, handlePressIn, handlePressOut } = usePressRipples({
    ripple,
    reduce,
    trackDims: false,
  });

  const boxClass = ICON_BUTTON_BOX[shape][size];
  const hasTile = Boolean(iconBackgroundColor);

  // Icon colour: explicit prop wins; tile mode defaults to white; otherwise the
  // plain foreground stroke (the plate is a light surface fill).
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
          'flex-row items-center justify-center',
          surfaceClass,
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
