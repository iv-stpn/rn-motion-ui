import type { HoldMenuHapticFeedback } from './hold-menu-types';

/**
 * Web twin of the HoldMenu haptics module.
 *
 * `expo-haptics` is a native module and must never be imported into a web
 * bundle. This no-op twin is what the extensionless import (`./haptics`)
 * resolves to on web, so the activation code can call `fireHapticFeedback`
 * unconditionally and web simply does nothing.
 */
export function fireHapticFeedback(_feedback?: HoldMenuHapticFeedback): void {
  // no-op: nothing to vibrate on web, and expo-haptics never enters this bundle.
}
