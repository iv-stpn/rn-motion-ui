import { describe, expect, it } from 'vitest';
import type { TableColumn } from '../table-types';
import { CHECKBOX_COLUMN_WIDTH, computeColumnWidths } from '../table-utils';

type Row = { id: string };

function col(overrides: Partial<TableColumn<Row>> & { key: string }): TableColumn<Row> {
  return { header: overrides.key, ...overrides };
}

describe('computeColumnWidths', () => {
  it('distributes the remaining width across fr columns', () => {
    const columns = [col({ key: 'a', width: '1fr' }), col({ key: 'b', width: '2fr' })];
    expect(computeColumnWidths(columns, 300, false)).toEqual({ a: 100, b: 200 });
  });

  it('gives px columns their exact width and fr columns the rest', () => {
    const columns = [col({ key: 'a', width: '100px' }), col({ key: 'b', width: '1fr' })];
    expect(computeColumnWidths(columns, 300, false)).toEqual({ a: 100, b: 200 });
  });

  it('offsets the fr share by the checkbox column when selectable', () => {
    const columns = [col({ key: 'a', width: '1fr' })];
    expect(computeColumnWidths(columns, 300, true)).toEqual({ a: 300 - CHECKBOX_COLUMN_WIDTH });
  });

  it('floors a fr column to its minWidth, overflowing rather than squeezing', () => {
    const columns = [col({ key: 'a', width: '1fr', minWidth: 250 }), col({ key: 'b', width: '1fr' })];
    // `a` would resolve to 150, but its floor is 250; `b` keeps its 150 share.
    expect(computeColumnWidths(columns, 300, false)).toEqual({ a: 250, b: 150 });
  });

  it('floors a px column to its minWidth when the fixed width is smaller', () => {
    const columns = [col({ key: 'a', width: '80px', minWidth: 120 })];
    expect(computeColumnWidths(columns, 300, false)).toEqual({ a: 120 });
  });

  it('leaves a column without minWidth untouched', () => {
    const columns = [col({ key: 'a', width: '1fr' })];
    expect(computeColumnWidths(columns, 300, false)).toEqual({ a: 300 });
  });
});
