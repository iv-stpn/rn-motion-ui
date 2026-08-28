import type { ComponentType } from 'react';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { type ThemeToken, useThemeColors } from '../../theme/use-theme-color';
import type { ButtonVariant } from '../buttons/Button/button';
import type { ElevatedVariant } from '../buttons/Button/elevated-button';

/**
 * Foreground token for an icon living inside a given button variant.
 *
 * Mirrors the same logic used by ElevatedButton's `elevatedContentColor` and
 * Button's label cva: each token is the fill's legible partner, so an icon
 * passed as a button adornment lands on exactly the right color for that fill.
 *
 * `danger` maps to `danger-foreground` (white on vivid red) rather than
 * `primary-foreground` to match ElevatedButton and keep the mapping semantic.
 */
const VARIANT_TOKEN: Record<IconVariant, ThemeToken> = {
  // ── ButtonVariant ────────────────────────────────────────────────────────
  neutral: 'primary-foreground',
  inverse: 'primary',
  ghost: 'foreground',
  outline: 'foreground',
  danger: 'danger-foreground',
  special: 'special-foreground',
  outlineDanger: 'danger',
  ghostDanger: 'danger',
  // ── ElevatedVariant (extras not in ButtonVariant) ────────────────────────
  success: 'success-foreground',
  warning: 'warning-foreground',
  info: 'info-foreground',
  white: 'muted-foreground',
  gray: 'muted-foreground',
};

/**
 * All named color variants ThemedIcon understands. Combines {@link ButtonVariant}
 * and {@link ElevatedVariant} so an icon can be themed to match any button family.
 */
export type IconVariant = ButtonVariant | ElevatedVariant;

export type ThemedIconProps = Omit<IconProps, 'color'> & {
  /** Icon component to render — any function accepting {@link IconProps}. */
  icon: ComponentType<IconProps>;
  /**
   * Color variant. Maps to the foreground token for that fill so the icon
   * stays legible on any button background without manually threading a color
   * prop. Defaults to `'ghost'` (plain `foreground` token).
   *
   * Pass any `ButtonVariant` / `ElevatedVariant` name to match a specific
   * button family.
   *
   * @example variant="neutral"  → primary-foreground (white on primary fill)
   * @example variant="ghost"    → foreground
   * @example variant="success"  → success-foreground (white on green fill)
   * @example variant="outlineDanger" → danger (the danger hue itself)
   */
  variant?: IconVariant;
  /**
   * Direct token override. When set, skips the variant→token lookup and
   * resolves this specific token from the active theme instead. Takes
   * precedence over `variant`.
   */
  token?: ThemeToken;
};

/**
 * Wraps any icon component with automatic token-driven color theming.
 *
 * Resolves the correct semantic foreground token for the named `variant` so
 * icons inside buttons, badges, or status indicators stay legible across both
 * light and dark modes without manually threading a color prop.
 *
 * All other {@link IconProps} (size, style, accessibilityLabel) are forwarded to
 * the wrapped icon unchanged.
 *
 * @example
 * // Adornment in a neutral (primary-fill) button — picks up primary-foreground
 * <ThemedIcon icon={ArrowRight} variant="neutral" size={16} />
 *
 * @example
 * // Standalone status icon — success-foreground (white) on the green fill
 * <ThemedIcon icon={Check} variant="success" size={20} />
 *
 * @example
 * // Ghost context — foreground token, no explicit color prop needed
 * <ThemedIcon icon={Settings} variant="ghost" size={20} />
 *
 * @example
 * // Bypass variant lookup and specify a token directly
 * <ThemedIcon icon={Info} token="muted-foreground" size={20} />
 */
export function ThemedIcon({ icon: Icon, variant = 'ghost', token, ...iconProps }: ThemedIconProps) {
  const colors = useThemeColors();
  const resolvedToken = token ?? VARIANT_TOKEN[variant];
  return <Icon color={colors[resolvedToken]} {...iconProps} />;
}
