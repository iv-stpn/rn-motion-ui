/**
 * Shared public types for the Toaster — the single contract both the web
 * (Sonner-backed) and native (custom) twins conform to, so
 * `import { Toaster, toast } from 'rn-motion-ui/toaster'` behaves identically on
 * every platform.
 *
 * No react-native or sonner import here: this module is type-only and imported
 * by both twins, so it stays free of platform coupling.
 */

/** The accent a toast carries — drives its status colour and icon. */
export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

/** Which screen edge a toast appears against. */
export type ToastPosition = 'top' | 'bottom';

/** An optional trailing action button on a toast. */
export type ToastAction = { label: string; onPress: () => void };

/** Per-toast options passed to {@link toast} and its variant helpers. */
export type ToastOptions = {
  /** Accent variant. @default 'default' */
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
  /** Default duration for toasts that omit `duration`. @default 4000 */
  duration?: number;
  /** Default glass mode for `toast()` calls that omit `glass`. @default false */
  glass?: boolean;
  /** Gap in px between the screen edge (plus safe insets) and the first toast. */
  offset?: number;
  /**
   * Root testID for the native viewport; each toast derives `${testID}-toast-<id>`.
   * Ignored on web, where Sonner owns the DOM.
   */
  testID?: string;
};
