import { type ReactNode, useCallback, useState } from 'react';
import { type LayoutChangeEvent, Modal, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useModalRender } from '../../hooks/use-modal-render';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { SPRING_PANEL } from '../../lib/ease';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';

export type DrawerSide = 'left' | 'right';

// RN FALLBACK vs web: the web drawer is a `position:fixed` overlay that locks
// body scroll and closes on Escape. RN uses a full-screen `Modal` (transparent,
// animationType="none") and animates the panel + backdrop with moti. Drag is
// dropped — close via the backdrop tap or a close control (documented). The
// slide uses the same SPRING_PANEL feel as the web SPRING_PANEL transition.
export type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: DrawerSide;
  children: ReactNode;
  /** Close when the backdrop is tapped. Default true. */
  dismissable?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Drawer({
  open,
  onOpenChange,
  side = 'right',
  children,
  dismissable = true,
  accessibilityLabel,
  style,
  testID,
}: DrawerProps) {
  const reduce = useReducedMotion();
  const { rendered, onExitComplete: handleExitComplete } = useModalRender(open);
  // Panel width drives the offscreen slide distance; measured on first layout,
  // falls back to a wide default so it starts fully offscreen before measure.
  const [width, setWidth] = useState(360);

  const handleRequestClose = useCallback(() => onOpenChange(false), [onOpenChange]);
  const handleBackdropPress = useCallback(() => {
    if (dismissable) onOpenChange(false);
  }, [dismissable, onOpenChange]);
  const handleLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);

  if (!rendered) return null;

  const offscreen = side === 'right' ? width : -width;

  return (
    <Modal transparent={true} visible={rendered} animationType="none" onRequestClose={handleRequestClose}>
      <AnimatePresence onExitComplete={handleExitComplete}>
        {open ? (
          <View key="drawer" style={{ flex: 1 }} testID={testID}>
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 250 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            >
              <Pressable
                accessibilityLabel="Close"
                disabled={!dismissable}
                onPress={handleBackdropPress}
                className="bg-foreground/40"
                style={{ flex: 1 }}
              />
            </MotiView>
            <MotiView
              accessibilityLabel={accessibilityLabel}
              onLayout={handleLayout}
              from={reduce ? { opacity: 0, translateX: 0 } : { translateX: offscreen }}
              animate={reduce ? { opacity: 1, translateX: 0 } : { translateX: 0 }}
              exit={reduce ? { opacity: 0, translateX: 0 } : { translateX: offscreen }}
              transition={reduce ? { type: 'timing', duration: 200 } : SPRING_PANEL}
              className={
                side === 'right'
                  ? 'absolute inset-y-0 right-0 w-80 max-w-[85%] flex-col border-border border-l bg-surface'
                  : 'absolute inset-y-0 left-0 w-80 max-w-[85%] flex-col border-border border-r bg-surface'
              }
              style={style}
            >
              {typeof children === 'string' || typeof children === 'number' ? (
                <Text className="text-foreground text-sm">{children}</Text>
              ) : (
                children
              )}
            </MotiView>
          </View>
        ) : null}
      </AnimatePresence>
    </Modal>
  );
}
