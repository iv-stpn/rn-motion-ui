import { AnimatePresence } from '@rn-motion-ui/moti/presence';
import { MotiView } from '@rn-motion-ui/moti/view';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { type LayoutChangeEvent, Modal, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useModalRender } from '../../hooks/use-modal-render';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { EASE_OUT, SPRING_PANEL } from '../../lib/ease';

// biome-ignore lint/style/useExportsLast: placement type before INSTANT constant — collocated for readability
export type MorphingModalPlacement = 'bottom' | 'center';

// RN FALLBACK vs web: the web modal blurs the backdrop (`backdrop-filter`) and
// uses framer `layout` to morph the panel's height between views. RN has no
// backdrop blur (uses a dim scrim instead) and no automatic layout morph, so we
// drive the morph explicitly: each view measures itself (onLayout) and the
// panel's height animates to that measurement via moti. The two views are
// absolutely positioned and cross-fade over each other (presenceAffectsLayout=
// {false}), so the height glides between sizes instead of snapping. The morph
// reuses SPRING_PANEL for the same weighty feel as the enter/exit.
//
// (moti — not a hand-written reanimated worklet — because moti ships compiled
// worklets and so needs no reanimated Babel plugin, which the web/vitest build
// target doesn't apply; a raw `useAnimatedStyle` throws there.)
const INSTANT = { type: 'timing' as const, duration: 0 };

function resolveEnterY(reduce: boolean, placement: MorphingModalProps['placement']): 0 | 20 | 40 {
  if (reduce) return 0;
  return placement === 'bottom' ? 40 : 20;
}

export type MorphingModalProps = {
  /** Which view is currently shown. `null` closes the modal. */
  viewId: string | null;
  onClose: () => void;
  children: ReactNode;
  /** "bottom" anchors near the bottom (mobile-like). "center" centers vertically. */
  placement?: MorphingModalPlacement;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: shared-element transition requires coordinating clip, position, and opacity branches
export function MorphingModal({
  viewId,
  onClose,
  children,
  placement = 'bottom',
  accessibilityLabel,
  style,
  testID,
}: MorphingModalProps) {
  const open = viewId !== null;
  const reduce = useReducedMotion();
  const { rendered, onExitComplete } = useModalRender(open);
  const enterY = resolveEnterY(reduce, placement);
  const enterScale = reduce ? 1 : 0.97;

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

  if (!rendered) return null;

  return (
    <Modal transparent={true} visible={rendered} animationType="none" onRequestClose={onClose}>
      <AnimatePresence onExitComplete={onExitComplete}>
        {open ? (
          <View key="morphing-modal" style={{ flex: 1 }} testID={testID}>
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 200, easing: EASE_OUT }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            >
              <Pressable accessibilityLabel="Close" onPress={onClose} className="bg-foreground/20" style={{ flex: 1 }} />
            </MotiView>
            <View
              pointerEvents="box-none"
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
                className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-surface"
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
                  style={{ overflow: 'hidden' }}
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
                      style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
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
    </Modal>
  );
}
