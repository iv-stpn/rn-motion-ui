import { userEvent, type within } from 'storybook/test';
import { settle } from '../../../../__stories__/story-drag';

// ─── Selection ─────────────────────────────────────────────────────────────────

/** Long enough to clear RN's 500 ms `delayLongPress`. */
const LONG_PRESS_MS = 700;
/** The status bar's count clause, and its selection clause. */
const ITEM_COUNT_PATTERN = /items$/;
const SELECTION_CLAUSE_PATTERN = /selected$/;

function mouse(node: Element, type: string, init: MouseEventInit = {}) {
  node.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, cancelable: true, ...init }));
}

/**
 * Click `node` with Ctrl or Cmd held.
 *
 * A raw `click` rather than `userEvent.keyboard('{Control>}')` + `userEvent.click`:
 * the direct user-event API does not carry held-key state from one call into the
 * next, so the modifier never reaches the press. react-native-web derives
 * `onPress` from the native `click` (not from the responder system), so one
 * dispatched event is the whole gesture — and it is exactly what a browser sends.
 */
function modifierClick(node: Element, ...modifiers: ('ctrlKey' | 'metaKey' | 'shiftKey')[]) {
  mouse(node, 'click', Object.fromEntries(modifiers.map((key) => [key, true])));
}

/** The prefix `fileSystemEntryTestID` gives every row and tile. */
const ENTRY_TEST_ID_PREFIX = 'file-system-entry-';

/**
 * The paths currently painted as selected, in view order.
 *
 * Reads `aria-selected`, which every row and tile carries for assistive tech, so
 * the assertion is against what a screen reader is told rather than against a
 * class name. Identity comes from the entry test id — a list row's accessible
 * name is its cells run together, which is no way to name a file.
 */
function selectedPaths(canvas: ReturnType<typeof within>): string[] {
  const nodes: HTMLElement[] = canvas.getAllByRole('button');
  const paths = new Set(
    nodes
      .filter((node) => node.getAttribute('aria-selected') === 'true')
      .map((node) => node.getAttribute('data-testid') ?? '')
      .filter((id) => id.startsWith(ENTRY_TEST_ID_PREFIX))
      .map((id) => id.slice(ENTRY_TEST_ID_PREFIX.length)),
  );
  return [...paths];
}

/**
 * Press and hold `node` until the hold fires — as a *touch* pointer.
 *
 * The hold gesture is touch-only by design: on a desktop the right button is
 * what means "tell me about this thing", so the transports filter
 * `pointerType === 'touch'` and a mouse held down is no gesture at all. The
 * events bubble from the row's inner button up to the `Holdable` /
 * `HoldDraggable` host that listens for them.
 */
async function longPress(node: Element): Promise<void> {
  node.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, buttons: 1, cancelable: true, pointerId: 1, pointerType: 'touch' }),
  );
  // Past the resolved holdDelay (300ms), where the hold fires the join.
  await new Promise((resolve) => setTimeout(resolve, LONG_PRESS_MS));
  node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch' }));
}

/**
 * Hold `node`, then — without lifting — drag to `to` and release there, as a
 * touch pointer the whole way. `onHeld` runs between the hold firing and the
 * drag lifting, for assertions on the state the hold produced (selection, kebab →
 * checkbox) while the finger is still down.
 *
 * A finger never starts an HTML5 drag, so this exercises the pointer transport
 * (`use-draggable-pointer.ts`), which accepts only `pointerType: 'touch'`: the
 * hold fires the same multi-select join as `longPress`, movement past the
 * escape slop lifts the drag, and the release resolves the drop off measured
 * rects (`measureInWindow` → `setTimeout 0`) — hence the `settle()` before
 * returning, and the `waitFor` callers still use before asserting the outcome.
 */
async function holdDrag(node: Element, to: ClientPoint, onHeld?: () => void | Promise<void>): Promise<void> {
  const from = centreOf(node);
  node.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      buttons: 1,
      cancelable: true,
      clientX: from.x,
      clientY: from.y,
      pointerId: 2,
      pointerType: 'touch',
    }),
  );
  // Past the resolved holdDelay (300ms), where the hold fires the join.
  await new Promise((resolve) => setTimeout(resolve, LONG_PRESS_MS));
  await onHeld?.();
  // Interpolated touch moves, so the transport sees the travel cross the escape
  // slop — the same stepping `sweep` uses, with `pointerType: 'touch'`.
  const steps = 6;
  for (let step = 1; step <= steps; step += 1) {
    const ratio = step / steps;
    node.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        buttons: 1,
        cancelable: true,
        clientX: from.x + (to.x - from.x) * ratio,
        clientY: from.y + (to.y - from.y) * ratio,
        pointerId: 2,
        pointerType: 'touch',
      }),
    );
  }
  node.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      clientX: to.x,
      clientY: to.y,
      pointerId: 2,
      pointerType: 'touch',
    }),
  );
  await settle();
}

// ─── Navigation ────────────────────────────────────────────────────────────────

/**
 * Select an entry, then open it — two presses inside the double-tap window,
 * which is what a mouse double-click amounts to here.
 *
 * Deliberately not `userEvent.dblClick`: selecting re-renders the view and the
 * grid re-chunks its rows into fresh nodes, so the element captured before the
 * first press is detached by the time the second one would land on it. Querying
 * again in between is also the more faithful simulation — the component counts
 * two independent presses, not one double-click event.
 *
 * The first press's synthetic click can itself retarget onto the re-chunked
 * node and count as the second press, opening the folder in one gesture. That
 * is an outcome, not a failure: the tile is gone from the tree, and pressing
 * again is impossible — so the second press is skipped when the tile no longer
 * exists, and the trail's Back button (or the viewer's Close) says the entry
 * opened.
 *
 * A file with a thumbnail labels its preview image with the file name too, so
 * the button role is what makes the tile itself unique.
 */
async function openTile(canvas: ReturnType<typeof within>, name: string): Promise<void> {
  await userEvent.click(await canvas.findByRole('button', { name }));
  const tile = await canvas.findByRole('button', { name }).catch(() => null);
  // A file's tile survives its open (the viewer overlays it), so a file always
  // gets its second press; a folder's tile is replaced by the folder's own
  // contents, so a vanished tile means the first press already opened it.
  if (tile !== null) await userEvent.click(tile);
}

// ─── Drag and drop ─────────────────────────────────────────────────────────────

/**
 * The row carrying `name` in the list view. Its accessible name concatenates the
 * date and size cells, so the name text is the anchor and the row is the
 * Pressable above it — the element whose 30px box the zone's rect matches.
 */
async function listRow(canvas: ReturnType<typeof within>, name: string): Promise<Element> {
  // findAllByText, not findByText: `HoldItem` renders every child twice (the
  // functional copy + the always-mounted portal twin), so a single-match query
  // rejects. The functional copy is rendered first in document order — pick that
  // one.
  const labels = await canvas.findAllByText(name);
  const label = labels[0];
  if (!label) throw new Error(`no row rendered for ${name}`);
  const row = label.closest('[role="button"]');
  if (!row) throw new Error(`no row rendered for ${name}`);
  return row;
}

/**
 * The `<Draggable>` host above `node` — the element the transport wires, and the
 * only place the `draggable` attribute lives.
 *
 * A story never needs this to *drive* a drag, since `dragstart` bubbles from the row
 * it is dispatched on. It is here for the assertion that cannot be synthesised: that
 * the browser would lift this node in the first place.
 */
function dragHost(node: Element): Element {
  const host = node.closest('[draggable="true"]');
  if (!host) throw new Error('no Draggable host above the entry');
  return host;
}

// ─── The selection box ─────────────────────────────────────────────────────────
// Not a drag, and driven differently: the band is the view's own pointer stream
// (see file-system-marquee), so these two stay on PointerEvents while everything
// above moved to DragEvents. The ids and coordinates have to line up because the
// band takes pointer capture, and capture only works for a pointer the browser
// considers active.

type ClientPoint = { x: number; y: number };

const MARQUEE_POINTER_ID = 9;

/** Centre of `node`, in the client coordinates the pointer stream carries. */
function centreOf(node: Element): ClientPoint {
  const rect = node.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Dispatch one pointer event of `type` at a client point, as the browser would. */
function pointer(node: Element, type: string, point: ClientPoint) {
  node.dispatchEvent(
    new PointerEvent(type, {
      pointerId: MARQUEE_POINTER_ID,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: point.x,
      clientY: point.y,
      bubbles: true,
      cancelable: true,
    }),
  );
}

/** The hover highlight's opacity — the whole of what says whether it is up. */
function opacityOf(node: Element): number {
  return Number(getComputedStyle(node).opacity);
}

/**
 * Walk the pointer from `origin` to `target` in steps, as a real stream would
 * arrive, and stop there — still pressed. Split from the release so a test can read
 * the live band before it commits and disappears.
 */
function sweep(container: Element, origin: ClientPoint, target: ClientPoint) {
  const steps = 6;
  for (let step = 1; step <= steps; step += 1) {
    const ratio = step / steps;
    pointer(container, 'pointermove', {
      x: origin.x + (target.x - origin.x) * ratio,
      y: origin.y + (target.y - origin.y) * ratio,
    });
  }
}

/** The view's scroll container on web: an overflow-y div taller than its viewport. */
function findScroller(canvasElement: HTMLElement): HTMLElement | null {
  return (
    Array.from(canvasElement.querySelectorAll<HTMLElement>('*')).find((el) => {
      const style = getComputedStyle(el);
      return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2;
    }) ?? null
  );
}

export type { ClientPoint };
export {
  centreOf,
  dragHost,
  ENTRY_TEST_ID_PREFIX,
  findScroller,
  holdDrag,
  ITEM_COUNT_PATTERN,
  listRow,
  longPress,
  modifierClick,
  mouse,
  opacityOf,
  openTile,
  pointer,
  SELECTION_CLAUSE_PATTERN,
  selectedPaths,
  sweep,
};
