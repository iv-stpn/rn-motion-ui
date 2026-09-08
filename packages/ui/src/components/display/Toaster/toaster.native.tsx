import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSafeInsets } from '../../../hooks/use-safe-insets';
import { cn } from '../../../lib/cn';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { MOTION_STANDARD, TIMING_FAST } from '../../../theme/motion';
import { type ThemeToken, useThemeColor } from '../../../theme/use-theme-color';
import { Surface } from '../../display/Surface/surface';
import { Text } from '../../typography/Text/text';

import { dismissToast, getToasts, setToastDefaults, subscribeToasts, TOAST_DURATION_DEFAULT } from './toast-store';
import type { Toast, ToasterProps, ToastPosition, ToastVariant } from './toast-types';

/**
 * The native twin of the `Toaster` — a custom, Reanimated-driven toast.
 *
 * `toast()` writes to a module-level store (`./toast-store`) rather than a context,
 * so it works from anywhere without a provider. This component subscribes to that
 * store via `useSyncExternalStore` and renders each toast as a `MotiView` pill that
 * slides in from its edge, auto-dismisses (or stays until tapped when `duration: 0`),
 * and slides back out through `AnimatePresence`. Inspired by
 * https://github.com/rit3zh/expo-animated-toast.
 *
 * The pill is drawn by the shared {@link Surface} primitive, so a `glass` toast
 * trades the opaque `surface` fill for the frosted treatment (backdrop blur +
 * `Rim` specular edge, degrading to the translucent `glass` tint when the optional
 * blur peer is absent).
 */

/** The semantic status colour each variant's dot resolves to. */
const VARIANT_TOKEN: Record<ToastVariant, ThemeToken> = {
  default: 'muted-foreground',
  success: 'success',
  error: 'danger',
  warning: 'warning',
  info: 'info',
};

/** Backdrop blur radius (dp) the frosted-glass pill applies. */
const GLASS_BLUR = 12;

/** Width cap so a long message wraps instead of stretching the pill full-width. */
const PILL_CLASSNAME = 'max-w-[340px]';

/** Px a toast travels from its edge as it enters and leaves. */
const SLIDE = 24;

type ToastItemProps = { toast: Toast; position: ToastPosition; testID: string };

function ToastItem({ toast, position, testID }: ToastItemProps) {
  const dotColor = useThemeColor(VARIANT_TOKEN[toast.variant]);
  const travel = position === 'top' ? -SLIDE : SLIDE;
  const handleDismiss = useCallback(() => dismissToast(toast.id), [toast.id]);
  const glass = toast.glass;

  return (
    <Surface
      as={MotiView}
      elevation={4}
      radius="menu"
      blurRadius={glass ? GLASS_BLUR : 0}
      rim={glass}
      from={{ opacity: 0, translateY: travel }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: travel }}
      transition={MOTION_STANDARD}
      exitTransition={TIMING_FAST}
      className={cn(PILL_CLASSNAME, glass ? undefined : 'border-[1.5px] border-border')}
      testID={`${testID}-${toast.id}`}
      accessibilityLiveRegion="polite"
    >
      <Pressable className="flex-row items-center gap-2.5 px-3.5 py-2.5" onPress={handleDismiss}>
        <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
        <View className="min-w-0 shrink gap-0.5">
          <Text size="sm" weight="medium">
            {toast.message}
          </Text>
          {toast.description ? (
            <Text className="text-muted-foreground" size="xs">
              {toast.description}
            </Text>
          ) : null}
        </View>
        {toast.action ? (
          <Pressable accessibilityRole="button" className="ml-1" onPress={toast.action.onPress}>
            <Text className="text-primary" size="sm" weight="semibold">
              {toast.action.label}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Surface>
  );
}

// biome-ignore lint/performance/noBarrelFile: `toast` is the imperative half of the toaster's public API — re-exported so it ships from the same subpath as `<Toaster>`, not a lazy barrel
export { toast } from './toast-store';

export function Toaster({
  position = 'bottom',
  duration = TOAST_DURATION_DEFAULT,
  glass = false,
  offset = 16,
  testID = 'toaster',
}: ToasterProps) {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);
  const insets = useSafeInsets();

  // biome-ignore lint/plugin: sync the Toaster props into the module-level store defaults — an external system whose change only matters post-commit
  useEffect(() => {
    setToastDefaults({ position, duration, glass });
  }, [position, duration, glass]);

  const topToasts = toasts.filter((toast) => toast.position === 'top');
  const bottomToasts = toasts.filter((toast) => toast.position === 'bottom');

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'flex-start', paddingTop: insets.top + offset }]}
        testID={testID}
      >
        <AnimatePresence>
          {topToasts.map((toast) => (
            <ToastItem key={toast.id} position="top" testID={testID} toast={toast} />
          ))}
        </AnimatePresence>
      </View>
      <View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: insets.bottom + offset },
        ]}
        testID={`${testID}-bottom`}
      >
        <AnimatePresence>
          {bottomToasts.map((toast) => (
            <ToastItem key={toast.id} position="bottom" testID={testID} toast={toast} />
          ))}
        </AnimatePresence>
      </View>
    </>
  );
}
