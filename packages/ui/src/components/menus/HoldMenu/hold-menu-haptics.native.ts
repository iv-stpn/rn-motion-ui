/**
 * Native half of the HoldMenu haptics module, backed by `expo-haptics` when it
 * is installed — it is an optional peer dependency, so this module falls back
 * to RN's `Vibration` (Android only) when the package is absent.
 *
 * `expo-haptics` is never a static import anywhere in this package: the only
 * reference is the guarded `require` below, exactly like
 * `use-safe-insets.ts` resolves `react-native-safe-area-context`. The web twin
 * (`hold-menu-haptics.ts`) is a no-op, and the modules are imported
 * extensionless (`./hold-menu-haptics`), so `expo-haptics` never enters a web
 * bundle.
 */

import { Platform, Vibration } from 'react-native';
import type { HoldMenuHapticFeedback } from './hold-menu-haptics';

type HapticsModule = {
  selectionAsync: () => Promise<void>;
  impactAsync: (style: number) => Promise<void>;
  notificationAsync: (type: number) => Promise<void>;
  ImpactFeedbackStyle: Record<'Light' | 'Medium' | 'Heavy', number>;
  NotificationFeedbackType: Record<'Success' | 'Warning' | 'Error', number>;
};

/** Resolves expo-haptics' surface when the optional peer is installed, `null` otherwise. */
function resolveHaptics(): HapticsModule | null {
  try {
    // Optional peer dep — menu activation feedback; consumers without expo-haptics fall back to Vibration.
    // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
    // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
    const mod = require('expo-haptics') as HapticsModule;
    return mod;
  } catch {
    return null;
  }
}

const Haptics = resolveHaptics();

/**
 * Fires the given haptic feedback on activation.
 *
 * With `expo-haptics` installed this maps the upstream style names onto its
 * API (`selectionAsync`, `impactAsync`, `notificationAsync`). Without it,
 * Android buzzes through `Vibration` — a short pulse that still reads as
 * feedback — and iOS stays silent, because RN's `Vibration` on iOS ignores
 * durations and fires a 400 ms buzz that is wrong for a menu opening.
 */
export function fireHapticFeedback(feedback?: HoldMenuHapticFeedback): void {
  if (!feedback || feedback === 'None') return;

  if (Haptics) {
    switch (feedback) {
      case 'Selection':
        Haptics.selectionAsync();
        break;
      case 'Light':
      case 'Medium':
      case 'Heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle[feedback]);
        break;
      case 'Success':
      case 'Warning':
      case 'Error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType[feedback]);
        break;
      default:
        break;
    }
    return;
  }

  if (Platform.OS === 'android') {
    switch (feedback) {
      case 'Selection':
        Vibration.vibrate(10);
        break;
      case 'Light':
      case 'Medium':
      case 'Heavy':
        Vibration.vibrate(20);
        break;
      default:
        break;
    }
  }
}
