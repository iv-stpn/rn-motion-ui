import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSafeInsets } from '../../../hooks/use-safe-insets';
import { cn } from '../../../lib/cn';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { MOTION_STANDARD, TIMING_FAST } from '../../../theme/motion';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Surface } from '../../display/Surface/surface';
import { Text } from '../../typography/Text/text';

import { TOAST_STATUS_ICON } from './toast-icons';
import { TOAST_SIZE, TOAST_SIZE_DEFAULT } from './toast-scale';
import { dismissToast, getToasts, setToastDefaults, subscribeToasts, TOAST_DURATION_DEFAULT } from './toast-store';
import type { Toast, ToasterProps, ToastPosition } from './toast-types';
import { TOAST_FILL_TOKEN, TOAST_FOREGROUND_TOKEN, TOAST_GLASS_ALPHA } from './toast-variants';

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
 * `Rim` specular edge) tinted with the variant's own fill — a translucent,
 * on-variant wash rather than the neutral `glass` token (degrading to that tint
 * when the optional blur peer is absent).
 */

/** Backdrop blur radius (dp) the frosted-glass pill applies. */
const GLASS_BLUR = 12;

/** Width cap so a long message wraps instead of stretching the pill full-width. */
const PILL_CLASSNAME = 'max-w-[340px]';

/** Px a toast travels from its edge as it enters and leaves. */
const SLIDE = 24;

/** Corner radius (px) a pill toast uses for its glass rim + blur clip — large
 *  enough that SVG clamps it to half the pill's height, i.e. a capsule. */
const PILL_RADIUS = 9999;

type ToastItemProps = { toast: Toast; position: ToastPosition; testID: string };

function ToastItem({ toast, position, testID }: ToastItemProps) {
  const fillColor = useThemeColor(TOAST_FILL_TOKEN[toast.variant]);
  const inkColor = useThemeColor(TOAST_FOREGROUND_TOKEN[toast.variant]);
  const travel = position === 'top' ? -SLIDE : SLIDE;
  const handleDismiss = useCallback(() => dismissToast(toast.id), [toast.id]);
  const glass = toast.glass;
  const pill = toast.pill;
  const geometry = TOAST_SIZE[toast.size];
  const Icon = TOAST_STATUS_ICON[toast.variant];

  return (
    <Surface
      as={MotiView}
      elevation={3}
      radius={pill ? undefined : 'menu'}
      borderRadius={pill ? PILL_RADIUS : undefined}
      blurRadius={glass ? GLASS_BLUR : 0}
      rim={glass}
      tint={fillColor}
      opacity={TOAST_GLASS_ALPHA}
      from={{ opacity: 0, translateY: travel }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: travel }}
      transition={MOTION_STANDARD}
      exitTransition={TIMING_FAST}
      className={cn(PILL_CLASSNAME, pill && 'rounded-full')}
      // The variant fill tints the pill: a solid pill paints it as the opaque
      // background, a glass pill hands it to the Surface's frost as the `tint`.
      style={glass ? undefined : { backgroundColor: fillColor }}
      testID={`${testID}-${toast.id}`}
      accessibilityLiveRegion={toast.variant === 'danger' ? 'assertive' : 'polite'}
    >
      <Pressable
        className="flex-row items-center"
        style={{ gap: geometry.gap, paddingHorizontal: geometry.padX, paddingVertical: geometry.padY }}
        onPress={handleDismiss}
        // The whole pill dismisses. It is a button only when there is no nested
        // action button — an action makes the pill a frame around that button,
        // and nesting one `<button>` in another is invalid DOM on web.
        accessibilityRole={toast.action ? undefined : 'button'}
        accessibilityLabel={toast.action ? undefined : 'Dismiss notification'}
      >
        {Icon ? <Icon size={geometry.icon} color={inkColor} /> : null}
        <View className="min-w-0 shrink gap-0.5">
          <Text size={geometry.message.token} weight="medium" style={{ color: inkColor }}>
            {toast.message}
          </Text>
          {toast.description ? (
            <Text size={geometry.description} style={{ color: inkColor }}>
              {toast.description}
            </Text>
          ) : null}
        </View>
        {toast.action ? (
          <Pressable accessibilityRole="button" className="ml-1" onPress={toast.action.onPress}>
            <Text size="sm" weight="semibold" style={{ color: inkColor }}>
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
  pill = false,
  size = TOAST_SIZE_DEFAULT,
  offset = 16,
  testID = 'toaster',
}: ToasterProps) {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);
  const insets = useSafeInsets();

  // biome-ignore lint/plugin: sync the Toaster props into the module-level store defaults — an external system whose change only matters post-commit
  useEffect(() => {
    setToastDefaults({ position, duration, glass, pill, size });
  }, [position, duration, glass, pill, size]);

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
