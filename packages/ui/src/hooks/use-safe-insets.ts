type SafeInsets = { top: number; bottom: number; left: number; right: number };

const ZERO: SafeInsets = { top: 0, bottom: 0, left: 0, right: 0 };

function resolveHook(): () => SafeInsets {
  try {
    // Optional peer dep — consumers must install react-native-safe-area-context and
    // wrap their app in <SafeAreaProvider> for correct values. If absent, zeros are used.
    // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
    // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
    const mod = require('react-native-safe-area-context') as { useSafeAreaInsets: () => SafeInsets };
    return mod.useSafeAreaInsets;
  } catch {
    return () => ZERO;
  }
}

/**
 * Returns device safe-area insets when `react-native-safe-area-context` is installed,
 * otherwise `{ top: 0, bottom: 0, left: 0, right: 0 }`.
 *
 * Requires `<SafeAreaProvider>` from that package somewhere above in the tree.
 */
export const useSafeInsets: () => SafeInsets = resolveHook();
export type { SafeInsets };
