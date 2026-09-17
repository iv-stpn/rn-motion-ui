import { describe, expect, it } from 'vitest';
import { SHAPE_RADIUS, shouldSuppressDivider } from '../toggle-group.logic';

describe('SHAPE_RADIUS', () => {
  it('leaves square corners unrounded', () => {
    expect(SHAPE_RADIUS.square).toBe('rounded-none');
  });

  it('uses the interactive token for the rounded shape', () => {
    expect(SHAPE_RADIUS.rounded).toBe('rounded-interactive');
  });

  it('rounds pill and circle fully', () => {
    expect(SHAPE_RADIUS.pill).toBe('rounded-full');
    expect(SHAPE_RADIUS.circle).toBe('rounded-full');
  });
});

describe('shouldSuppressDivider', () => {
  it('suppresses every divider in connected mode', () => {
    expect(shouldSuppressDivider(0, 2, true)).toBe(true);
    expect(shouldSuppressDivider(1, 2, true)).toBe(true);
  });

  it('suppresses the selected item trailing divider', () => {
    expect(shouldSuppressDivider(2, 2, false)).toBe(true);
  });

  it('suppresses the divider immediately before the selected item', () => {
    expect(shouldSuppressDivider(1, 2, false)).toBe(true);
  });

  it('keeps a divider two-or-more positions away from the selection', () => {
    expect(shouldSuppressDivider(0, 2, false)).toBe(false);
  });

  it('keeps every divider when nothing is selected', () => {
    expect(shouldSuppressDivider(0, -1, false)).toBe(false);
    expect(shouldSuppressDivider(1, -1, false)).toBe(false);
  });
});
