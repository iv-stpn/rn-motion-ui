import { describe, expect, it } from 'vitest';
import { type OverlayLayerState, removeLayer, upsertLayer } from '../overlay-portal-store';

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
