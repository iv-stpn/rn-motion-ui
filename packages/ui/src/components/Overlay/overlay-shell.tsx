import { type ReactNode, useCallback, useRef } from 'react';
import { Modal, View } from 'react-native';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { useModalRender } from '../../hooks/use-modal-render';

const FILL = { flex: 1 } as const;

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

  if (!rendered) return null;

  return (
    <Modal
      visible={rendered}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      accessibilityViewIsModal={true}
      aria-modal={true}
      onRequestClose={handleRequestClose}
    >
      {/* The dialog node: what the focus trap contains, and what carries the
          role + label. `flex-1` matches what Modal children already assume, so
          the wrapper is layout-neutral. */}
      <View
        ref={contentRef}
        style={FILL}
        role="dialog"
        aria-modal={true}
        accessibilityViewIsModal={true}
        aria-label={accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
      >
        {children({ open, onExitComplete: handleExitComplete })}
      </View>
    </Modal>
  );
}
