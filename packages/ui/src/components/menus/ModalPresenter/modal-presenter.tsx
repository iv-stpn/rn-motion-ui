// biome-ignore-all lint/style/useExportsLast lint/style/useComponentExportOnlyModules: `present`/`useModalPresenter` are the imperative half of the presenter's API, co-located with the ModalPresenter host (the same shape as the toaster's `toast` + `<Toaster>`); ActivePresentation is an internal helper
import { useCallback, useState, useSyncExternalStore } from 'react';
import {
  completePresentation,
  enqueuePresentation,
  getActivePresentation,
  type PresentationRender,
  subscribePresentations,
} from './presentation-queue';

/**
 * ModalPresenter — a one-at-a-time native-modal presentation host.
 *
 * Call {@link present} to enqueue a surface, and mount a single
 * `<ModalPresenter />` near the app root to drain the queue. The head of the
 * queue renders with `open: true`; the surface's `onAfterClose` is bridged to
 * `done`, which releases the queue so the next surface's native Modal only
 * presents after the previous one has fully released.
 *
 * ```tsx
 * present('confirm', ({ open, close, done }) => (
 *   <AdaptiveModal open={open} onOpenChange={(next) => !next && close()} onAfterClose={done} title="Confirm">
 *     <Button onPress={close}>Done</Button>
 *   </AdaptiveModal>
 * ));
 * ```
 *
 * The presenter itself owns no Modal — each surface renders its own, so the
 * chaining guarantee comes from presenting one at a time, not from re-hosting.
 */

/** Enqueue a surface to present. `render` receives `{ open, close, done }`. */
export function present(id: string, render: PresentationRender): void {
  enqueuePresentation(id, render);
}

/** Returns the stable {@link present} function — for use in callbacks and effect deps. */
export function useModalPresenter(): typeof present {
  return present;
}

/** Mount once near the app root to drain the presentation queue. */
export function ModalPresenter() {
  const active = useSyncExternalStore(subscribePresentations, getActivePresentation);
  if (!active) return null;
  return <ActivePresentation key={active.id} id={active.id} render={active.render} />;
}

type ActivePresentationProps = { id: string; render: PresentationRender };

function ActivePresentation({ id, render }: ActivePresentationProps) {
  // `open` starts true and flips false on `close`; the keyed remount in
  // `ModalPresenter` restarts it for the next presentation.
  const [open, setOpen] = useState(true);
  const close = useCallback(() => setOpen(false), []);
  const done = useCallback(() => completePresentation(id), [id]);
  return render({ open, close, done });
}
