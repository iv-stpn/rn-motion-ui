// Public contract for <Draggable>.
//
// Kept in its own module so a drop zone can import the payload shape without
// pulling in the component — and with it react-native-gesture-handler — and so
// the pure transfer logic beside it stays unit-testable, which anything that
// imports react-native is not.

import type { View } from 'react-native';

/** What a drop may do with the payload — the DOM `dropEffect` values. */
export type DragDropEffect = 'copy' | 'link' | 'move' | 'none';

/** Which of those the source permits — the DOM `effectAllowed` values. */
export type DragEffectAllowed = DragDropEffect | 'all' | 'copyLink' | 'copyMove' | 'linkMove' | 'uninitialized';

/**
 * The payload a drag carries: MIME-keyed strings, identical on both platforms.
 *
 * This is deliberately the subset of the DOM `DataTransfer` that can be honoured
 * off the web, which buys one thing: a browser's own `DataTransfer` *is* a
 * `DragTransfer`, so a web drag hands the real object straight through. A
 * consumer's `getData(mime)` reads the same on both platforms, and an existing
 * HTML5 drop zone — `<FileSystem onExternalDrop>` — needs no adapter to receive
 * one of these drags. Native drags get the stand-in from `createDragTransfer`.
 *
 * Not included: `files`, `items`, `setDragImage`. Those have no native
 * counterpart, and promising them here would be promising something only half
 * the platforms could keep.
 */
export type DragTransfer = {
  dropEffect: DragDropEffect;
  effectAllowed: DragEffectAllowed;
  /** Every format `setData` has written, in insertion order. */
  readonly types: readonly string[];
  /** The string written for `format`, or `''` when there is none. */
  getData: (format: string) => string;
  setData: (format: string, data: string) => void;
};

/** A point in window coordinates — `clientX/Y` on web, `absoluteX/Y` on native. */
export type DragPoint = { x: number; y: number };

/** The lift. Write into `transfer` here to change what the drag carries. */
export type DragStartEvent = { point: DragPoint; transfer: DragTransfer };

export type DragMoveEvent = {
  point: DragPoint;
  /** Offset from the lift point, so a consumer needn't remember where it began. */
  translation: DragPoint;
  transfer: DragTransfer;
};

export type DragEndEvent = {
  /**
   * Whether the drag ended without a drop. On web this is the browser's own
   * verdict (`dropEffect === 'none'` at `dragend`) — no drop zone claimed it, or
   * the user pressed Escape. On native it is true for an aborted gesture or a
   * `cancel()` call.
   */
  canceled: boolean;
  /** What the drop did with the payload; `'none'` whenever `canceled`. */
  dropEffect: DragDropEffect;
  point: DragPoint;
  transfer: DragTransfer;
};

/** Window-relative box, as `measure()` resolves it. */
export type DragRect = { height: number; width: number; x: number; y: number };

/**
 * The imperative surface of a `<Draggable>`. Every member behaves the same on
 * both platforms except `cancel`, which cannot: see its note.
 */
export type DraggableHandle = {
  /**
   * Abandon the drag in flight; no-op when there is none. `onDragEnd` fires with
   * `canceled: true`.
   *
   * **Web is partial.** Once the browser owns an HTML5 drag, nothing but the
   * user's Escape key ends it, so this clears the component's own state and its
   * registry entry while the browser's drag image keeps following the cursor
   * until release. Native aborts the gesture outright. Reach for it where the
   * app decides a drag is void (the source was deleted, a route changed) rather
   * than as a general-purpose "stop dragging".
   */
  cancel: () => void;
  /** The live payload while dragging, else `null`. */
  getTransfer: () => DragTransfer | null;
  /**
   * The host view. On web react-native-web resolves this to the backing
   * `HTMLElement`, so DOM work is a `Platform.OS` guard and a cast away.
   */
  getNode: () => View | null;
  isDragging: () => boolean;
  /**
   * The host's window-relative box. Async on both platforms because native's
   * `measureInWindow` is callback-based; resolves `null` when unmounted.
   */
  measure: () => Promise<DragRect | null>;
};

/**
 * The drag in flight, tree-wide. Native has no OS drag session to ask, so a drop
 * zone that wants to know what is coming reads this — see `getActiveDrag`.
 */
export type ActiveDrag = { id: string; transfer: DragTransfer };
