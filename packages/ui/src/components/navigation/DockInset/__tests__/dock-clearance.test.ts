import { describe, expect, it } from 'vitest';
import { clearClearance, maxClearance, reportClearance } from '../dock-clearance';

describe('reportClearance', () => {
  it('inserts a new id without mutating the input map', () => {
    const entries = {};
    const next = reportClearance(entries, 'dock-a', 68);
    expect(next).toEqual({ 'dock-a': 68 });
    expect(entries).toEqual({});
  });

  it('refreshes an existing id in place and keeps the original order', () => {
    const entries = { 'dock-a': 68, 'dock-b': 72 };
    const next = reportClearance(entries, 'dock-a', 70);
    expect(next).toEqual({ 'dock-a': 70, 'dock-b': 72 });
  });

  it('returns the same map identity when the value is unchanged', () => {
    const entries = { 'dock-a': 68 };
    expect(reportClearance(entries, 'dock-a', 68)).toBe(entries);
  });
});

describe('clearClearance', () => {
  it('removes an id while leaving the rest intact', () => {
    const entries = { 'dock-a': 68, 'dock-b': 72 };
    expect(clearClearance(entries, 'dock-a')).toEqual({ 'dock-b': 72 });
  });

  it('returns the same map identity when the id is absent', () => {
    const entries = { 'dock-a': 68 };
    expect(clearClearance(entries, 'dock-b')).toBe(entries);
  });

  it('does not match inherited properties when deciding presence', () => {
    const entries = { constructor: 1 };
    // `constructor` is an own key here, so it clears normally — the guard must
    // not treat an arbitrary id that collides with an Object.prototype name as
    // present via inheritance.
    expect(clearClearance(entries, 'toString')).toBe(entries);
    expect(clearClearance(entries, 'constructor')).toEqual({});
  });
});

describe('maxClearance', () => {
  it('is 0 for an empty map', () => {
    expect(maxClearance({})).toBe(0);
  });

  it('returns the single reported value', () => {
    expect(maxClearance({ 'dock-a': 68 })).toBe(68);
  });

  it('returns the tallest value across several docks', () => {
    expect(maxClearance({ 'dock-a': 68, 'dock-b': 72, 'dock-c': 60 })).toBe(72);
  });

  it('ignores negative or zero values, treating them as no dock', () => {
    expect(maxClearance({ 'dock-a': -4, 'dock-b': 0 })).toBe(0);
  });
});
