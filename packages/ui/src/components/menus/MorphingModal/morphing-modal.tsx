import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { EASE_OUT, SPRING_PANEL } from '../../../lib/ease';
import { elevatedShadow, type SurfaceLevel, surfaceBackground } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { Text } from '../../typography/Text/text';
import { OverlayShell, type OverlayShellContext } from '../Overlay/overlay-shell';

// biome-ignore lint/style/useExportsLast: placement type before INSTANT constant — collocated for readability
export type MorphingModalPlacement = 'bottom' | 'center';

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

function resolveEnterY(reduce: boolean, placement: MorphingModalProps['placement']): 0 | 20 | 40 {
  if (reduce) return 0;
  return placement === 'bottom' ? 40 : 20;
}

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
  accessibilityLabel,
  style,
  testID,
}: MorphingModalProps) {
  const open = viewId !== null;
  const reduce = useReducedMotion();
  const enterY = resolveEnterY(reduce, placement);
  const enterScale = reduce ? 1 : 0.95;

  const handleClose = useCallback(() => {
    onClose();
    onOpenChange?.(false);
  }, [onClose, onOpenChange]);

  // Measured content height drives the panel morph. `null` means "not yet
  // measured". `morphing` gates the snap-vs-spring choice: the first
  // measurement of an open snaps into place; later view swaps spring.
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [morphing, setMorphing] = useState(false);

  const onContentLayout = useCallback(
    (id: string) => (e: LayoutChangeEvent) => {
      // Ignore measurements from exiting views (stale keys).
      if (id !== viewId) return;
      const next = e.nativeEvent.layout.height;
      if (next > 0) setContentHeight(next);
    },
    [viewId],
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
          <View
            style={styles.positioner}
            className={
              placement === 'bottom' ? 'flex-1 items-center justify-end px-4 pb-8' : 'flex-1 items-center justify-center px-4'
            }
          >
            <MotiView
              accessibilityLabel={accessibilityLabel}
              from={{ opacity: 0, translateY: enterY, scale: enterScale }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              exit={{ opacity: 0, translateY: enterY, scale: reduce ? 1 : 0.98 }}
              transition={reduce ? { type: 'timing', duration: 180, easing: EASE_OUT } : SPRING_PANEL}
              className={`w-full max-w-sm overflow-hidden rounded-3xl border border-border ${surfaceBackground(elevation)} ${elevatedShadow(elevation)}`}
              style={style}
            >
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
                {/*
                 * presenceAffectsLayout={false}: the exiting view is absolutely
                 * positioned, so only the entering view is measured. Each view
                 * reports its height via onLayout to drive the morph above.
                 */}
                <AnimatePresence presenceAffectsLayout={false}>
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
