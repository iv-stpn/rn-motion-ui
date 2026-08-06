import { describe, expect, it } from 'vitest';
import type { DragTransfer } from '../drag.types';
import { createDragTransfer, dragGroupsMatch, mirrorDragTransfer, writeTransferData } from '../drag-transfer';

/**
 * A stand-in for the browser's own `DataTransfer`, protected the way a real one is:
 * `types` still lists the formats, `getData` reads `''`. That is the state every
 * event between `dragstart` and the drop sees, and the reason the mirror exists —
 * `createDragTransfer` cannot stand in here, since it is readable throughout.
 */
function protectedTransfer(entries: Record<string, string>): DragTransfer {
  const formats = new Set(Object.keys(entries));
  return {
    dropEffect: 'none',
    effectAllowed: 'move',
    getData: () => '',
    setData: (format) => {
      formats.add(format);
    },
    get types() {
      return [...formats];
    },
  };
}

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
    // 'none' at rest is what makes "nothing took it" the default verdict: a zone
    // has to actively claim a drag for it not to read as canceled.
    expect(createDragTransfer().dropEffect).toBe('none');
    expect(createDragTransfer('copy').effectAllowed).toBe('copy');
    expect(createDragTransfer().effectAllowed).toBe('all');
  });

  it('takes a dropEffect a zone writes onto it', () => {
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

describe('mirrorDragTransfer', () => {
  it('reads the payload back off a transfer that has stopped answering', () => {
    // The bug this exists for: mid-drag the browser answers '' to every getData,
    // so a zone asked whether it accepts the payload would decide it carries none.
    const real = protectedTransfer({ 'application/x-item': '{"id":1}' });
    expect(real.getData('application/x-item')).toBe('');

    const mirror = mirrorDragTransfer(real, { 'application/x-item': '{"id":1}' });
    expect(mirror.getData('application/x-item')).toBe('{"id":1}');
    expect(mirror.getData('text/plain')).toBe('');
  });

  it('snapshots formats the page set before the lift, not just the ones passed in', () => {
    const real = createDragTransfer('move');
    real.setData('text/uri-list', 'https://example.com');
    const mirror = mirrorDragTransfer(real, { 'application/x-item': 'a' });
    expect(mirror.types).toEqual(['text/uri-list', 'application/x-item']);
    expect(mirror.getData('text/uri-list')).toBe('https://example.com');
  });

  it('writes through, so a format added mid-drag still crosses to the drop', () => {
    const real = createDragTransfer('move');
    const mirror = mirrorDragTransfer(real, undefined);
    mirror.setData('text/plain', 'late');
    expect(mirror.getData('text/plain')).toBe('late');
    expect(real.getData('text/plain')).toBe('late');
  });

  it('answers a zone its own claim, and passes it to the browser', () => {
    // Read locally because `onDrop` runs before the release and has to see 'move';
    // written through because `dragend` reports whatever the browser holds.
    const real = createDragTransfer('move');
    const mirror = mirrorDragTransfer(real, undefined);
    mirror.dropEffect = 'move';
    expect(mirror.dropEffect).toBe('move');
    expect(real.dropEffect).toBe('move');
  });

  it('leaves effectAllowed with the real transfer, which the browser reads', () => {
    const real = createDragTransfer('all');
    const mirror = mirrorDragTransfer(real, undefined);
    expect(mirror.effectAllowed).toBe('all');
    mirror.effectAllowed = 'move';
    expect(real.effectAllowed).toBe('move');
    expect(mirror.effectAllowed).toBe('move');
  });

  it('hands out a copy of types, like the transfer it mirrors', () => {
    const mirror = mirrorDragTransfer(createDragTransfer(), { 'text/plain': 'a' });
    expect(mirror.types).not.toBe(mirror.types);
    expect(mirror.types).toEqual(['text/plain']);
  });
});

describe('dragGroupsMatch', () => {
  it('matches when the two share a group', () => {
    expect(dragGroupsMatch(['cards', 'files'], ['files'])).toBe(true);
  });

  it('refuses when both name groups and none overlap', () => {
    expect(dragGroupsMatch(['cards'], ['files'])).toBe(false);
  });

  it('treats an empty list on either side as a wildcard', () => {
    // The reason a system that never mentions groups needs no configuration: the
    // common case of one kind of drag in a tree matches with nothing declared.
    expect(dragGroupsMatch([], ['files'])).toBe(true);
    expect(dragGroupsMatch(['cards'], [])).toBe(true);
    expect(dragGroupsMatch([], [])).toBe(true);
  });
});
