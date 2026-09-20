import { describe, expect, it } from 'vitest';
import { type OverlayLayerState, removeLayer, resolveLayerLifetime, upsertLayer } from '../overlay-portal-store';

// Stand-in layer content — a string, the simplest valid ReactNode; the layer
// transitions only care about identity and order, not what a layer renders.
const render = (id: number) => () => `layer-${id}`;
const noop = () => undefined;
const layer = (id: number) => ({ render: render(id), onExitComplete: noop, onRequestClose: noop });

describe('upsertLayer', () => {
  it('appends new layers in registration order', () => {
    let state: OverlayLayerState = [];
    state = upsertLayer(state, 1, layer(1));
    state = upsertLayer(state, 2, layer(2));
    expect(state.map((l) => l.id)).toEqual([1, 2]);
  });

  it('refreshes an existing layer in place without reordering', () => {
    let state: OverlayLayerState = [];
    state = upsertLayer(state, 1, layer(1));
    state = upsertLayer(state, 2, layer(2));

    const replacement = { render: () => 'replacement', onExitComplete: noop, onRequestClose: noop };
    const next = upsertLayer(state, 1, replacement);

    // Slot stays put, the rest is untouched, and the render is the new one.
    expect(next.map((l) => l.id)).toEqual([1, 2]);
    expect(next[0]?.render()).toBe('replacement');
  });
});

describe('removeLayer', () => {
  it('removes a middle layer and preserves the order of the rest', () => {
    let state: OverlayLayerState = [];
    state = upsertLayer(state, 1, layer(1));
    state = upsertLayer(state, 2, layer(2));
    state = upsertLayer(state, 3, layer(3));

    const next = removeLayer(state, 2);
    expect(next.map((l) => l.id)).toEqual([1, 3]);
  });

  it('is a no-op for an unknown id', () => {
    let state: OverlayLayerState = [];
    state = upsertLayer(state, 1, layer(1));
    expect(removeLayer(state, 99)).toBe(state);
  });
});

describe('open → confirm → second-confirm', () => {
  it('keeps the Modal alive until the stack empties (top-down close)', () => {
    // A settings sheet (bottom / owner), then a confirm dialog, then a second
    // confirm — the 3+ layer deep-nesting case from the spec.
    let state: OverlayLayerState = [];
    state = upsertLayer(state, 1, layer(1));
    state = upsertLayer(state, 2, layer(2));
    state = upsertLayer(state, 3, layer(3));
    expect(state.map((l) => l.id)).toEqual([1, 2, 3]);

    // Close top-down: second-confirm, then confirm, then settings.
    state = removeLayer(state, 3);
    expect(state.map((l) => l.id)).toEqual([1, 2]); // Modal still alive

    state = removeLayer(state, 2);
    expect(state.map((l) => l.id)).toEqual([1]); // Modal still alive (bottom only)

    state = removeLayer(state, 1);
    expect(state).toEqual([]); // stack empty → the Modal unmounts
  });

  it('lets a guest refresh in place without disturbing deeper layers', () => {
    let state: OverlayLayerState = [];
    state = upsertLayer(state, 1, layer(1));
    state = upsertLayer(state, 2, layer(2));

    // The top layer's content changes (e.g. its exit animation begins).
    const next = upsertLayer(state, 2, { render: () => 'exiting', onExitComplete: noop, onRequestClose: noop });

    expect(next.map((l) => l.id)).toEqual([1, 2]);
    expect(next[1]?.render()).toBe('exiting');
    expect(next[0]?.render()).toBe('layer-1'); // bottom untouched
  });
});

describe('resolveLayerLifetime', () => {
  it('keeps the bottom layer on while a layer above it is still open', () => {
    // THE REGRESSION. A folder menu (bottom) closes and the confirm dialog it
    // raised (guest) is still open. The menu's own exit finishing must not take
    // it out of the stack: the guest is drawn inside the Modal the menu owns, so
    // dropping the menu unmounts the Modal and the dialog with it.
    expect(resolveLayerLifetime(2, true, false)).toEqual({ isOwner: true, keep: true, renderOwn: false });
    expect(resolveLayerLifetime(5, true, false)).toEqual({ isOwner: true, keep: true, renderOwn: false });
  });

  it('lets a lone bottom layer go once its own exit finishes', () => {
    // Nothing above it → it leaves, and the Modal unmounts with it.
    expect(resolveLayerLifetime(1, true, false)).toEqual({ isOwner: true, keep: false, renderOwn: false });
  });

  it('keeps the bottom layer while its own content is still up', () => {
    expect(resolveLayerLifetime(1, true, true)).toEqual({ isOwner: true, keep: true, renderOwn: true });
    expect(resolveLayerLifetime(3, true, true)).toEqual({ isOwner: true, keep: true, renderOwn: true });
  });

  it('keeps a guest only while its own content is up', () => {
    expect(resolveLayerLifetime(2, false, true)).toEqual({ isOwner: false, keep: true, renderOwn: true });
    expect(resolveLayerLifetime(2, false, false)).toEqual({ isOwner: false, keep: false, renderOwn: false });
  });

  it('registers a not-yet-registered layer only while it has content', () => {
    // `layerId` is null before the registration effect runs, and after it leaves.
    expect(resolveLayerLifetime(0, false, true).keep).toBe(true);
    expect(resolveLayerLifetime(0, false, false).keep).toBe(false);
  });
});

// ─── The shells' rule, applied over the real reducers ──────────────────────────

/** One shell's decision, mirroring `isBottomLayer` + `getLayerDepth` in the store. */
const lifetimeOf = (state: OverlayLayerState, id: number, rendered: boolean) =>
  resolveLayerLifetime(state.length, state[0]?.id === id, rendered);

/**
 * Apply that rule until the stack stops shrinking. React re-derives every shell
 * after each registration change, so a layer can become the bottom one — and
 * leave — on a later pass, not just the pass that unregistered something else.
 */
function settle(state: OverlayLayerState, rendered: Record<number, boolean>): OverlayLayerState {
  let next = state;
  for (let pass = 0; pass < 5; pass += 1) {
    const after = next.reduce<OverlayLayerState>((acc, item) => {
      const { keep } = lifetimeOf(acc, item.id, rendered[item.id] ?? false);
      return keep ? acc : removeLayer(acc, item.id);
    }, next);
    if (after.length === next.length) return after; // fixed point — nothing left to drop
    next = after;
  }
  return next;
}

describe('a menu closing under a confirm dialog', () => {
  it('keeps the confirm dialog on screen when the menu exits first', () => {
    // 1. The menu opens on an empty stack → it owns the Modal.
    let state = upsertLayer([], 1, layer(1));
    expect(lifetimeOf(state, 1, true).isOwner).toBe(true);

    // 2. "Stop syncing": the menu starts exiting and the confirm dialog registers
    //    in the same tick → the dialog is a guest inside the menu's Modal.
    state = upsertLayer(state, 2, layer(2));

    // 3. The menu's exit finishes. Before the fix this deregistered the menu —
    //    the only Modal owner — so the Modal unmounted and took the dialog, its
    //    only child, with it. The menu now stays on as a host.
    state = settle(state, { 1: false, 2: true });
    expect(state.map((l) => l.id)).toEqual([1, 2]);
    expect(state[0]?.id).toBe(1); // …and still owns the Modal the dialog is drawn in

    // 4. The dialog is confirmed and closes; the host menu then leaves, which is
    //    what finally unmounts the Modal.
    state = settle(state, { 1: false, 2: false });
    expect(state).toEqual([]);
  });

  it('settles to a stack that always has an owner for the Modal', () => {
    // The worse consequence of the bug: a stranded guest keeps the stack non-empty
    // forever, so every later overlay registers above a Modal nothing owns and
    // renders nowhere — the session goes overlay-dead until reload. The settled
    // stack therefore has to be empty (no Modal), or have a bottom layer its own
    // rule still keeps (so the Modal has an owner).
    const cases: { expected: number[]; rendered: Record<number, boolean> }[] = [
      { expected: [1, 2], rendered: { 1: false, 2: true } }, // the reported sequence: menu hosting the open dialog
      { expected: [1], rendered: { 1: true, 2: false } }, // dialog finished first, menu is alone again
      { expected: [], rendered: { 1: false, 2: false } }, // both finished → the Modal unmounts
      { expected: [1, 2], rendered: { 1: true, 2: true } }, // both open
    ];

    for (const { expected, rendered } of cases) {
      const state = settle(upsertLayer(upsertLayer([], 1, layer(1)), 2, layer(2)), rendered);
      expect(state.map((l) => l.id)).toEqual(expected);

      const bottom = state[0];
      if (bottom !== undefined) expect(lifetimeOf(state, bottom.id, rendered[bottom.id] ?? false).keep).toBe(true);
    }
  });

  it('promotes the layer above when the owner is torn down outright', () => {
    // A parent unmounting mid-open (a route change, a test file ending) removes
    // the bottom layer. Ownership is read from the live stack, so the layer above
    // promotes itself and mounts the Modal — instead of being stranded as a guest
    // with no owner for the rest of the session.
    const state = removeLayer(upsertLayer(upsertLayer([], 1, layer(1)), 2, layer(2)), 1);
    expect(state.map((l) => l.id)).toEqual([2]);
    expect(lifetimeOf(state, 2, true)).toEqual({ isOwner: true, keep: true, renderOwn: true });
  });
});
