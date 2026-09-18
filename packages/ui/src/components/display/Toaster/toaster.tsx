import { type CSSProperties, type ReactNode, useEffect } from 'react';
import type { ExternalToast } from 'sonner';
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';

import { ThemedIcon } from '../../icon/themed-icon';

import { TOAST_STATUS_ICON } from './toast-icons';
import type { ToastApi, ToasterProps, ToastOptions, ToastPosition, ToastVariant } from './toast-types';
import { TOAST_FILL_TOKEN, TOAST_FOREGROUND_TOKEN } from './toast-variants';

/**
 * The web twin of the `Toaster` — a thin adapter over Sonner.
 *
 * `rn-motion-ui/toaster` resolves to this module on web (and to `./toaster.native`
 * on native), so a consumer writes the same `<Toaster />` + `toast()` call on every
 * platform. The adapter's job is to reconcile Sonner's API with the shared
 * contract in {@link ./toast-types}:
 *
 * - `position: 'top' | 'bottom'` maps to Sonner's centred corners — the default is
 *   `top` on web (bottom on native)
 * - `duration: 0` (sticky) maps to Sonner's `Infinity`
 * - `variant` fills the pill with the matching Button colour (see
 *   {@link ./toast-variants}) — the same palette the native twin uses
 * - `action.onPress` maps to Sonner's `action.onClick`
 * - `onClose` maps to Sonner's `onDismiss`, which fires on auto-, tap- and
 *   programmatic dismissal alike
 * - `glass` maps to a frosted inline style (a `glass` tint over a `backdrop-filter`
 *   blur), mirroring the native `Surface` frost
 *
 * Sonner's surface/foreground colours are re-pointed at the repo's theme tokens
 * (see {@link THEME_VARS}) and its border is dropped, so the web toast follows the
 * active theme and any consumer `@theme` overrides instead of Sonner's hardcoded
 * palette.
 *
 * The `testID` prop is ignored here — Sonner owns the DOM on web.
 */

const SONNER_POSITION: Record<ToastPosition, 'top-center' | 'bottom-center'> = {
  top: 'top-center',
  bottom: 'bottom-center',
};

/**
 * The frosted-glass toast style — a translucent `glass` tint over a CSS
 * `backdrop-filter` blur (the same treatment the native `Surface` applies).
 * Set per-toast via `toast(…, { glass: true })`, or as the `<Toaster glass>`
 * default.
 */
const GLASS_STYLE: CSSProperties = {
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  backgroundColor: 'var(--color-glass)',
};

/**
 * Sonner's theme vars re-pointed at the repo's semantic tokens, so the toast's
 * surface/foreground colours adapt to the theme and its border is dropped
 * (Sonner draws a 1px border with `--normal-border`, so it is keyed to
 * `transparent`). Custom CSS properties aren't part of `CSSProperties`, hence
 * the cast.
 */
// biome-ignore lint/plugin: ts/no-as-cast — CSS custom properties (`--normal-bg`, …) aren't part of the closed `CSSProperties` index
const THEME_VARS = {
  '--normal-bg': 'var(--color-surface-3)',
  '--normal-border': 'transparent',
  '--normal-text': 'var(--color-foreground)',
} as CSSProperties;

/**
 * Shrink the web toast to its content instead of Sonner's fixed 356px box, and
 * re-centre it (Sonner centres by filling a fixed-width column, so a narrower
 * toast would otherwise hug the left edge). `maxWidth` keeps a long message
 * wrapping at a readable measure.
 */
const TOAST_STYLE: CSSProperties = {
  width: 'fit-content',
  maxWidth: 356,
  left: 0,
  right: 0,
  marginLeft: 'auto',
  marginRight: 'auto',
};

/**
 * The solid (non-glass) pill's inline style — the variant's fill and ink,
 * resolved to the same `--color-*` tokens the native twin reads. Sonner's title
 * inherits the toast `color`, and `richColors` makes the description inherit it
 * too.
 */
function solidStyle(variant: ToastVariant): CSSProperties {
  return {
    backgroundColor: `var(--color-${TOAST_FILL_TOKEN[variant]})`,
    color: `var(--color-${TOAST_FOREGROUND_TOKEN[variant]})`,
  };
}

/** The default status glyph for a semantic variant, themed to the pill. A glass
 *  pill keeps the variant's hue on the frosted surface; a solid pill uses the
 *  fill's legible ink. Neutral and the Button fills render no glyph. */
function statusIcon(variant: ToastVariant, glass: boolean): ReactNode {
  const Icon = TOAST_STATUS_ICON[variant];
  if (!Icon) return null;
  return <ThemedIcon icon={Icon} token={glass ? TOAST_FILL_TOKEN[variant] : TOAST_FOREGROUND_TOKEN[variant]} size={16} />;
}

/**
 * The `<Toaster glass>` default, mirrored into a module variable so `toast()`
 * (which has no access to the mounted `<Toaster>`'s props) can resolve it —
 * the same hand-off the native twin does through `setToastDefaults`.
 */
let defaultGlass = false;

/** Translate a shared {@link ToastOptions} into Sonner's `ExternalToast`. */
function toSonnerOptions(options?: ToastOptions): ExternalToast {
  const { variant = 'neutral', position, duration, description, action, onClose, glass } = options ?? {};
  const frosted = glass ?? defaultGlass;
  return {
    position: position === undefined ? undefined : SONNER_POSITION[position],
    duration: duration === 0 ? Number.POSITIVE_INFINITY : duration,
    description,
    action: action === undefined ? undefined : { label: action.label, onClick: () => action.onPress() },
    onDismiss: onClose,
    // Sonner's variant methods (success/error/…) only colour an icon, so every
    // toast routes through the plain `sonnerToast` and the variant is drawn by
    // the fill/ink inline style instead — matching the native pill.
    richColors: true,
    icon: statusIcon(variant, frosted),
    style: frosted ? GLASS_STYLE : solidStyle(variant),
  };
}

/** Route a toast through Sonner with the shared `variant` fill/ink applied. */
function show(message: string, options?: ToastOptions): string {
  return String(sonnerToast(message, toSonnerOptions(options)));
}

export function Toaster({ position = 'top', duration, glass = false, offset }: ToasterProps) {
  // biome-ignore lint/plugin: sync the Toaster's glass default into the module variable toast() reads — an external system whose change only matters post-commit
  useEffect(() => {
    defaultGlass = glass;
  }, [glass]);

  return (
    <SonnerToaster
      theme="system"
      position={SONNER_POSITION[position]}
      duration={duration}
      offset={offset}
      style={THEME_VARS}
      toastOptions={{ style: TOAST_STYLE }}
    />
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: `toast` is the imperative half of the toaster's public API and must ship from the same subpath as `<Toaster>`
export const toast: ToastApi = Object.assign((message: string, options?: ToastOptions) => show(message, options), {
  success: (message: string, options?: ToastOptions) => show(message, { ...options, variant: 'success' }),
  error: (message: string, options?: ToastOptions) => show(message, { ...options, variant: 'danger' }),
  warning: (message: string, options?: ToastOptions) => show(message, { ...options, variant: 'warning' }),
  info: (message: string, options?: ToastOptions) => show(message, { ...options, variant: 'info' }),
  dismiss: (id?: string) => {
    sonnerToast.dismiss(id);
  },
});
