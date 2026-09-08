/**
 * The native toast store — module-level state rather than a context, for the
 * same reason the drag store is: `toast()` must work from anywhere without the
 * caller being under a provider. The native `<Toaster>` subscribes via
 * `useSyncExternalStore` and renders the list; `toast()` and friends mutate it.
 *
 * No react-native import in this graph, so the store is unit-testable — see the
 * note in vitest's setup. The web twin never touches this module: it delegates
 * to Sonner and imports only the shared types from `./toast-types`.
 */

import type { Toast, ToastApi, ToastOptions, ToastPosition } from './toast-types';

type ToastDefaultsInput = { position?: ToastPosition; duration?: number; glass?: boolean };
type ResolvedToastDefaults = { position: ToastPosition; duration: number; glass: boolean };

const DEFAULT_DURATION = 4000;
const POSITION_DEFAULT: ToastPosition = 'bottom';
const GLASS_DEFAULT = false;

let toasts: Toast[] = [];
let idSeq = 0;
let defaultPosition: ToastPosition = POSITION_DEFAULT;
let defaultDuration = DEFAULT_DURATION;
let defaultGlass = GLASS_DEFAULT;

const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function notify() {
  for (const listener of listeners) listener();
}

/** Default auto-dismiss duration, ms — matches Sonner. */
export const TOAST_DURATION_DEFAULT = DEFAULT_DURATION;

/** Subscribe to toast-list changes. Pair with {@link getToasts} in `useSyncExternalStore`. */
export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current toast list, oldest first. Reference-stable between changes. */
export function getToasts(): readonly Toast[] {
  return toasts;
}

/**
 * Set the defaults `toast()` falls back to when a call omits `position`/`duration`/`glass`.
 * The native `<Toaster>` writes its props here so `toast()` honours them.
 */
export function setToastDefaults({ position, duration, glass }: ToastDefaultsInput): void {
  if (position !== undefined) defaultPosition = position;
  if (duration !== undefined) defaultDuration = duration;
  if (glass !== undefined) defaultGlass = glass;
}

/** The resolved defaults — what a `toast()` call uses when it omits the fields. */
export function getToastDefaults(): ResolvedToastDefaults {
  return { position: defaultPosition, duration: defaultDuration, glass: defaultGlass };
}

/** Push a toast and return its id. Schedules the auto-dismiss timer for `duration > 0`. */
export function showToast(message: string, options?: ToastOptions): string {
  idSeq += 1;
  const id = `toast-${idSeq}`;
  const duration = options?.duration ?? defaultDuration;
  const toast: Toast = {
    id,
    message,
    description: options?.description,
    variant: options?.variant ?? 'default',
    position: options?.position ?? defaultPosition,
    duration,
    action: options?.action,
    onClose: options?.onClose,
    glass: options?.glass ?? defaultGlass,
  };
  toasts = [...toasts, toast];
  if (duration > 0)
    timers.set(
      id,
      setTimeout(() => dismissToast(id), duration),
    );
  notify();
  return id;
}

/** Remove one toast (or every toast when `id` is omitted). Fires the toast's `onClose`. */
export function dismissToast(id?: string): void {
  if (id === undefined) {
    for (const toast of toasts) {
      const timer = timers.get(toast.id);
      if (timer !== undefined) clearTimeout(timer);
      timers.delete(toast.id);
      toast.onClose?.();
    }
    toasts = [];
    notify();
    return;
  }
  const toast = toasts.find((t) => t.id === id);
  if (toast === undefined) return;
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter((t) => t.id !== id);
  toast.onClose?.();
  notify();
}

/** Test seam: clear every toast, timer and default, and drop all subscribers. */
export function resetToastStore(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  toasts = [];
  idSeq = 0;
  defaultPosition = POSITION_DEFAULT;
  defaultDuration = TOAST_DURATION_DEFAULT;
  defaultGlass = GLASS_DEFAULT;
  listeners.clear();
}

/** Imperative toast API — see {@link ToastApi}. */
export const toast: ToastApi = Object.assign((message: string, options?: ToastOptions) => showToast(message, options), {
  success: (message: string, options?: ToastOptions) => showToast(message, { ...options, variant: 'success' }),
  error: (message: string, options?: ToastOptions) => showToast(message, { ...options, variant: 'error' }),
  warning: (message: string, options?: ToastOptions) => showToast(message, { ...options, variant: 'warning' }),
  info: (message: string, options?: ToastOptions) => showToast(message, { ...options, variant: 'info' }),
  dismiss: (id?: string) => dismissToast(id),
});
