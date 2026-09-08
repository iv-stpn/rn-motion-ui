import type { CSSProperties } from 'react';
import type { ExternalToast } from 'sonner';
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';

import type { ToastApi, ToasterProps, ToastOptions, ToastPosition } from './toast-types';

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
 * - `action.onPress` maps to Sonner's `action.onClick`
 * - `onClose` maps to Sonner's `onDismiss`, which fires on auto-, tap- and
 *   programmatic dismissal alike
 * - `glass` maps to a frosted inline style (a `glass` tint over a `backdrop-filter`
 *   blur), mirroring the native `Surface` frost
 *
 * Sonner's surface/foreground/border colours are re-pointed at the repo's theme
 * tokens (see {@link THEME_VARS}), so the web toast follows the active theme and
 * any consumer `@theme` overrides instead of Sonner's hardcoded palette.
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

/** The explicit solid override for `toast(…, { glass: false })` under a glass default. */
const SOLID_STYLE: CSSProperties = {
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
  backgroundColor: 'var(--color-surface-4)',
};

/**
 * Sonner's theme vars re-pointed at the repo's semantic tokens, so the toast's
 * surface/foreground/border and status colours adapt to the theme. Custom CSS
 * properties aren't part of `CSSProperties`, hence the cast.
 */
// biome-ignore lint/plugin: ts/no-as-cast — CSS custom properties (`--normal-bg`, …) aren't part of the closed `CSSProperties` index
const THEME_VARS = {
  '--normal-bg': 'var(--color-surface-4)',
  '--normal-border': 'var(--color-border)',
  '--normal-text': 'var(--color-foreground)',
  '--success-text': 'var(--color-success)',
  '--error-text': 'var(--color-danger)',
  '--warning-text': 'var(--color-warning)',
  '--info-text': 'var(--color-info)',
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

/** Resolve a `glass` option to its inline style — frosted, explicit solid, or none. */
function glassStyle(glass: boolean | undefined): CSSProperties | undefined {
  if (glass === true) return GLASS_STYLE;
  if (glass === false) return SOLID_STYLE;
}

/** Translate a shared {@link ToastOptions} into Sonner's `ExternalToast`. */
function toSonnerOptions(options?: ToastOptions): ExternalToast {
  const { variant: _variant, position, duration, description, action, onClose, glass } = options ?? {};
  return {
    position: position === undefined ? undefined : SONNER_POSITION[position],
    duration: duration === 0 ? Number.POSITIVE_INFINITY : duration,
    description,
    action: action === undefined ? undefined : { label: action.label, onClick: () => action.onPress() },
    onDismiss: onClose,
    style: glassStyle(glass),
  };
}

/** Route a toast through Sonner, honouring the shared `variant` option. */
function show(message: string, options?: ToastOptions): string {
  const sonnerOptions = toSonnerOptions(options);
  switch (options?.variant ?? 'default') {
    case 'success':
      return String(sonnerToast.success(message, sonnerOptions));
    case 'error':
      return String(sonnerToast.error(message, sonnerOptions));
    case 'warning':
      return String(sonnerToast.warning(message, sonnerOptions));
    case 'info':
      return String(sonnerToast.info(message, sonnerOptions));
    default:
      return String(sonnerToast(message, sonnerOptions));
  }
}

export function Toaster({ position = 'top', duration, glass = false, offset }: ToasterProps) {
  return (
    <SonnerToaster
      theme="system"
      position={SONNER_POSITION[position]}
      duration={duration}
      offset={offset}
      style={THEME_VARS}
      toastOptions={{ style: glass ? { ...TOAST_STYLE, ...GLASS_STYLE } : TOAST_STYLE }}
    />
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: `toast` is the imperative half of the toaster's public API and must ship from the same subpath as `<Toaster>`
export const toast: ToastApi = Object.assign((message: string, options?: ToastOptions) => show(message, options), {
  success: (message: string, options?: ToastOptions) => show(message, { ...options, variant: 'success' }),
  error: (message: string, options?: ToastOptions) => show(message, { ...options, variant: 'error' }),
  warning: (message: string, options?: ToastOptions) => show(message, { ...options, variant: 'warning' }),
  info: (message: string, options?: ToastOptions) => show(message, { ...options, variant: 'info' }),
  dismiss: (id?: string) => {
    sonnerToast.dismiss(id);
  },
});
