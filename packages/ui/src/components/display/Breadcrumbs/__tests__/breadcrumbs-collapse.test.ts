import { describe, expect, it } from 'vitest';
import { type BreadcrumbSlot, collapseBreadcrumbs } from '../breadcrumbs-collapse';

/** Reads a slot list back as a compact string: `a · …(b,c) · d`. */
function render(slots: BreadcrumbSlot<string>[]): string {
  return slots.map((slot) => (slot.type === 'item' ? slot.item : `…(${slot.hidden.join(',')})`)).join(' · ');
}

const TRAIL = ['Files', 'Documents', 'Reports', '2024', 'Q1'] as const;

describe('collapseBreadcrumbs', () => {
  it('keeps every segment when no limit is given', () => {
    expect(render(collapseBreadcrumbs(TRAIL))).toBe('Files · Documents · Reports · 2024 · Q1');
  });

  it('keeps every segment when the trail already fits', () => {
    expect(render(collapseBreadcrumbs(TRAIL, 5))).toBe('Files · Documents · Reports · 2024 · Q1');
    expect(render(collapseBreadcrumbs(TRAIL, 9))).toBe('Files · Documents · Reports · 2024 · Q1');
  });

  it('collapses the middle, keeping the root and the levels nearest the current one', () => {
    expect(render(collapseBreadcrumbs(TRAIL, 4))).toBe('Files · …(Documents) · Reports · 2024 · Q1');
    expect(render(collapseBreadcrumbs(TRAIL, 3))).toBe('Files · …(Documents,Reports) · 2024 · Q1');
  });

  it('renders exactly `maxVisible` segments beside the ellipsis', () => {
    for (const limit of [2, 3, 4]) {
      const slots = collapseBreadcrumbs(TRAIL, limit);
      expect(slots.filter((slot) => slot.type === 'item')).toHaveLength(limit);
    }
  });

  it('treats a limit below two as two — one segment is not a trail', () => {
    const expected = 'Files · …(Documents,Reports,2024) · Q1';
    expect(render(collapseBreadcrumbs(TRAIL, 1))).toBe(expected);
    expect(render(collapseBreadcrumbs(TRAIL, 0))).toBe(expected);
    expect(render(collapseBreadcrumbs(TRAIL, -3))).toBe(expected);
  });

  it('floors a fractional limit', () => {
    expect(render(collapseBreadcrumbs(TRAIL, 3.8))).toBe(render(collapseBreadcrumbs(TRAIL, 3)));
  });

  it('hands every dropped segment to the ellipsis rather than discarding it', () => {
    const slots = collapseBreadcrumbs(TRAIL, 3);
    const shown = slots.flatMap((slot) => (slot.type === 'item' ? [slot.item] : slot.hidden));
    expect(shown).toEqual([...TRAIL]);
  });

  it('never emits an ellipsis that hides nothing', () => {
    for (const limit of [2, 3, 4, 5, 6]) {
      for (const slot of collapseBreadcrumbs(TRAIL, limit)) {
        if (slot.type === 'ellipsis') expect(slot.hidden.length).toBeGreaterThan(0);
      }
    }
  });

  it('handles empty and single-segment trails', () => {
    expect(collapseBreadcrumbs([], 3)).toEqual([]);
    expect(render(collapseBreadcrumbs(['Files'], 2))).toBe('Files');
  });

  it('collapses the shortest trail that overflows', () => {
    expect(render(collapseBreadcrumbs(['a', 'b', 'c'], 2))).toBe('a · …(b) · c');
  });
});
