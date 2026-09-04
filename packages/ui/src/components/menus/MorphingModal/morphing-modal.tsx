import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { EASE_OUT, SPRING_PANEL, springLayout } from '../../../lib/ease';
import type { SurfaceElevation } from '../../../lib/elevated';
import { surface } from '../../../lib/surface';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { CloseButton } from '../../buttons/CloseButton/close-button';
import { Text } from '../../typography/Text/text';
import { ModalBlur } from '../Overlay/blur-host';
import { OverlayShell, type OverlayShellContext } from '../Overlay/overlay-shell';
import type { OverlayType } from '../Overlay/overlay-type';

// biome-ignore lint/style/useExportsLast: placement type before PANEL_LAYOUT constant — collocated for readability
export type MorphingModalPlacement = 'bottom' | 'center' | 'bottom-sheet';

/** Content-height morph rides `springLayout` on `SPRING_PANEL`. */
const PANEL_LAYOUT = springLayout(SPRING_PANEL);

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
  'bottom-sheet': 'flex-1 items-center justify-end px-4',
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
  /**
   * Swap the panel's ladder shadow for the input field's large, diffuse halo
   * (`shadow-floating`). It replaces the `shadow-elevated-N` rung rather than
   * adding to it, so the panel keeps its `elevation` tint but trades the
   * layered drop for the halo. @default false
   */
  floating?: boolean;
  /** Surface elevation (0–8) — drives the drop shadow + dark-mode rim. `0` is the flat resting surface (no shadow or border). Defaults to 6. */
  elevation?: SurfaceElevation;
  /** When true, renders a close button in the top-right corner of the panel. */
  showClose?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** The scrim behind the panel: `"blur"`, `"opacity"`, or `"none"`. Defaults to `"blur"`. */
  overlay?: OverlayType;
  /** When false, pressing outside the panel will not close it. Defaults to true. */
  closeOnOutsidePress?: boolean;
  /**
   * Fires after the modal has fully presented AND the active view has measured to
   * a non-zero height — the moment it is safe to request keyboard focus without
   * racing the panel's zero-height clip. No-op on web.
   */
  onShow?: () => void;
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the morph height and the onShow gating share the same measured-height state — splitting would prop-drill contentHeight across function boundaries
export function MorphingModal({
  viewId,
  onClose,
  onOpenChange,
  children,
  placement = 'bottom',
  floating = false,
  elevation = 6,
  showClose,
  accessibilityLabel,
  style,
  testID,
  overlay = 'blur',
  closeOnOutsidePress = true,
  onShow,
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

  // `onShow` must wait for the first non-zero content measurement — `Modal.onShow`
  // fires at presentation, before the active view has measured, so a focus request
  // then would race the panel's zero-height clip. This flag latches the request
  // until `contentHeight` lands non-null.
  const showPendingRef = useRef(false);

  const handleShow = useCallback(() => {
    if (contentHeight === null) {
      showPendingRef.current = true;
      return;
    }
    onShow?.();
  }, [contentHeight, onShow]);

  // biome-ignore lint/plugin: deferring the on-show callback until the content measures is a side effect keyed on contentHeight — it can't be derived at render time
  useEffect(() => {
    if (showPendingRef.current && contentHeight !== null) {
      showPendingRef.current = false;
      onShow?.();
    }
  }, [contentHeight, onShow]);

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
      showPendingRef.current = false;
    }
  }, [open]);

  // biome-ignore lint/plugin: arming springy morphing after the first measurement cannot be derived from render-time state — it responds to contentHeight settling from null
  useEffect(() => {
    if (contentHeight !== null && !morphing) setMorphing(true);
  }, [contentHeight, morphing]);

  const positionerClassName = POSITIONER_CLASS[placement];
  // The panel's corner radius — top-only for the bottom-anchored sheet, all four
  // for the centred/bottom modal. Shared by the elevated surface (so the shadow
  // ring follows the curve) and the clip wrapper (so content clips to the curve).
  const panelRadiusClass = placement === 'bottom-sheet' ? 'rounded-t-modal' : 'rounded-modal';
  const showDim = overlay !== 'none';

  const renderBackdrop = () => (
    <>
      {/* Blur sits outside the dim's opacity fade: a parent opacity fades
          out the CSS backdrop-filter on web (backdrop-root clipping), so
          OverlayBlur fades its own opacity instead. */}
      {overlay === 'blur' ? <ModalBlur /> : null}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'timing', duration: 200, easing: EASE_OUT }}
        className="absolute top-0 right-0 bottom-0 left-0"
      >
        <Pressable
          accessibilityLabel="Close"
          onPress={closeOnOutsidePress ? handleClose : undefined}
          className={showDim ? 'flex-1 bg-black/40' : 'flex-1'}
          testID={testID ? `${testID}-backdrop` : undefined}
        />
      </MotiView>
    </>
  );

  const renderMorphContent = () => (
    <View className={cn('overflow-hidden', panelRadiusClass)}>
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
        layout={reduce || !morphing ? undefined : PANEL_LAYOUT}
        className="overflow-hidden"
        style={{ height: contentHeight ?? 0 }}
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
    </View>
  );

  const renderPanel = ({ open: isAnimOpen, onExitComplete }: OverlayShellContext) => (
    <AnimatePresence onExitComplete={onExitComplete}>
      {isAnimOpen ? (
        <View key="morphing-modal" className="flex-1" testID={testID}>
          {renderBackdrop()}
          <View style={styles.positioner} className={positionerClassName}>
            <MotiView
              accessibilityLabel={accessibilityLabel}
              from={{ opacity: 0, translateY: enterY, scale: enterScale }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              exit={{ opacity: 0, translateY: enterY, scale: reduce || placement === 'bottom-sheet' ? 1 : 0.98 }}
              transition={reduce ? { type: 'timing', duration: 180, easing: EASE_OUT } : SPRING_PANEL}
              className={cn(
                'w-full max-w-sm',

                panelRadiusClass,
                surface(elevation, undefined, floating),
              )}
              style={style}
            >
              {/*
               * The clip wrapper carries `overflow-hidden` on its own element —
               * putting it on the surface above would clip the elevated shadow,
               * leaving only the flat background behind (the shadow must render
               * outside the clip region, as in RadioCard / ElevatedButton).
               */}
              {renderMorphContent()}
            </MotiView>
          </View>
        </View>
      ) : null}
    </AnimatePresence>
  );

  return (
    <OverlayShell open={open} onClose={handleClose} onShow={handleShow}>
      {renderPanel}
    </OverlayShell>
  );
}
