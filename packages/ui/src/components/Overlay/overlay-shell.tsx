import { type ReactNode, useCallback } from 'react';
import { Modal } from 'react-native';
import { useModalRender } from '../../hooks/use-modal-render';

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
export function OverlayShell({ open, onClose, onAfterClose, dismissable = true, children }: OverlayShellProps) {
  const { rendered, onExitComplete } = useModalRender(open);

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
      {children({ open, onExitComplete: handleExitComplete })}
    </Modal>
  );
}
