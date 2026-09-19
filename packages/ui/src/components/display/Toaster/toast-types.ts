import type { BreakpointValue } from '../../../lib/breakpoints';

/**
 * Shared public types for the Toaster — the single contract both the web
 * (Sonner-backed) and native (custom) twins conform to, so
 * `import { Toaster, toast } from 'rn-motion-ui/toaster'` behaves identically on
 * every platform.
 *
 * No react-native or sonner import here: this module is type-only and imported
 * by both twins, so it stays free of platform coupling.
 */

/** The fill a toast carries — the same palette as a filled Button (see `button-variants.ts`). */
export type ToastVariant = 'primary' | 'secondary' | 'accent' | 'neutral' | 'danger' | 'success' | 'warning' | 'info';

/** Which screen edge a toast appears against. */
export type ToastPosition = 'top' | 'bottom';

/** The toast's size ramp — `sm` compact, `md` default, `lg` roomy. */
export type ToastSize = 'sm' | 'md' | 'lg';

/** An optional trailing action button on a toast. */
export type ToastAction = { label: string; onPress: () => void };

/** Per-toast options passed to {@link toast} and its variant helpers. */
export type ToastOptions = {
  /** Fill variant, matching the Button palette. @default 'neutral' */
  variant?: ToastVariant;
  /** Screen edge. @default the mounted `<Toaster>`'s `position` (top on web, bottom on native). */
  position?: ToastPosition;
  /** Milliseconds before auto-dismiss; `0` keeps the toast until dismissed. @default 4000 */
  duration?: number;
  /** Secondary line rendered under the message. */
  description?: string;
  /** Optional trailing action button. */
  action?: ToastAction;
  /** Called when the toast is dismissed — auto, tap, or `dismiss()`. */
  onClose?: () => void;
  /** Frosted-glass treatment instead of an opaque surface. @default false */
  glass?: boolean;
  /** Render as a fully-rounded capsule instead of a rounded rectangle. @default false */
  pill?: boolean;
  /** Size variant — compact / default / roomy. @default 'md' */
  size?: ToastSize;
};

/** A resolved toast, as held by the store and rendered by the native `<Toaster>`. */
export type Toast = {
  id: string;
  message: string;
  description?: string;
  variant: ToastVariant;
  position: ToastPosition;
  duration: number;
  action?: ToastAction;
  onClose?: () => void;
  /** Whether the toast renders with the frosted-glass treatment. */
  glass: boolean;
  /** Whether the toast renders as a fully-rounded capsule. */
  pill: boolean;
  /** Which size ramp the toast renders at. */
  size: ToastSize;
};

/**
 * The imperative toast API. Callable as `toast(message, options?)`, with one
 * helper per variant plus `dismiss(id?)` (omit `id` to dismiss every toast).
 */
export type ToastApi = {
  (message: string, options?: ToastOptions): string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  dismiss: (id?: string) => void;
};

/** Props for the `<Toaster />` viewport component. */
export type ToasterProps = {
  /** Default edge for `toast()` calls that omit `position`. @default 'top' on web, 'bottom' on native */
  position?: ToastPosition;
  /**
   * Default edge on small screens (narrower than `wideBreakpoint`). Overrides
   * `position` when set. Falls back to `position` when omitted.
   */
  smallScreenPosition?: ToastPosition;
  /**
   * Default edge on large screens (`wideBreakpoint` and wider). Overrides
   * `position` when set. Falls back to `position` when omitted.
   */
  largeScreenPosition?: ToastPosition;
  /**
   * Width at which `largeScreenPosition` takes over — a breakpoint name or a raw
   * pixel number. @default 'sm' (640)
   */
  wideBreakpoint?: BreakpointValue;
  /** Default duration for toasts that omit `duration`. @default 4000 */
  duration?: number;
  /** Default glass mode for `toast()` calls that omit `glass`. @default false */
  glass?: boolean;
  /** Default pill mode for `toast()` calls that omit `pill`. @default false */
  pill?: boolean;
  /** Default size for `toast()` calls that omit `size`. @default 'md' */
  size?: ToastSize;
  /** Gap in px between the screen edge (plus safe insets) and the first toast. */
  offset?: number;
  /**
   * Root testID for the native viewport; each toast derives `${testID}-toast-<id>`.
   * Ignored on web, where Sonner owns the DOM.
   */
  testID?: string;
};
