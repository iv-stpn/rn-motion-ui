import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const HANDLE_HEIGHT = 28;
const IS_ANDROID = Platform.OS === 'android';

const styles = StyleSheet.create({
  sheetContainer: {
    zIndex: 1,
    ...(IS_ANDROID ? { elevation: 24 } : null),
  },
});

function SheetHandle() {
  return (
    <View className="items-center justify-center" style={{ height: HANDLE_HEIGHT }}>
      <View className="h-1 w-12 rounded-full bg-border/80" />
    </View>
  );
}

/** Manages mount state + translateY for a slide-from-bottom sheet. */
function useSlideSheetPresence(visible: boolean, screenHeight: number, onAfterClose?: () => void) {
  const [isMounted, setIsMounted] = useState(visible);
  const translateY = useSharedValue(visible ? 0 : screenHeight);

  // biome-ignore lint/plugin: slide animation tied to `visible` — effect intentionally omits stable refs
  // biome-ignore lint/correctness/useExhaustiveDependencies: screenHeight and onAfterClose are stable refs — only `visible` drives the effect
  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      translateY.value = withSpring(0, { damping: 32, stiffness: 300, mass: 0.75 });
    } else if (isMounted)
      translateY.value = withSpring(
        screenHeight,
        { damping: 40, stiffness: 300, mass: 0.75, overshootClamping: true },
        (finished) => {
          if (finished) {
            scheduleOnRN(setIsMounted, false);
            if (onAfterClose) scheduleOnRN(onAfterClose);
          }
        },
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return { isMounted, translateY };
}

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  containerClassName?: string;
  onAfterClose?: () => void;
  /** When true, the sheet stretches to full screen height instead of capping at 90%. */
  fullSheet?: boolean;
  /** When false, clicking the overlay will not close the sheet. Defaults to true. */
  closeOnOverlayClick?: boolean;
};

export function BottomSheet({
  visible,
  onClose,
  children,
  containerClassName,
  onAfterClose,
  fullSheet,
  closeOnOverlayClick = true,
}: BottomSheetProps) {
  const { height } = useWindowDimensions();
  const { isMounted, translateY } = useSlideSheetPresence(visible, height, onAfterClose);
  const dragStartY = useSharedValue(0);

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
        scheduleOnRN(onClose);
        return;
      }
      translateY.value = withSpring(0, { damping: 40, stiffness: 300, overshootClamping: true });
    });

  const handleOverlayPress = useCallback(() => {
    if (closeOnOverlayClick) onClose();
  }, [closeOnOverlayClick, onClose]);

  if (!isMounted) return null;

  return (
    <Modal
      visible={isMounted}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      hardwareAccelerated={IS_ANDROID}
      onRequestClose={onClose}
      accessibilityViewIsModal={true}
      aria-modal={true}
    >
      <View className="flex-1" style={{ pointerEvents: 'box-none' }}>
        <Animated.View
          renderToHardwareTextureAndroid={IS_ANDROID}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.45)', pointerEvents: 'none' }, backdropStyle]}
        />
        <View className="flex-1 justify-end">
          {fullSheet ? null : <Pressable onPress={handleOverlayPress} className="flex-1" />}
          <GestureDetector gesture={handleGesture}>
            <Animated.View renderToHardwareTextureAndroid={IS_ANDROID} style={[sheetStyle, styles.sheetContainer]}>
              <View
                // biome-ignore lint/nursery/useSortedClasses: dynamic class — cannot sort across template-literal segments
                className={`w-full overflow-hidden bg-surface${fullSheet ? '' : ' rounded-t-2xl'}`}
                style={{
                  maxHeight: fullSheet ? height : Math.round(height * 0.9),
                  height: fullSheet ? height : undefined,
                }}
              >
                {fullSheet ? null : <SheetHandle />}
                <View className={`min-h-0 flex-1${containerClassName ? ` ${containerClassName}` : ''}`}>{children}</View>
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
    </Modal>
  );
}
