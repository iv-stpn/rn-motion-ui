import { AnimatePresence } from '@rn-motion-ui/moti/presence';
import { MotiView } from '@rn-motion-ui/moti/view';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Dimensions, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useModalRender } from '../../hooks/use-modal-render';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { DRAWER, EASE_DRAWER } from '../../lib/ease';

export type SnapPoint = number | 'auto';

// RN FALLBACK vs web: the web sheet is a `position:fixed` portal with vaul-style
// drag-to-snap / fling-to-dismiss and body-scroll locking. RN uses a full-screen
// `Modal` and animates the panel + scrim up with moti (same EASE_DRAWER glide).
// Drag is dropped — snap between points with the header buttons and dismiss via
// the backdrop tap (documented). snapPoints are still honoured as fixed heights.
export type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Heights (0-1 = fraction of viewport, or "auto"). First entry is default. */
  snapPoints?: SnapPoint[];
  /** Index into snapPoints used when the sheet opens. Default 0. */
  defaultSnap?: number;
  title?: string;
  description?: string;
  children?: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: gesture + spring + keyboard state must all branch together
export function BottomSheet({
  open,
  onOpenChange,
  snapPoints = [0.5, 0.92],
  defaultSnap = 0,
  title,
  description,
  children,
  accessibilityLabel,
  style,
  testID,
}: BottomSheetProps) {
  const reduce = useReducedMotion();
  const { rendered, onExitComplete: handleExitComplete } = useModalRender(open);
  const [snap, setSnap] = useState(defaultSnap);

  // biome-ignore lint/plugin: snap must reset to defaultSnap each time the sheet opens — this responds to the `open` event, not derivable from render-time state
  useEffect(() => {
    if (open) setSnap(defaultSnap);
  }, [open, defaultSnap]);

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);
  const handleToggleSnap = useCallback(() => {
    setSnap((s) => {
      const canExpand = s < snapPoints.length - 1;
      const canCollapse = s > 0;
      if (canExpand) return s + 1;
      if (canCollapse) return s - 1;
      return s;
    });
  }, [snapPoints.length]);

  if (!rendered) return null;

  const screen = Dimensions.get('window');
  const snapValue = snapPoints[snap] ?? snapPoints[0] ?? 0.5;
  // "auto" caps at 92% of the viewport; numeric values are a fraction of it.
  const heightStyle: ViewStyle =
    snapValue === 'auto' ? { maxHeight: screen.height * 0.92 } : { height: screen.height * snapValue };
  const canExpand = snap < snapPoints.length - 1;

  return (
    <Modal transparent={true} visible={rendered} animationType="none" onRequestClose={handleClose}>
      <AnimatePresence onExitComplete={handleExitComplete}>
        {open ? (
          <View key="bottom-sheet" style={{ flex: 1 }} testID={testID}>
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: DRAWER.duration, easing: EASE_DRAWER }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            >
              <Pressable accessibilityLabel="Close" onPress={handleClose} className="bg-foreground/40" style={{ flex: 1 }} />
            </MotiView>
            <MotiView
              accessibilityLabel={accessibilityLabel ?? title}
              from={reduce ? { opacity: 0, translateY: 0 } : { translateY: screen.height }}
              animate={reduce ? { opacity: 1, translateY: 0 } : { translateY: 0 }}
              exit={reduce ? { opacity: 0, translateY: 0 } : { translateY: screen.height }}
              transition={
                reduce
                  ? { type: 'timing', duration: 180, easing: EASE_DRAWER }
                  : { type: 'timing', duration: DRAWER.duration, easing: EASE_DRAWER }
              }
              className="absolute right-0 bottom-0 left-0 mx-auto max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-border bg-background"
              style={[heightStyle, style]}
            >
              <View className="flex-col items-center px-4 pt-3 pb-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={canExpand ? 'Expand sheet' : 'Collapse sheet'}
                  onPress={handleToggleSnap}
                  className="h-1.5 w-10 rounded-full bg-muted-foreground/40"
                />
                {title || description ? (
                  <View className="mt-3 w-full">
                    {title ? <Text className="font-semibold text-base text-foreground">{title}</Text> : null}
                    {description ? <Text className="mt-0.5 text-muted-foreground text-sm">{description}</Text> : null}
                  </View>
                ) : null}
              </View>
              <ScrollView className="flex-1 px-4 pb-6" contentContainerStyle={{ paddingBottom: 24 }}>
                {children}
              </ScrollView>
            </MotiView>
          </View>
        ) : null}
      </AnimatePresence>
    </Modal>
  );
}
