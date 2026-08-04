import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearActiveDrag,
  createDragTransfer,
  getActiveDrag,
  setActiveDrag,
  subscribeActiveDrag,
  writeTransferData,
} from '../draggable-transfer';

// The registry is module state, so a leaked drag would leak into the next test.
// Clearing is owner-guarded, so the id has to be read back rather than guessed.
afterEach(() => {
  const active = getActiveDrag();
  if (active !== null) clearActiveDrag(active.id);
});

describe('createDragTransfer', () => {
  it('reads back what was written, and empty string for what was not', () => {
    const transfer = createDragTransfer();
    transfer.setData('text/plain', 'hello');
    expect(transfer.getData('text/plain')).toBe('hello');
    // The DOM contract: a format never written reads '' rather than undefined,
    // so a consumer can branch on truthiness without a null check.
    expect(transfer.getData('application/json')).toBe('');
  });

  it('overwrites a format rather than appending to it', () => {
    const transfer = createDragTransfer();
    transfer.setData('text/plain', 'first');
    transfer.setData('text/plain', 'second');
    expect(transfer.getData('text/plain')).toBe('second');
    expect(transfer.types).toEqual(['text/plain']);
  });

  it('lists every format once, in the order first written', () => {
    const transfer = createDragTransfer();
    transfer.setData('text/plain', 'a');
    transfer.setData('application/json', '{}');
    transfer.setData('text/plain', 'b');
    expect(transfer.types).toEqual(['text/plain', 'application/json']);
  });

  it('hands out a copy of types, so a consumer cannot mutate the transfer through it', () => {
    const transfer = createDragTransfer();
    transfer.setData('text/plain', 'a');
    const types = transfer.types;
    expect(transfer.types).not.toBe(types);
    expect(transfer.types).toEqual(['text/plain']);
  });

  it('starts at the permitted effect and a dropEffect of none', () => {
    // 'none' at rest is what makes "nothing took it" the default verdict: a drop
    // zone has to actively claim a drag for it not to read as canceled.
    expect(createDragTransfer().dropEffect).toBe('none');
    expect(createDragTransfer('copy').effectAllowed).toBe('copy');
    expect(createDragTransfer().effectAllowed).toBe('all');
  });

  it('takes a dropEffect a drop zone writes onto it', () => {
    const transfer = createDragTransfer('copy');
    transfer.dropEffect = 'copy';
    expect(transfer.dropEffect).toBe('copy');
  });
});

describe('writeTransferData', () => {
  it('writes every entry of the record', () => {
    const transfer = createDragTransfer();
    writeTransferData(transfer, { 'application/json': '{"a":1}', 'text/plain': 'a' });
    expect(transfer.getData('text/plain')).toBe('a');
    expect(transfer.getData('application/json')).toBe('{"a":1}');
  });

  it('is a no-op for undefined, so a Draggable with no data still lifts', () => {
    const transfer = createDragTransfer();
    writeTransferData(transfer, undefined);
    expect(transfer.types).toEqual([]);
  });
});

describe('active drag registry', () => {
  it('is empty until a drag publishes itself', () => {
    expect(getActiveDrag()).toBeNull();
  });

  it('publishes and clears the drag in flight', () => {
    const transfer = createDragTransfer();
    setActiveDrag({ id: 'a', transfer });
    expect(getActiveDrag()).toEqual({ id: 'a', transfer });
    clearActiveDrag('a');
    expect(getActiveDrag()).toBeNull();
  });

  it('ignores a clear from a Draggable that does not own the drag', () => {
    // Two sources unmounting in the wrong order would otherwise cancel each
    // other's drags — the owner guard is what makes the single slot safe.
    const transfer = createDragTransfer();
    setActiveDrag({ id: 'a', transfer });
    clearActiveDrag('b');
    expect(getActiveDrag()).toEqual({ id: 'a', transfer });
  });

  it('notifies subscribers on start and end, and not after unsubscribing', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeActiveDrag(listener);
    setActiveDrag({ id: 'a', transfer: createDragTransfer() });
    clearActiveDrag('a');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setActiveDrag({ id: 'b', transfer: createDragTransfer() });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify for a clear the owner guard rejected', () => {
    setActiveDrag({ id: 'a', transfer: createDragTransfer() });
    const listener = vi.fn();
    subscribeActiveDrag(listener);
    clearActiveDrag('b');
    expect(listener).not.toHaveBeenCalled();
  });
});
