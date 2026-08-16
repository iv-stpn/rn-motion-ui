/**
 * Web twin of the HoldMenu haptics module.
 *
 * `expo-haptics` is a native module and must never be imported into a web
 * bundle. This no-op twin is what the extensionless import
 * (`./hold-menu-haptics`) resolves to on web, so the gesture code can call
 * `fireHapticFeedback` unconditionally and web simply does nothing.
 *
 * The type lives here so the native module (`hold-menu-haptics.native.ts`)
 * imports it from this file — the extensionless import that Metro splits by
 * platform.
 */

/** Upstream's `hapticFeedback` style names, verbatim. */
export type HoldMenuHapticFeedback = 'None' | 'Selection' | 'Light' | 'Medium' | 'Heavy' | 'Success' | 'Warning' | 'Error';

/** Web has no haptics — the call is a no-op, and the gesture path stays identical. */
export function fireHapticFeedback(_feedback?: HoldMenuHapticFeedback): void {
  // no-op: nothing to vibrate on web, and expo-haptics never enters this bundle.
}
