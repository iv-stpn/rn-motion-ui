import { type ReactNode, useCallback } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
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
    <View className={cn('items-center justify-center', className)} style={{ height: HANDLE_HEIGHT }}>
      <View className="h-1 w-12 rounded-full bg-border/80" />
    </View>
  );
}

export type BottomSheetProps = {
  // New preferred API
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Deprecated aliases (kept for one minor release)
  /** @deprecated Use `open` instead. */
  visible?: boolean;
  /** @deprecated Use `onOpenChange` instead. */
  onClose?: () => void;
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
};

export function BottomSheet({
  open,
  onOpenChange,
  visible,
  onClose,
  children,
  containerClassName,
  onAfterClose,
  fullSheet,
  closeOnOverlayClick = true,
  handleClassName,
  backdropClassName,
}: BottomSheetProps) {
  const isOpen = open ?? visible ?? false;
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { isMounted, translateY } = useSheetPresence({
    open: isOpen,
    screenExtent: height,
    onAfterClose,
    reducedMotion: reduced,
  });
  const dragStartY = useSharedValue(0);

  const handleClose = useCallback(() => {
    onClose?.();
    onOpenChange?.(false);
  }, [onClose, onOpenChange]);

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
          {fullSheet ? null : <Pressable onPress={handleOverlayPress} className="flex-1" />}
          <GestureDetector gesture={handleGesture}>
            <Animated.View renderToHardwareTextureAndroid={IS_ANDROID} style={[sheetStyle, styles.sheetContainer]}>
              <View
                // biome-ignore lint/nursery/useSortedClasses: dynamic class — cannot sort across template-literal segments
                className={`w-full overflow-hidden bg-surface-3${fullSheet ? '' : ' rounded-t-2xl'}`}
                style={{
                  maxHeight: fullSheet ? height : Math.round(height * 0.9),
                  height: fullSheet ? height : undefined,
                }}
              >
                {fullSheet ? null : <SheetHandle className={handleClassName} />}
                <View className={`min-h-0 flex-1${containerClassName ? ` ${containerClassName}` : ''}`}>{children}</View>
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
    </Modal>
  );
}
