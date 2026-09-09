import { Fragment, type ReactNode, useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Modal, Platform, View } from 'react-native';
import { useFocusTrap } from '../../../hooks/use-focus-trap';
import { useModalRender } from '../../../hooks/use-modal-render';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { OverlayOutlet } from './overlay-portal';
import { getOverlayStack, removeOverlayLayer, subscribeOverlayStack, upsertOverlayLayer } from './overlay-portal-store';

// The bottom (Modal-owning) layer fills the window; guest layers overlay it
// absolutely so they stack on top in document order inside the single Modal.
const FILL = { flex: 1 } as const;
const OVERLAY = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

type OwnerModalProps = { layerId: number; renderLayer: () => ReactNode; onShow?: () => void; fallbackClose: () => void };

/**
 * The bottom layer owns the single Modal and renders every layer in registration
 * order (bottom → top), each keeping its own AnimatePresence + MotiView exit.
 */
function OwnerModal({ layerId, renderLayer, onShow, fallbackClose }: OwnerModalProps) {
  const layers = useSyncExternalStore(subscribeOverlayStack, getOverlayStack);
  // The hardware back button should dismiss the topmost (visible) layer, not
  // the bottom one.
  const topLayer = layers.at(-1);

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      accessibilityViewIsModal={true}
      aria-modal={true}
      onRequestClose={topLayer?.onRequestClose ?? fallbackClose}
      onShow={onShow}
    >
      {renderLayer()}
      {layers
        .filter((layer) => layer.id !== layerId)
        .map((layer) => (
          <Fragment key={layer.id}>{layer.render()}</Fragment>
        ))}
    </Modal>
  );
}

type GuestContentProps = { layerId: number; render: () => ReactNode; exit: () => void; close: () => void; onShow?: () => void };

/**
 * A guest overlay renders nothing at its call site: its content lives in the
 * layer stack and is drawn by the owner's Modal. This refreshes that store
 * render whenever the guest re-renders so the owner repaints it — e.g. when the
 * guest's exit animation begins.
 */
function GuestContent({ layerId, render, exit, close, onShow }: GuestContentProps) {
  useLayoutEffect(() => {
    upsertOverlayLayer({ id: layerId, render, onExitComplete: exit, onRequestClose: close });
  }, [layerId, render, exit, close]);

  // Guest layers have no native presentation of their own, so their `onShow` is
  // emitted from their enter — one frame after they open, once the owner has
  // painted them. iOS-only, mirroring `Modal.onShow`.
  useMountEffect(() => {
    if (Platform.OS !== 'ios' || !onShow) return;
    const raf = requestAnimationFrame(() => onShow());
    return () => cancelAnimationFrame(raf);
  });

  return null;
}

export type OverlayShellContext = {
  /** Whether the overlay is currently open (drives AnimatePresence children). */
  open: boolean;
  /** Call this when the exit animation completes to release the modal mount. */
  onExitComplete: () => void;
};

export type OverlayShellProps = {
  open: boolean;
  onClose: () => void;
  /** Called after the exit animation fully completes. */
  onAfterClose?: () => void;
  /** When false, hardware back-button / request-close is ignored. Default true. */
  dismissable?: boolean;
  /**
   * Names the dialog for assistive technology. Overlays that render a visible
   * title should pass it here so the announcement matches what is on screen.
   */
  accessibilityLabel?: string;
  /**
   * Fires after the modal has fully presented (iOS `Modal.onShow`) — the moment
   * it is safe to request keyboard focus on content inside the overlay. No-op on
   * web, where `Modal` renders in place and `autoFocus` already works.
   */
  onShow?: () => void;
  /** Render prop receiving { open, onExitComplete } to drive AnimatePresence. */
  children: (ctx: OverlayShellContext) => ReactNode;
};

/**
 * Shared overlay boilerplate: Modal + useModalRender mount lifecycle + a11y props.
 *
 * Each overlay passes a render-prop child that receives `{ open, onExitComplete }`.
 * The child drives `<AnimatePresence onExitComplete={onExitComplete}>` so the modal
 * stays mounted until its exit animation settles.
 *
 * N overlays open at once collapse into **one** native `Modal`: the bottom
 * (first-registered) layer owns the Modal and renders every layer in order;
 * later layers register as guests and render nothing at their call site. This
 * sidesteps iOS's `presentViewController:` dropping a second presentation onto a
 * VC that is already presenting, so a confirm dialog raised from a settings
 * sheet appears on top of it.
 *
 * @example
 * <OverlayShell open={open} onClose={onClose} onAfterClose={onAfterClose}>
 *   {({ open, onExitComplete }) => (
 *     <AnimatePresence onExitComplete={onExitComplete}>
 *       {open ? <MotiView key="panel" ...>...</MotiView> : null}
 *     </AnimatePresence>
 *   )}
 * </OverlayShell>
 */
export function OverlayShell({
  open,
  onClose,
  onAfterClose,
  dismissable = true,
  accessibilityLabel,
  onShow,
  children,
}: OverlayShellProps) {
  const { rendered, onExitComplete } = useModalRender(open);
  const contentRef = useRef<View>(null);
  // Native gets containment from Modal + accessibilityViewIsModal; on web the
  // Modal is a plain fixed div and Tab would walk out into the page behind it.
  useFocusTrap(contentRef, open);

  const handleExitComplete = useCallback(() => {
    onExitComplete();
    onAfterClose?.();
  }, [onExitComplete, onAfterClose]);

  const handleRequestClose = useCallback(() => {
    if (dismissable) onClose();
  }, [dismissable, onClose]);

  // Stable wrappers so the store's layer entry (registered once) always reads
  // the current handlers without needing a refresh on every render.
  const exitRef = useRef(handleExitComplete);
  exitRef.current = handleExitComplete;
  const closeRef = useRef(handleRequestClose);
  closeRef.current = handleRequestClose;
  const stableExit = useCallback(() => exitRef.current(), []);
  const stableClose = useCallback(() => closeRef.current(), []);

  const [layerId, setLayerId] = useState<number | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  // Mirrors `layerId` but stays current inside the mount-only unmount cleanup,
  // where the `layerId` closure would be stale (null from the first render).
  const layerIdRef = useRef<number | null>(null);

  // The layer's render output. The bottom (owner) layer fills the Modal; guest
  // layers overlay it absolutely so they stack in document order.
  const renderLayer = useCallback(
    () => (
      <>
        {/* The dialog node: what the focus trap contains, and what carries the
            role + label. `flex-1` / full-bleed absolute match what Modal children
            already assume, so the wrapper is layout-neutral. */}
        <View
          ref={contentRef}
          style={isOwner ? FILL : OVERLAY}
          role="dialog"
          aria-modal={true}
          accessibilityViewIsModal={true}
          aria-label={accessibilityLabel}
          accessibilityLabel={accessibilityLabel}
        >
          {children({ open, onExitComplete: handleExitComplete })}
        </View>
        {/* Overlay outlet: full-bleed layer above the panel, outside the dialog's
            focus trap and accessibilityViewIsModal scope. touch-transparent on its
            empty areas; injected content still receives its own touches. */}
        <OverlayOutlet />
      </>
    ),
    [isOwner, accessibilityLabel, children, open, handleExitComplete],
  );

  // Register the layer while rendered; remove it once the exit finishes. The
  // bottom layer becomes the owner (it mounts the single Modal); every later
  // layer is a guest whose content the owner renders.
  useLayoutEffect(() => {
    if (!rendered) {
      if (layerIdRef.current !== null) {
        removeOverlayLayer(layerIdRef.current);
        layerIdRef.current = null;
        setLayerId(null);
        setIsOwner(false);
      }
      return;
    }
    if (layerIdRef.current === null) {
      const { id, isBottom } = upsertOverlayLayer({
        render: renderLayer,
        onExitComplete: stableExit,
        onRequestClose: stableClose,
      });
      layerIdRef.current = id;
      setLayerId(id);
      setIsOwner(isBottom);
    }
  }, [rendered, renderLayer, stableExit, stableClose]);

  // Deregister on unmount. If the host unmounts before the exit animation runs
  // (a test file ending, or a parent being torn down mid-open), the layer would
  // otherwise leak into the module-level stack and strand every later overlay as
  // a guest with no owner to render it.
  useMountEffect(() => () => {
    if (layerIdRef.current !== null) {
      removeOverlayLayer(layerIdRef.current);
      layerIdRef.current = null;
    }
  });

  if (!rendered || layerId === null) return null;

  return isOwner ? (
    <OwnerModal layerId={layerId} renderLayer={renderLayer} onShow={onShow} fallbackClose={stableClose} />
  ) : (
    <GuestContent layerId={layerId} render={renderLayer} exit={stableExit} close={stableClose} onShow={onShow} />
  );
}
