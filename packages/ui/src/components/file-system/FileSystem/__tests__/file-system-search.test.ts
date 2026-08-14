import { describe, expect, it } from 'vitest';
import { buildFileSystemIndex } from '../logic/file-system-index';
import { buildCrumbs, flatSearchResults, splitSearchMatches } from '../logic/file-system-search';
import { computeVisiblePaths, filterIndexToVisible } from '../logic/file-system-visibility';
import type { FileSystemItem } from '../types/file-system.types';

/**
 * `Reports/` matches "report" on its own name; `Documents/` only leads to it.
 * `Invoice-0042.pdf` sits at the root, outside `Documents/`, so it is what a
 * folder-scoped query drops and a root-scoped one keeps.
 */
const ITEMS: FileSystemItem[] = [
  { kind: 'file', path: 'Invoice-0042.pdf' },
  { kind: 'file', path: 'README.md' },
  { kind: 'file', path: 'Documents/Reports/Q1-report.pdf' },
  { kind: 'file', path: 'Documents/Reports/Q2-report.pdf' },
  { kind: 'file', path: 'Documents/notes.txt' },
];

/**
 * The real pipeline the store runs: index → visible set → pruned index → flat
 * hits. `base` is the search base `_recomputeEntries` derives from the scope —
 * `''` for a root-scoped query, the open folder for a folder-scoped one.
 */
function hits(query: string, base: string): string[] {
  const index = buildFileSystemIndex(ITEMS);
  const visible = computeVisiblePaths({ currentPath: base, fileFilter: null, index, searchQuery: query });
  return flatSearchResults(filterIndexToVisible(index, visible), query).map((entry) => entry.path);
}

describe('flatSearchResults', () => {
  it('keeps a folder that matched on its own name, and drops one that only leads to a match', () => {
    // `Reports/` is a hit; `Documents/` is in the pruned index only as its ancestor.
    expect(hits('report', '')).toEqual([
      'Documents/Reports/',
      'Documents/Reports/Q1-report.pdf',
      'Documents/Reports/Q2-report.pdf',
    ]);
  });

  it('orders folders before files, alphabetically within each kind', () => {
    const paths = hits('report', '');
    expect(paths[0]?.endsWith('/')).toBe(true);
    expect(paths.slice(1)).toEqual(['Documents/Reports/Q1-report.pdf', 'Documents/Reports/Q2-report.pdf']);
  });

  it('drops a hit outside the open folder when the query is folder-scoped', () => {
    expect(hits('invoice', 'Documents/')).toEqual([]);
  });

  it('keeps that same hit when the query is root-scoped', () => {
    expect(hits('invoice', '')).toEqual(['Invoice-0042.pdf']);
  });

  it('returns each match once even though the walk visits every children list', () => {
    const paths = hits('report', '');
    expect(new Set(paths).size).toBe(paths.length);
  });
});

/** The shape assertions read against: `'plain'` vs `'[match]'` runs, in order. */
function marked(text: string, query: string): string {
  return splitSearchMatches(text, query)
    .map((segment) => (segment.isMatch ? `[${segment.text}]` : segment.text))
    .join('');
}

describe('splitSearchMatches', () => {
  it('returns the whole string as one non-match run when the query is empty', () => {
    expect(splitSearchMatches('Report.pdf', '')).toEqual([{ isMatch: false, offset: 0, text: 'Report.pdf' }]);
  });

  it('returns the whole string as one non-match run when nothing matches', () => {
    expect(splitSearchMatches('Report.pdf', 'invoice')).toEqual([{ isMatch: false, offset: 0, text: 'Report.pdf' }]);
  });

  it('marks a match in the middle', () => {
    expect(marked('annual-report.pdf', 'report')).toBe('annual-[report].pdf');
  });

  it('marks a match at the start without emitting an empty leading run', () => {
    expect(splitSearchMatches('report.pdf', 'report')).toEqual([
      { isMatch: true, offset: 0, text: 'report' },
      { isMatch: false, offset: 6, text: '.pdf' },
    ]);
  });

  it('marks a match at the end without emitting an empty trailing run', () => {
    expect(splitSearchMatches('q1-report', 'report')).toEqual([
      { isMatch: false, offset: 0, text: 'q1-' },
      { isMatch: true, offset: 3, text: 'report' },
    ]);
  });

  it('marks every occurrence, not just the first', () => {
    expect(marked('report-of-reports.pdf', 'report')).toBe('[report]-of-[report]s.pdf');
  });

  it('keeps the original casing of a case-insensitive match', () => {
    expect(marked('Annual REPORT.pdf', 'report')).toBe('Annual [REPORT].pdf');
  });

  it('gives adjacent occurrences distinct offsets', () => {
    expect(splitSearchMatches('aa', 'a')).toEqual([
      { isMatch: true, offset: 0, text: 'a' },
      { isMatch: true, offset: 1, text: 'a' },
    ]);
  });

  it('marks the whole string when the query is all of it', () => {
    expect(splitSearchMatches('pdf', 'pdf')).toEqual([{ isMatch: true, offset: 0, text: 'pdf' }]);
  });
});

describe('buildCrumbs', () => {
  it('yields the root crumb alone for an entry at the root', () => {
    expect(buildCrumbs('', 'Files')).toEqual([{ key: '', label: 'Files' }]);
  });

  it('names the root with the given label', () => {
    expect(buildCrumbs('', 'Documents')).toEqual([{ key: '', label: 'Documents' }]);
  });

  it('walks a nested path root-first', () => {
    expect(buildCrumbs('invoices/2024/', 'Files')).toEqual([
      { key: '', label: 'Files' },
      { key: 'invoices', label: 'invoices' },
      { key: 'invoices/2024', label: '2024' },
    ]);
  });

  it('handles a single-level path', () => {
    expect(buildCrumbs('invoices/', 'Files')).toEqual([
      { key: '', label: 'Files' },
      { key: 'invoices', label: 'invoices' },
    ]);
  });

  it('gives repeated folder names distinct keys', () => {
    const crumbs = buildCrumbs('archive/2024/archive/', 'Files');
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['Files', 'archive', '2024', 'archive']);
    expect(new Set(crumbs.map((crumb) => crumb.key)).size).toBe(crumbs.length);
  });
});
