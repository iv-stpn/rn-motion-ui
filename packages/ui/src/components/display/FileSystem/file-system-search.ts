// Pure logic behind the search results list: which entries a query actually hit,
// where it matched inside each label, and the breadcrumb trail a result row names
// its folder with. Split out of the view so all three are unit-testable without
// the render layer.

import { getPathParts } from '../../../lib/path';
import type { FileSystemEntry, FileSystemIndex } from './file-system.types';

/**
 * Flatten a filtered index into the list of entries the query hit directly.
 *
 * Every folder's `children` list has already been pruned to the visible set by
 * the caller, so this only has to drop ancestor-only folders — those whose own
 * name does not contain the query and are in the index purely because a
 * descendant matched. Files need no such check: a file is in a pruned index only
 * if it matched.
 */
export function flatSearchResults(index: FileSystemIndex, searchQuery: string): FileSystemEntry[] {
  const results: FileSystemEntry[] = [];
  const seen = new Set<string>();
  for (const childList of index.children.values()) {
    for (const entry of childList) {
      if (!seen.has(entry.path)) {
        seen.add(entry.path);
        if (entry.kind === 'file' || entry.name.toLowerCase().includes(searchQuery)) results.push(entry);
      }
    }
  }
  // Folders before files; alphabetical within each kind. Deliberately not the
  // active sort: a flat list spanning depths is scanned by name, and the columns
  // the sort keys name are not on screen here.
  results.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
  return results;
}

/** The trail separator. A caret, not a slash — this is a trail, not a path. */
export const CRUMB_SEPARATOR = '›';

/** One run of a label: the text, and whether the query is what put it here. */
export type SearchMatchSegment = { isMatch: boolean; offset: number; text: string };

/**
 * `text` split into alternating plain and matched runs. The query arrives already
 * normalized (trimmed and lowercased by `setSearchInput`), so matching is a
 * lowercased `indexOf` walk — every slice comes off the original string, which
 * keeps the label's own casing intact.
 *
 * Returns a single non-match segment when there is nothing to mark, so callers can
 * treat "no match" and "one run" the same way. `offset` is where the run starts:
 * stable for a given string, and unique within it even when the same run repeats,
 * which is what makes it usable as a render key.
 */
export function splitSearchMatches(text: string, query: string): SearchMatchSegment[] {
  const whole = [{ isMatch: false, offset: 0, text }];
  if (!query) return whole;

  const haystack = text.toLowerCase();
  const segments: SearchMatchSegment[] = [];
  let cursor = 0;
  let match = haystack.indexOf(query);

  while (match !== -1) {
    if (match > cursor) segments.push({ isMatch: false, offset: cursor, text: text.slice(cursor, match) });
    segments.push({ isMatch: true, offset: match, text: text.slice(match, match + query.length) });
    cursor = match + query.length;
    match = haystack.indexOf(query, cursor);
  }

  if (segments.length === 0) return whole;
  if (cursor < text.length) segments.push({ isMatch: false, offset: cursor, text: text.slice(cursor) });
  return segments;
}

/** One trail segment. `key` is its folder path — `''` for the root. */
export type Crumb = { key: string; label: string };

/**
 * The trail for an entry, root first. Always at least one crumb — the root — so a
 * hit sitting at the top level still names where it lives, rather than dropping
 * the line for some rows and keeping it for others.
 */
export function buildCrumbs(parentPath: string, rootLabel: string): Crumb[] {
  const crumbs: Crumb[] = [{ key: '', label: rootLabel }];
  if (!parentPath) return crumbs;

  let path = '';
  for (const part of getPathParts(parentPath)) {
    path = path ? `${path}/${part}` : part;
    crumbs.push({ key: path, label: part });
  }
  return crumbs;
}
