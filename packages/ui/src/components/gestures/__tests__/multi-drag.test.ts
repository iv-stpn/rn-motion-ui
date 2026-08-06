import { describe, expect, it } from 'vitest';
import {
  defaultResolveIds,
  MULTI_DRAG_IDS_MIME,
  readMultiDragIds,
  withMultiDragIds,
  writeMultiDragIds,
} from '../DragManager/multi-drag';
import { createDragTransfer } from '../drag-transfer';

const selection = (...ids: string[]): ReadonlySet<string> => new Set(ids);

describe('defaultResolveIds', () => {
  it('carries the whole selection when the lifted item is in it', () => {
    expect(defaultResolveIds('b', selection('a', 'b', 'c'))).toEqual(['a', 'b', 'c']);
  });

  it('carries only the lifted item when it is outside the selection', () => {
    // Grabbing an unselected row must not drag someone else's selection along —
    // this is the case that separates "drag what I grabbed" from "drag what is lit".
    expect(defaultResolveIds('z', selection('a', 'b'))).toEqual(['z']);
  });

  it('carries only the lifted item when nothing is selected', () => {
    expect(defaultResolveIds('a', selection())).toEqual(['a']);
  });

  it('carries only the lifted item when it is the entire selection', () => {
    // A one-item selection is a single drag, not a group of one — the distinction
    // matters because the manager's group preview should not read "1 item".
    expect(defaultResolveIds('a', selection('a'))).toEqual(['a']);
  });

  it('follows the selection order, not the grab', () => {
    expect(defaultResolveIds('c', selection('a', 'b', 'c'))).toEqual(['a', 'b', 'c']);
  });
});

describe('multi drag ids on a transfer', () => {
  it('round-trips through a transfer', () => {
    const transfer = createDragTransfer();
    writeMultiDragIds(transfer, ['a', 'b']);
    expect(readMultiDragIds(transfer)).toEqual(['a', 'b']);
  });

  it('reads an empty group from a transfer that carries none', () => {
    // What a plain `<Draggable>`, another app, or an older build hands over.
    expect(readMultiDragIds(createDragTransfer())).toEqual([]);
    expect(readMultiDragIds(null)).toEqual([]);
  });

  it('reads an empty group rather than throwing on someone else’s payload', () => {
    const transfer = createDragTransfer();
    transfer.setData(MULTI_DRAG_IDS_MIME, 'not json {');
    expect(readMultiDragIds(transfer)).toEqual([]);
  });

  it('drops non-string entries instead of trusting the parse', () => {
    const transfer = createDragTransfer();
    transfer.setData(MULTI_DRAG_IDS_MIME, JSON.stringify(['a', 7, null, 'b']));
    expect(readMultiDragIds(transfer)).toEqual(['a', 'b']);
  });

  it('reads an empty group from a JSON value that is not an array', () => {
    const transfer = createDragTransfer();
    transfer.setData(MULTI_DRAG_IDS_MIME, JSON.stringify({ ids: ['a'] }));
    expect(readMultiDragIds(transfer)).toEqual([]);
  });
});

describe('withMultiDragIds', () => {
  it('adds the ids alongside the consumer’s own payload', () => {
    const data = withMultiDragIds({ 'text/plain': 'a, b' }, ['a', 'b']);
    expect(data['text/plain']).toBe('a, b');
    expect(JSON.parse(data[MULTI_DRAG_IDS_MIME] ?? '')).toEqual(['a', 'b']);
  });

  it('does not mutate the record it was given', () => {
    const original: Record<string, string> = {};
    withMultiDragIds(original, ['a']);
    expect(original).toEqual({});
  });

  it('lets the consumer keep its own ids entry if it wrote one', () => {
    // Last write wins in the spread, so an explicit entry is not silently replaced.
    const data = withMultiDragIds({ [MULTI_DRAG_IDS_MIME]: 'mine' }, ['a']);
    expect(data[MULTI_DRAG_IDS_MIME]).toBe('mine');
  });
});
