/**
 * Driving an HTML5 drag from a play function.
 *
 * `userEvent` has no drag: there is no way to ask the browser to lift a node, so
 * these dispatch the events a real drag would. One `DataTransfer` is threaded
 * through every event of one drag, which is what makes them *a drag* rather than
 * four unrelated events — it is the object the source writes the payload into, the
 * zone reads it out of, and whose `dropEffect` the zone sets on `dragover` and the
 * source reads back at `dragend`.
 *
 * What this exercises is the library's own wiring, not Chromium's drag transport.
 * The part that cannot be faked — the browser lifting a `draggable` node at all —
 * is asserted instead through the attribute the component sets on its host.
 *
 * Shared by the `Gestures/*` stories, which all need the same five-event sequence.
 */

type StoryPoint = { x: number; y: number };

const ORIGIN: StoryPoint = { x: 0, y: 0 };

/**
 * Wait for pending layout measures to land.
 *
 * A `<Dragzone>` gets its box from `measureInWindow`, which react-native-web
 * implements as a `setTimeout(…, 0)`. Timers of equal delay run in the order they
 * were queued, so a timer queued *after* the lift resolves after every measure the
 * lift kicked off — and awaiting it drains the microtasks those callbacks resolve
 * into. A `requestAnimationFrame` would not: frames and timers are separate queues.
 */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

type DragOntoParams = {
  /** Where the pointer grabbed the source. */
  from?: StoryPoint;
  source: Element;
  target: Element;
  /** Where the drop lands. Must be inside the target's box for the store to hit it. */
  to: StoryPoint;
  transfer: DataTransfer;
};

/**
 * A `DataTransfer` whose `dropEffect` a drop target can actually claim.
 *
 * `new DataTransfer()` is in the spec's read/write "copy and paste" mode rather
 * than drag mode, and there the `dropEffect` setter is defined to do nothing — so a
 * zone's `dragover` claim silently vanishes and every synthetic drag reads `'none'`
 * at `dragend`. Redefining it as a plain writable property restores the one
 * behaviour a real drag has and a constructed transfer does not. `setData` and
 * `getData`, which carry the payload, work as-is.
 */
export function newDragTransfer(): DataTransfer {
  const transfer = new DataTransfer();
  Object.defineProperty(transfer, 'dropEffect', { configurable: true, value: 'none', writable: true });
  return transfer;
}

/**
 * A transfer that looks like it came from outside the page: real `files`, and no
 * in-library drag behind it.
 *
 * `items.add` is the only way to populate `files` — the property is read-only and a
 * constructed transfer starts empty, which is also why an external-drop story cannot
 * be written with a plain object.
 */
export function newFileTransfer(...files: File[]): DataTransfer {
  const transfer = newDragTransfer();
  for (const file of files) transfer.items.add(file);
  return transfer;
}

/**
 * The middle of a node, in window coordinates.
 *
 * Drop points have to be *real* here. The drag store decides which zone a release
 * lands on by testing the point against boxes it measured itself, so a hardcoded
 * `{ x: 80, y: 120 }` would only hit whatever happens to sit there in the current
 * layout. Asking the DOM keeps the story honest about where it is dropping.
 */
export function centerOf(node: Element): StoryPoint {
  const rect = node.getBoundingClientRect();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Dispatch one drag event at `node`, at a window position the store can hit-test. */
export function fireDrag(node: Element, type: string, transfer: DataTransfer, point: StoryPoint = ORIGIN) {
  node.dispatchEvent(
    new DragEvent(type, { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, dataTransfer: transfer }),
  );
}

/**
 * Lift the source and stop there, with the drag live.
 *
 * For the assertion a completed drag cannot make: which zones lit up *before* the
 * pointer went anywhere. Eligibility is published at lift time across the whole tree,
 * so this is the moment a story can see a zone refuse a drag it will never be offered.
 *
 * Await it. A `<Dragzone>` measures its box from a layout callback and the lift kicks
 * off a fresh measure of every zone, both on later ticks — so a sequence with no gap
 * in it would hit-test against boxes that had not arrived. A real drag always has time
 * between its events; this borrows some.
 */
export async function liftDrag(source: Element, transfer: DataTransfer, from: StoryPoint = { x: 10, y: 10 }) {
  fireDrag(source, 'dragstart', transfer, from);
  await settle();
}

/**
 * Lift the source, cross the target, and drop on it — everything except the release.
 *
 * `dragend` is left to the caller, and for an in-library `<Dragzone>` it is not
 * optional: the DOM `drop` deliberately delivers nothing — the store owns that, off
 * measured rects, so web and native resolve a drop the same way — and both the zone's
 * `onDrop` and the source's `onDragEnd` fire from the release. Fire it with
 * {@link fireDrag} once the story is ready to assert the outcome.
 */
export async function dragOnto({ from = { x: 10, y: 10 }, source, target, to, transfer }: DragOntoParams) {
  await liftDrag(source, transfer, from);
  fireDrag(source, 'drag', transfer, to);
  fireDrag(target, 'dragenter', transfer, to);
  fireDrag(target, 'dragover', transfer, to);
  fireDrag(target, 'drop', transfer, to);
}

/**
 * A drag that lands on nothing: lifted, moved into empty space, released there.
 *
 * Split out because "no zone took it" is the assertion in its own right, and doing
 * it by hand in each story invites a stray `dragover` that quietly claims the drag.
 */
export async function dragNowhere(source: Element, transfer: DataTransfer, to: StoryPoint = { x: 2000, y: 2000 }) {
  fireDrag(source, 'dragstart', transfer, { x: 10, y: 10 });
  await settle();
  fireDrag(source, 'drag', transfer, to);
  fireDrag(source, 'dragend', transfer, to);
}

export type { DragOntoParams, StoryPoint };
