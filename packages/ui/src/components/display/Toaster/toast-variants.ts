/**
 * The toast family's colour tables — the one place a toast's fill and ink are
 * decided. It mirrors the Button family's filled plates (`button-variants.ts`),
 * so a toast at a given variant sits on the same fill and ink a filled Button at
 * that variant does.
 *
 * Data only, no React — both twins import this without pulling in either
 * platform's renderer.
 */

import type { ThemeToken } from '../../../theme/use-theme-color';
import type { ToastVariant } from './toast-types';

/** Fill token per variant — the pill's background, matching the Button plate. */
export const TOAST_FILL_TOKEN: Record<ToastVariant, ThemeToken> = {
  primary: 'primary',
  secondary: 'secondary',
  accent: 'accent',
  neutral: 'surface-3',
  danger: 'danger',
  success: 'success',
  warning: 'warning',
  info: 'info',
};

/** Ink (label/description) token per variant — matching the Button label colour. */
export const TOAST_FOREGROUND_TOKEN: Record<ToastVariant, ThemeToken> = {
  primary: 'primary-foreground',
  secondary: 'secondary-foreground',
  accent: 'accent-foreground',
  neutral: 'foreground',
  danger: 'danger-foreground',
  success: 'success-foreground',
  warning: 'warning-foreground',
  info: 'info-foreground',
};

/**
 * Alpha (0–1) the variant fill keeps when a glass toast composites it over its
 * backdrop blur — translucent enough to read as glass, opaque enough to keep the
 * variant's hue clearly.
 */
export const TOAST_GLASS_ALPHA = 0.8;
