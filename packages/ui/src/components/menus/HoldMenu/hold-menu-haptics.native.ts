/**
 * Native half of the HoldMenu haptics module, backed by `expo-haptics`.
 *
 * `expo-haptics` is a hard dependency of the package, so it is a static import
 * here and never enters a web bundle: the web twin (`hold-menu-haptics.ts`) is
 * a no-op, and the modules are imported extensionless (`./hold-menu-haptics`),
 * so Metro resolves this `.native` file on iOS/Android and the no-op twin on
 * web.
 */

import { ImpactFeedbackStyle, impactAsync, NotificationFeedbackType, notificationAsync, selectionAsync } from 'expo-haptics';
import type { HoldMenuHapticFeedback } from './hold-menu-haptics';

/**
 * Fires the given haptic feedback on activation, mapping the upstream style
 * names onto expo-haptics' API (`selectionAsync`, `impactAsync`,
 * `notificationAsync`).
 */
export function fireHapticFeedback(feedback?: HoldMenuHapticFeedback): void {
  if (!feedback || feedback === 'None') return;

  switch (feedback) {
    case 'Selection':
      selectionAsync();
      break;
    case 'Light':
    case 'Medium':
    case 'Heavy':
      impactAsync(ImpactFeedbackStyle[feedback]);
      break;
    case 'Success':
    case 'Warning':
    case 'Error':
      notificationAsync(NotificationFeedbackType[feedback]);
      break;
    default:
      break;
  }
}
