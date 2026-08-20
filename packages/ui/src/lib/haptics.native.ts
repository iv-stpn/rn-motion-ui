import { ImpactFeedbackStyle, impactAsync, NotificationFeedbackType, notificationAsync, selectionAsync } from 'expo-haptics';
import type { HapticFeedbackVariant } from './haptics-types';

/**
 * Native half of the haptics module, backed by `expo-haptics`.
 *
 * `expo-haptics` is a hard dependency of the package, so it is a static import
 * here and never enters a web bundle: the web twin (`haptics.ts`) is a no-op,
 * and the modules are imported extensionless (`./haptics`), so Metro resolves
 * this `.native` file on iOS/Android and the no-op twin on web.
 *
 * An omitted `feedback` falls back to `'Medium'`, exactly as HoldMenu's old
 * `hapticResponse` did (`!hapticFeedback ? 'Medium' : hapticFeedback`).
 */
export function fireHapticFeedback(feedback?: HapticFeedbackVariant): void {
  const style: HapticFeedbackVariant = feedback ?? 'Medium';

  switch (style) {
    case 'Selection':
      selectionAsync();
      break;
    case 'Light':
    case 'Medium':
    case 'Heavy':
      impactAsync(ImpactFeedbackStyle[style]);
      break;
    case 'Success':
    case 'Warning':
    case 'Error':
      notificationAsync(NotificationFeedbackType[style]);
      break;
    default:
      break;
  }
}
