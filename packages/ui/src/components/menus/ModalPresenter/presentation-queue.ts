// biome-ignore-all lint/style/useExportsLast: the public API types head the module so the queue helpers below read against them
import type { ReactNode } from 'react';

/**
 * presentation-queue — the module-level FIFO a `present()` call enqueues into
 * and the `ModalPresenter` host drains one-at-a-time.
 *
 * Only the **head** of the queue is presented. A presentation is removed — and
 * the next becomes the head — when `completePresentation` is called, which the
 * host wires to the active surface's `onAfterClose`. That is the whole point:
 * the next surface's native Modal only presents after the previous one's native
 * Modal has fully released, so two presentations can be chained without racing
 * the async Modal teardown.
 */

/** The control surface a presentation's render prop receives. */
export type PresentationApi = {
  /** Whether this presentation is currently shown — drive the surface's `open`. */
  open: boolean;
  /** Request close — flip the surface into its exit state (its `onClose`). */
  close: () => void;
  /** The surface's fully-released signal — wire this to its `onAfterClose`. */
  done: () => void;
};

/** Renders a surface given the presenter's control API. */
export type PresentationRender = (api: PresentationApi) => ReactNode;

type PresentationEntry = { id: string; render: PresentationRender };

let queue: PresentationEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const cb of listeners) cb();
}

/** Append a presentation to the back of the queue. */
export function enqueuePresentation(id: string, render: PresentationRender): void {
  queue = [...queue, { id, render }];
  notify();
}

/** Remove a presentation by id — advancing the queue when it was the head. */
export function completePresentation(id: string): void {
  if (!queue.some((entry) => entry.id === id)) return;
  queue = queue.filter((entry) => entry.id !== id);
  notify();
}

/** The head of the queue — the one presentation currently shown — or `null`. */
export function getActivePresentation(): PresentationEntry | null {
  return queue[0] ?? null;
}

/** Subscribe to queue changes (`useSyncExternalStore`). Returns an unsubscribe fn. */
export function subscribePresentations(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
