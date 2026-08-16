import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { EASE_OUT, SPRING_PANEL } from '../../../lib/ease';
import { elevatedShadow, type SurfaceLevel, surfaceBackground } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { Text } from '../../typography/Text/text';
import { CloseButton } from '../CloseButton/close-button';
import { OverlayShell, type OverlayShellContext } from '../Overlay/overlay-shell';

// biome-ignore lint/style/useExportsLast: placement type before INSTANT constant — collocated for readability
export type MorphingModalPlacement = 'bottom' | 'center' | 'bottom-sheet';

const INSTANT = { type: 'timing' as const, duration: 0 };

// `pointerEvents: 'box-none'` MUST come from StyleSheet.create, not an inline
// style object. On react-native-web, `box-none` is not real CSS — it is a
// polyfill the StyleSheet compiler expands into two rules (`pointer-events:
// none!important` on the node, `pointer-events: auto` on its direct children).
// That expansion only runs in the atomic/class path; RNW's inline-style path
// explicitly does not support `pointerEvents` and passes the value straight to
// the DOM, where the browser drops `pointer-events: box-none` as invalid. The
// node then keeps the default `auto`, and this full-bleed positioning layer
// swallows every tap meant for the scrim behind it — i.e. the modal stops
// closing on overlay tap. Native reads the same style object directly, so the
// class path is correct on both targets.
const styles = StyleSheet.create({
  positioner: { pointerEvents: 'box-none' },
});

function resolveEnterY(reduce: boolean, placement: MorphingModalProps['placement']): 0 | 20 | 40 | 80 {
  if (reduce) return 0;
  if (placement === 'bottom-sheet') return 80;
  if (placement === 'bottom') return 40;
  return 20;
}

const POSITIONER_CLASS: Record<MorphingModalPlacement, string> = {
  'bottom-sheet': 'flex-1 items-center justify-end',
  bottom: 'flex-1 items-center justify-end px-4 pb-8',
  center: 'flex-1 items-center justify-center px-4',
};

export type MorphingModalProps = {
  /** Which view is currently shown. `null` closes the modal. */
  viewId: string | null;
  onClose: () => void;
  /** Called when the modal opens or closes. */
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  /** "bottom" anchors near the bottom (mobile-like). "center" centers vertically. */
  placement?: MorphingModalPlacement;
  /** Surface elevation (1–8) — drives the drop shadow + dark-mode rim. Defaults to 6. */
  elevation?: SurfaceLevel;
  /** When true, renders a close button in the top-right corner of the panel. */
  showClose?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function MorphingModal({
  viewId,
  onClose,
  onOpenChange,
  children,
  placement = 'bottom',
  elevation = 6,
  showClose,
  accessibilityLabel,
  style,
  testID,
}: MorphingModalProps) {
  const open = viewId !== null;
  const reduce = useReducedMotion();
  const enterY = resolveEnterY(reduce, placement);
  const enterScale = reduce || placement === 'bottom-sheet' ? 1 : 0.95;

  const handleClose = useCallback(() => {
    onClose();
    onOpenChange?.(false);
  }, [onClose, onOpenChange]);

  // Measured content height drives the panel morph. `null` means "not yet
  // measured". `morphing` gates the snap-vs-spring choice: the first
  // measurement of an open snaps into place; later view swaps spring.
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [morphing, setMorphing] = useState(false);

  // Live viewId so layout events from EXITING views (which keep their
  // last-rendered onLayout props — stale id AND stale closure) are compared
  // against the current view. Mirror every render so the ref always holds the
  // viewId of the render currently on screen.
  const viewIdRef = useRef(viewId);
  viewIdRef.current = viewId;

  const onContentLayout = useCallback(
    (id: string) => (e: LayoutChangeEvent) => {
      // Ignore measurements from exiting views (stale keys). Read the LIVE
      // viewId via a ref: the callback an exiting view still holds captured
      // the viewId from when it was current, so a closure-captured comparison
      // always matches and lets a stale height retarget the morph spring
      // mid-flight — the card visibly collapses then re-expands on native.
      if (id !== viewIdRef.current) return;
      const { height } = e.nativeEvent.layout;
      if (height > 0) setContentHeight(height);
    },
    [],
  );

  // biome-ignore lint/plugin: morph state must reset on each open so the first height measurement snaps in rather than springing from a stale value
  useEffect(() => {
    if (open) {
      setContentHeight(null);
      setMorphing(false);
    }
  }, [open]);

  // biome-ignore lint/plugin: arming springy morphing after the first measurement cannot be derived from render-time state — it responds to contentHeight settling from null
  useEffect(() => {
    if (contentHeight !== null && !morphing) setMorphing(true);
  }, [contentHeight, morphing]);

  const positionerClassName = POSITIONER_CLASS[placement];

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: shared-element morph requires coordinating clip, height-spring, and cross-fade branches in one render path
  const renderPanel = ({ open: isAnimOpen, onExitComplete }: OverlayShellContext) => (
    <AnimatePresence onExitComplete={onExitComplete}>
      {isAnimOpen ? (
        <View key="morphing-modal" className="flex-1" testID={testID}>
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'timing', duration: 200, easing: EASE_OUT }}
            className="absolute top-0 right-0 bottom-0 left-0"
          >
            <Pressable
              accessibilityLabel="Close"
              onPress={handleClose}
              className="flex-1 bg-foreground/20"
              testID={testID ? `${testID}-backdrop` : undefined}
            />
          </MotiView>
          <View style={styles.positioner} className={positionerClassName}>
            <MotiView
              accessibilityLabel={accessibilityLabel}
              from={{ opacity: 0, translateY: enterY, scale: enterScale }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              exit={{ opacity: 0, translateY: enterY, scale: reduce || placement === 'bottom-sheet' ? 1 : 0.98 }}
              transition={reduce ? { type: 'timing', duration: 180, easing: EASE_OUT } : SPRING_PANEL}
              className={cn(
                'overflow-hidden border border-border',
                placement === 'bottom-sheet' ? 'w-full max-w-sm rounded-t-modal' : 'w-full max-w-sm rounded-modal',
                surfaceBackground(elevation),
                elevatedShadow(elevation),
              )}
              style={style}
            >
              {showClose ? (
                <View className="absolute top-2 right-2 z-10">
                  <CloseButton onPress={handleClose} testID={testID ? `${testID}-close` : undefined} />
                </View>
              ) : null}
              {/*
               * Height morphs toward the measured height of the active view.
               * overflow:hidden clips the taller incoming content while the
               * card grows; the cross-fade masks the reveal.
               */}
              <MotiView
                animate={contentHeight === null ? {} : { height: contentHeight }}
                transition={reduce || !morphing ? INSTANT : SPRING_PANEL}
                className="overflow-hidden"
              >
                <AnimatePresence>
                  <MotiView
                    key={viewId}
                    from={reduce ? { opacity: 0 } : { opacity: 0, translateY: 8 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -8 }}
                    transition={{ type: 'timing', duration: reduce ? 160 : 240, easing: EASE_OUT }}
                    exitTransition={{ type: 'timing', duration: reduce ? 140 : 160, easing: EASE_OUT }}
                    onLayout={onContentLayout(viewId ?? '')}
                    className="absolute top-0 right-0 left-0"
                  >
                    <View className="p-5">
                      {typeof children === 'string' || typeof children === 'number' ? (
                        <Text className="text-foreground text-sm">{children}</Text>
                      ) : (
                        children
                      )}
                    </View>
                  </MotiView>
                </AnimatePresence>
              </MotiView>
            </MotiView>
          </View>
        </View>
      ) : null}
    </AnimatePresence>
  );

  return (
    <OverlayShell open={open} onClose={handleClose}>
      {renderPanel}
    </OverlayShell>
  );
}
