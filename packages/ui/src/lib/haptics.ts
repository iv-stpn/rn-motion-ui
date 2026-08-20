import type { HapticFeedbackVariant } from './haptics-types';

/**
 * Web twin of the haptics module.
 *
 * `expo-haptics` is a native module and must never be imported into a web
 * bundle. This no-op twin is what the extensionless import (`./haptics`)
 * resolves to on web, so gesture code can call `fireHapticFeedback`
 * unconditionally and web simply does nothing.
 */
export function fireHapticFeedback(_feedback?: HapticFeedbackVariant): void {
  // no-op: nothing to vibrate on web, and expo-haptics never enters this bundle.
}
