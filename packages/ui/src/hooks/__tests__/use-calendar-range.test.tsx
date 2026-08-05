/**
 * Range-mode tests for `useCalendar`: the two-press loop, the preview band, and
 * `setRange`.
 *
 * Separate from `use-calendar.test.tsx` only because the two together run past
 * the per-file line cap. The seams they share live in `calendar-harness.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { cell, cells, mountCalendar, press, unmountAll } from './calendar-harness';

afterEach(unmountAll);

describe('the two-press loop', () => {
  it('completes over two presses', () => {
    const onSelectRange = vi.fn();
    const view = mountCalendar({ mode: 'range', onSelectRange });
    press(view, '2026-08-10');
    expect(view.current.selectedRange).toEqual({ start: '2026-08-10', end: null });
    press(view, '2026-08-14');
    expect(view.current.selectedRange).toEqual({ start: '2026-08-10', end: '2026-08-14' });
    expect(onSelectRange).toHaveBeenCalledTimes(2);
  });

  it('normalises a range picked backwards', () => {
    const view = mountCalendar({ mode: 'range' });
    press(view, '2026-08-14');
    press(view, '2026-08-10');
    // Dragging backwards is accepted and reordered, not refused.
    expect(view.current.selectedRange).toEqual({ start: '2026-08-10', end: '2026-08-14' });
  });

  it('restarts from a press on a completed range', () => {
    const view = mountCalendar({ mode: 'range' });
    press(view, '2026-08-10');
    press(view, '2026-08-14');
    press(view, '2026-08-20');
    // Not widened: a third press is a redo, which is how every range field behaves.
    expect(view.current.selectedRange).toEqual({ start: '2026-08-20', end: null });
  });

  it('marks the endpoints and the days strictly between them', () => {
    const view = mountCalendar({ mode: 'range' });
    press(view, '2026-08-10');
    press(view, '2026-08-13');
    const start = cell(view.current, '2026-08-10');
    const inside = cell(view.current, '2026-08-11');
    const end = cell(view.current, '2026-08-13');
    expect([start.isRangeStart, start.isSelected, start.isInRange]).toEqual([true, true, false]);
    expect([inside.isInRange, inside.isSelected]).toEqual([true, false]);
    expect([end.isRangeEnd, end.isSelected, end.isInRange]).toEqual([true, true, false]);
  });

  it('leaves the single shape empty in range mode', () => {
    const view = mountCalendar({ mode: 'range' });
    press(view, '2026-08-10');
    expect(view.current.selectedDate).toBeNull();
  });

  it('refuses a blocked endpoint', () => {
    const onSelectRange = vi.fn();
    const view = mountCalendar({ mode: 'range', minDate: '2026-08-10', onSelectRange });
    press(view, '2026-08-04');
    expect(view.current.selectedRange).toEqual({ start: null, end: null });
    expect(onSelectRange).not.toHaveBeenCalled();
  });

  it('reports a controlled range without changing itself', () => {
    const onSelectRange = vi.fn();
    const range = { start: '2026-08-10', end: '2026-08-14' };
    const view = mountCalendar({ mode: 'range', selectedRange: range, onSelectRange });
    press(view, '2026-08-20');
    expect(onSelectRange).toHaveBeenCalledWith({ start: '2026-08-20', end: null });
    expect(view.current.selectedRange).toEqual(range);
  });

  it('clears both ends', () => {
    const range = { start: '2026-08-10', end: '2026-08-14' };
    const view = mountCalendar({ mode: 'range', defaultSelectedRange: range });
    view.act(() => view.current.clearSelection());
    expect(view.current.selectedRange).toEqual({ start: null, end: null });
  });
});

describe('the preview band', () => {
  it('runs from the fixed start to the hovered day', () => {
    const view = mountCalendar({ mode: 'range' });
    press(view, '2026-08-10');
    view.act(() => view.current.getDayProps(cell(view.current, '2026-08-13')).onHoverIn());
    expect(cell(view.current, '2026-08-12').isPreview).toBe(true);
    expect(cell(view.current, '2026-08-14').isPreview).toBe(false);
  });

  it('falls back to the cursor when the pointer leaves', () => {
    const view = mountCalendar({ mode: 'range' });
    press(view, '2026-08-10');
    const day = () => view.current.getDayProps(cell(view.current, '2026-08-13'));
    view.act(() => day().onHoverIn());
    view.act(() => day().onHoverOut());
    // Native has no pointer, so the preview follows the keyboard cursor — which the
    // press just left on the start day.
    expect(cell(view.current, '2026-08-12').isPreview).toBe(false);
    expect(cell(view.current, '2026-08-10').isPreview).toBe(true);
  });

  it('stops once both ends are set', () => {
    const view = mountCalendar({ mode: 'range' });
    press(view, '2026-08-10');
    press(view, '2026-08-14');
    expect(cells(view.current).some((day) => day.isPreview)).toBe(false);
  });

  it('stays empty in single mode', () => {
    const view = mountCalendar();
    press(view, '2026-08-10');
    expect(cells(view.current).some((day) => day.isPreview)).toBe(false);
  });
});

describe('setRange', () => {
  it('sets both ends at once, normalising as it goes', () => {
    const view = mountCalendar({ mode: 'range' });
    view.act(() => view.current.setRange({ start: '2026-08-20', end: '2026-08-04' }));
    expect(view.current.selectedRange).toEqual({ start: '2026-08-04', end: '2026-08-20' });
  });

  it('accepts a half-open range', () => {
    const view = mountCalendar({ mode: 'range' });
    view.act(() => view.current.setRange({ start: '2026-08-04', end: null }));
    expect(view.current.selectedRange).toEqual({ start: '2026-08-04', end: null });
  });

  it('refuses the whole range when either end is blocked', () => {
    const view = mountCalendar({ mode: 'range', minDate: '2026-08-10' });
    view.act(() => view.current.setRange({ start: '2026-08-04', end: '2026-08-20' }));
    // All-or-nothing, like `selectDate`: trimming to the allowed part would hand
    // back a range nobody asked for.
    expect(view.current.selectedRange).toEqual({ start: null, end: null });
  });

  it('is ignored in single mode', () => {
    const view = mountCalendar();
    view.act(() => view.current.setRange({ start: '2026-08-04', end: '2026-08-20' }));
    expect(view.current.selectedRange).toEqual({ start: null, end: null });
    expect(view.current.selectedDate).toBeNull();
  });
});
