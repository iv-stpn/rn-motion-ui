import type { ComponentType } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { elevated as elevatedSurface, type SurfaceElevation } from '../../../lib/elevated';
import { FOCUS_VISIBLE_RING } from '../../../lib/focus-ring';
import { hitSlopFor } from '../../../lib/radius';
import { MotiView } from '../../../moti/components/view';
import type { MotiTransitionProp } from '../../../theme/motion';
import { MOTION_SNAPPY, mergeTransition } from '../../../theme/motion';
import { useThemeColors } from '../../../theme/use-theme-color';
import { Surface } from '../../display/Surface/surface';
import { ButtonRipples, ButtonSpinner, usePressRipples } from '../Button/button-internals';
import { type PressMode, pressAnimate } from '../Button/button-press';
import { BUTTON_SIZE, type ButtonShape, buttonRadius, FLOATING_ICON_SIDE, type RampSize } from '../Button/button-scale';
import { BUTTON_HOVER_CLASS } from '../Button/button-variants';

// ── Per-size metrics ─────────────────────────────────────────────────────────

/**
 * Tile dimensions and inner icon size when `iconBackgroundColor` is set. The
 * tile stays proportionate to the compact button, leaving only a narrow ring.
 */
const ICON_TILE: Record<RampSize, { tileClass: string; iconSize: number }> = {
  xs: { tileClass: 'h-[18px] w-[18px] rounded-[4px]', iconSize: 12 },
  sm: { tileClass: 'h-6 w-6 rounded-md', iconSize: 16 },
  md: { tileClass: 'h-[30px] w-[30px] rounded-lg', iconSize: 20 },
  lg: { tileClass: 'h-9 w-9 rounded-lg', iconSize: 24 },
};

/** Spinner diameter per button size. */
const SPINNER_SIZE: Record<RampSize, number> = { xs: 10, sm: 12, md: 16, lg: 20 };
/** Floating controls leave more clear space around the glyph than resting icon buttons. */
const FLOATING_GLYPH_SIZE: Record<RampSize, number> = { xs: 16, sm: 18, md: 20, lg: 24 };
const ICON_BUTTON_GLYPH_SIZE: Record<RampSize, number> = { xs: 18, sm: 24, md: 28, lg: 32 };

const COMPACT_SIDE: Record<RampSize, number> = { xs: 28, sm: 36, md: 44, lg: 52 };

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
   * Swap the plate's ladder shadow for the shared compact floating shadow
   * (`shadow-floating`) — the recipe {@link Input}'s `floating` prop wears.
   * It replaces the `shadow-elevated-N` rung rather than adding to it, so the
   * plate keeps its `elevation` tint but trades the layered drop for the halo.
   * @default false
   */
  floating?: boolean;

  /**
   * Surface elevation level (0–3) — drives the background tint (`bg-surface-N`)
   * and the `shadow-elevated-N` recipe. `0` is the flat resting surface — a
   * `surface-3` fill with no shadow or border. @default 0
   */
  elevation?: SurfaceElevation;

  /** Button size — the square, and the icon or tile inside it. Floating compact uses 28/34/40/48px; comfortable follows Button's shared size ramp. @default 'md' */
  size?: RampSize;
  /** Compact visual padding, preserving a 44px touch target through hitSlop. @default 'compact' */
  density?: 'compact' | 'comfortable';
  /** Override the glyph size without changing the touch target. */
  iconSize?: number;

  /** Corner shape. @default 'pill' */
  shape?: ButtonShape;

  /**
   * Backdrop blur radius in px/dp. `0` keeps the plate a solid surface; any
   * positive value frosts it — a `glass` tint over a backdrop blur (with the
   * specular edge light when `rim` is set). @default 0
   */
  blurRadius?: number;
  /** Opacity of the frosted tint (0–1); only thins the fill when `blurRadius` is set. @default 0.8 */
  opacity?: number;
  /** Draw the glass edge light — enabled by default for floating plates. @default floating */
  rim?: boolean;
  /** Rim width in px/dp. @default 1 */
  rimWidth?: number;
  /** Peak alpha (0–1) of the rim's specular highlight — lower is subtler. @default 0.5 */
  intensity?: number;

  // ── Interaction ────────────────────────────────────────────────────────────

  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Spawn a Material-style ripple from the press point. On by default. */
  ripple?: boolean;
  /** Settled scale for the uniform `scaleUp`/`scaleDown` press modes. Omit to
   *  use the mode's own default (1.05 growing, 0.93 shrinking). */
  pressScale?: number;
  /**
   * Shape of the press animation.
   * - `scaleUp` (default) — grows to `pressScale` (uniform, default 1.05).
   * - `scaleDown` — shrinks to `pressScale` (uniform, default 0.93).
   * - `scaleY` — compresses vertically and nudges down.
   * - `scaleX` — compresses horizontally.
   * - `none` — no press animation at all.
   */
  pressMode?: PressMode;
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
 * on a surface plate whose depth comes from `elevation` and whose shadow recipe
 * can be swapped for the input halo via `floating`, with the same
 * `icon`/`iconBackgroundColor`/`iconColor` API as {@link MenuItem}.
 *
 * Supersedes `<Button size="icon">`: every prop is meaningful for an icon-only
 * control, and `accessibilityLabel` is required so no instance ships without an
 * accessible name.
 *
 * @example
 * // A delete button on the resting plate — surface-3 fill + its ladder shadow
 * <IconButton icon={Trash2} accessibilityLabel="Delete" onPress={handleDelete} />
 *
 * @example
 * // The same plate wearing the input field's diffuse halo instead
 * <IconButton icon={Trash2} floating accessibilityLabel="Delete" onPress={handleDelete} />
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
  floating = false,
  elevation = 0,
  size = 'md',
  density = 'compact',
  iconSize,
  shape = 'pill',
  blurRadius = 0,
  opacity = 0.8,
  rim = floating,
  rimWidth,
  intensity,
  onPress,
  disabled,
  loading,
  ripple = true,
  pressScale,
  pressMode = 'scaleUp',
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
  const glass = blurRadius > 0;
  const surfaceClass = glass ? undefined : elevatedSurface(elevation, elevation, floating);

  const { pressed, onLayout, ripples, handlePressIn, handlePressOut } = usePressRipples({
    ripple,
    reduce,
    trackDims: false,
  });

  const compactSide = floating ? FLOATING_ICON_SIDE[size] : COMPACT_SIDE[size];
  const side = density === 'comfortable' ? BUTTON_SIZE[size].px : compactSide;
  const boxClass = BUTTON_SIZE[size].square[shape];
  const hasTile = Boolean(iconBackgroundColor);

  // Icon colour: explicit prop wins; tile mode defaults to white; otherwise the
  // plain foreground stroke (the plate is a light surface fill).
  const resolvedIconColor = iconColor ?? (hasTile ? 'white' : colors.foreground);

  let iconElement: React.ReactNode;
  if (loading) iconElement = <ButtonSpinner color={colors.foreground} reduce={reduce} size={SPINNER_SIZE[size]} />;
  else if (hasTile) {
    const { tileClass, iconSize: tileIconSize } = ICON_TILE[size];
    iconElement = (
      <View className={cn('items-center justify-center', tileClass)} style={{ backgroundColor: iconBackgroundColor }}>
        <IconComponent size={tileIconSize} color={resolvedIconColor} />
      </View>
    );
  } else
    iconElement = (
      <IconComponent
        size={iconSize ?? (floating ? FLOATING_GLYPH_SIZE[size] : ICON_BUTTON_GLYPH_SIZE[size])}
        color={resolvedIconColor}
      />
    );

  const pressValue = pressAnimate({ pressed, blocked: reduce || isDisabled, pressMode, pressScale });

  const pressable = (
    <Pressable
      accessibilityRole="button"
      aria-disabled={Boolean(isDisabled)}
      aria-busy={Boolean(loading)}
      accessibilityLabel={accessibilityLabel}
      testID={testID ?? 'icon-button'}
      disabled={isDisabled}
      hitSlop={hitSlopFor(side)}
      style={{ width: side, height: side }}
      onLayout={onLayout}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-center',
        surfaceClass,
        boxClass,
        isDisabled && !noDisabledOpacity && 'opacity-50',
        !isDisabled && BUTTON_HOVER_CLASS,
        // No `!isDisabled` gate — a disabled control can't receive focus, so
        // `:focus-visible` never matches it (unlike `:hover`, which does).
        FOCUS_VISIBLE_RING,
        'overflow-hidden',
        contentClassName,
      )}
    >
      {iconElement}
      {ripple && !reduce ? <ButtonRipples ripples={ripples} color={colors.foreground} filled={false} /> : null}
    </Pressable>
  );

  // Frosted plates render through the shared Surface primitive; solid plates keep
  // the existing MotiView wrapper.
  if (glass)
    return (
      <Surface
        as={MotiView}
        animate={pressValue}
        transition={pressSpring}
        elevation={elevation}
        floating={floating}
        blurRadius={blurRadius}
        opacity={opacity}
        rim={rim}
        rimWidth={rimWidth}
        intensity={intensity}
        borderRadius={shape === 'pill' || shape === 'circle' ? side / 2 : buttonRadius(shape, size)}
        className={cn(fitWidth && 'w-full', className)}
        style={style}
      >
        {pressable}
      </Surface>
    );

  return (
    <MotiView animate={pressValue} transition={pressSpring} className={cn(fitWidth && 'w-full', className)} style={style}>
      {pressable}
    </MotiView>
  );
}
