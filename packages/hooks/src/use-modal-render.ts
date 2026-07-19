import { useCallback, useEffect, useState } from 'react';

/**
 * Keeps a modal's subtree mounted until its exit animation completes.
 *
 * Returns `rendered` (gate the Modal's `visible` and the early-return null) and
 * `onExitComplete` (pass to AnimatePresence). When `open` flips true, the node
 * mounts immediately; when it flips false the node stays mounted until
 * `onExitComplete` fires, at which point it unmounts.
 */
export type ModalRenderState = { rendered: boolean; onExitComplete: () => void };

export function useModalRender(open: boolean): ModalRenderState {
  const [rendered, setRendered] = useState(open);

  // biome-ignore lint/plugin: mount-gate pattern — rendered must trail `open` by one tick so AnimatePresence can play the exit animation before the Modal unmounts
  useEffect(() => {
    if (open) setRendered(true);
  }, [open]);

  const onExitComplete = useCallback(() => setRendered(false), []);

  return { rendered, onExitComplete };
}
