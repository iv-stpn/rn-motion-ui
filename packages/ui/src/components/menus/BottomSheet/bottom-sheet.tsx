import { type ReactNode, useCallback, useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useFocusTrap } from '../../../hooks/use-focus-trap';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { useSafeInsets } from '../../../hooks/use-safe-insets';
import { cn } from '../../../lib/cn';
import { SURFACE_CLASSNAME } from '../../../lib/elevated';
import { OverlayOutlet } from '../Overlay/overlay-portal';
import { useSheetPresence } from '../Overlay/use-sheet-presence';

const HANDLE_HEIGHT = 28;
const IS_ANDROID = Platform.OS === 'android';

const styles = StyleSheet.create({
  sheetContainer: {
    zIndex: 1,
    ...(IS_ANDROID ? { elevation: 24 } : null),
  },
});

type SheetHandleProps = { className?: string };

function SheetHandle({ className }: SheetHandleProps) {
  return (
    // The grabber is a drag affordance for pointers only — there is no
    // equivalent gesture for a screen reader, and the sheet is dismissed via the
    // backdrop button or the back gesture instead, so it stays out of the tree.
    <View
      className={cn('items-center justify-center', className)}
      style={{ height: HANDLE_HEIGHT }}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
      aria-hidden={true}
    >
      <View className="h-1 w-12 rounded-full bg-border/80" />
    </View>
  );
}

export type BottomSheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  containerClassName?: string;
  onAfterClose?: () => void;
  /** When true, the sheet stretches to full screen height instead of capping at 90%. */
  fullSheet?: boolean;
  /** When false, clicking the overlay will not close the sheet. Defaults to true. */
  closeOnOverlayClick?: boolean;
  // Phase 5.4 — slot classNames
  /** Additional class names merged onto the drag handle bar. */
  handleClassName?: string;
  /** Additional class names merged onto the backdrop overlay. */
  backdropClassName?: string;
  /**
   * Wrap content in device safe-area insets (home indicator bottom; also status
   * bar top when `fullSheet` is true). Requires `react-native-safe-area-context`
   * and `<SafeAreaProvider>` in the tree. Set to `false` to manage insets
   * yourself. @default true
   */
  safeArea?: boolean;
  /**
   * Names the sheet for assistive technology. Pass the same words as the
   * visible heading so the announcement matches what is on screen; without it
   * the dialog is announced only as "dialog".
   */
  accessibilityLabel?: string;
  /**
   * Label for the backdrop's dismiss button, which is how a screen-reader user
   * closes the sheet (the drag handle has no accessible equivalent).
   * @default 'Close'
   */
  closeAccessibilityLabel?: string;
  testID?: string;
};

export function BottomSheet({
  open,
  onOpenChange,
  children,
  containerClassName,
  onAfterClose,
  fullSheet,
  closeOnOverlayClick = true,
  handleClassName,
  backdropClassName,
  safeArea = true,
  accessibilityLabel,
  closeAccessibilityLabel = 'Close',
  testID,
}: BottomSheetProps) {
  const isOpen = open ?? false;
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const insets = useSafeInsets();
  const sheetRef = useRef<View>(null);
  // Native gets containment from Modal + accessibilityViewIsModal; on web the
  // Modal is a plain fixed div and Tab would walk out into the page behind it.
  useFocusTrap(sheetRef, isOpen);
  const { isMounted, translateY } = useSheetPresence({
    open: isOpen,
    screenExtent: height,
    onAfterClose,
    reducedMotion: reduced,
  });
  const dragStartY = useSharedValue(0);

  const handleClose = useCallback(() => {
    onOpenChange?.(false);
  }, [onOpenChange]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateY.value, [0, height], [1, 0], Extrapolation.CLAMP);
    return { opacity };
  });

  const handleGesture = Gesture.Pan()
    .onBegin(() => {
      dragStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateY.value = Math.max(0, dragStartY.value + event.translationY);
    })
    .onEnd((event) => {
      const shouldDismiss = translateY.value > height * 0.18 || event.velocityY > 1200;
      if (shouldDismiss) {
        scheduleOnRN(handleClose);
        return;
      }
      translateY.value = withSpring(0, { damping: 40, stiffness: 300, overshootClamping: true });
    });

  const handleOverlayPress = useCallback(() => {
    if (closeOnOverlayClick) handleClose();
  }, [closeOnOverlayClick, handleClose]);

  if (!isMounted) return null;

  return (
    <Modal
      visible={isMounted}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      hardwareAccelerated={IS_ANDROID}
      onRequestClose={handleClose}
      accessibilityViewIsModal={true}
      aria-modal={true}
    >
      <View className="flex-1" style={{ pointerEvents: 'box-none' }}>
        <Animated.View
          renderToHardwareTextureAndroid={IS_ANDROID}
          className={backdropClassName}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0, 0, 0, 0.45)' /* scrim — theme-independent */, pointerEvents: 'none' },
            backdropStyle,
          ]}
        />
        <View className="flex-1 justify-end">
          {fullSheet ? null : (
            // The backdrop is also the only dismiss control a screen-reader or
            // keyboard user can reach — the drag handle is pointer-only — so it
            // carries a real button role and label rather than being an
            // unlabelled tap target. When `closeOnOverlayClick` is off it does
            // nothing, and it leaves the a11y tree instead of lying about it.
            <View pointerEvents={open && closeOnOverlayClick ? 'auto' : 'none'} className="flex-1">
              <Pressable
                onPress={handleOverlayPress}
                className="flex-1"
                accessibilityRole={closeOnOverlayClick ? 'button' : undefined}
                accessibilityLabel={closeOnOverlayClick ? closeAccessibilityLabel : undefined}
                accessibilityElementsHidden={!closeOnOverlayClick}
                importantForAccessibility={closeOnOverlayClick ? 'yes' : 'no-hide-descendants'}
                aria-hidden={closeOnOverlayClick ? undefined : true}
                focusable={closeOnOverlayClick}
                testID={testID ? `${testID}-backdrop` : undefined}
              />
            </View>
          )}
          <GestureDetector gesture={handleGesture}>
            <Animated.View renderToHardwareTextureAndroid={IS_ANDROID} style={[sheetStyle, styles.sheetContainer]}>
              <View
                ref={sheetRef}
                className={cn('w-full overflow-hidden', SURFACE_CLASSNAME[3], fullSheet ? 'rounded-t-none' : 'rounded-t-modal')}
                testID={testID}
                role="dialog"
                aria-modal={true}
                accessibilityViewIsModal={true}
                aria-label={accessibilityLabel}
                accessibilityLabel={accessibilityLabel}
                style={{
                  maxHeight: fullSheet ? height : Math.round(height * 0.9),
                  height: fullSheet ? height : undefined,
                }}
              >
                {fullSheet ? null : <SheetHandle className={handleClassName} />}
                <View
                  className={cn('min-h-0 grow', containerClassName)}
                  style={safeArea ? { paddingTop: fullSheet ? insets.top : 0, paddingBottom: insets.bottom } : undefined}
                >
                  {children}
                </View>
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
        {/* Overlay outlet: above the sheet, outside the scroll containers and
            drag gesture. Touch-transparent on its empty areas. */}
        <OverlayOutlet />
      </View>
    </Modal>
  );
}
