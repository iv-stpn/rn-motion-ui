// Pure path helpers for the file tree. Path-first model (after @pierre/trees):
// every entry is a canonical string; directories end in a trailing slash and
// files never do. No numeric IDs anywhere — the path IS the identity.

import type { FileTreeKind } from './file-tree.types';

const NUMBER_CHUNK = /(\d+)/;
const NUMBER_CHUNK_ONLY = /^\d+$/;

/** True when `path` denotes a directory (canonical form ends in `/`). */
export function isDirectoryPath(path: string): boolean {
  return path.endsWith('/');
}

/** Kind implied by canonical form. */
export function kindOfPath(path: string): FileTreeKind {
  return isDirectoryPath(path) ? 'directory' : 'file';
}

/**
 * Normalize a raw path into canonical form:
 *  - collapse repeated slashes,
 *  - strip a leading slash (tree is rooted, paths are relative),
 *  - preserve a single trailing slash iff the input had one (→ directory).
 *
 * Empty / slash-only inputs return `''` (the implicit root, never rendered).
 */
export function canonicalizePath(raw: string): string {
  if (!raw) return '';
  const isDir = raw.endsWith('/');
  const segments = raw.split('/').filter(Boolean);
  if (segments.length === 0) return '';
  const joined = segments.join('/');
  return isDir ? `${joined}/` : joined;
}

/** The leaf name of a canonical path (no trailing slash for dirs). */
export function leafName(path: string): string {
  const trimmed = isDirectoryPath(path) ? path.slice(0, -1) : path;
  const idx = trimmed.lastIndexOf('/');
  return idx === -1 ? trimmed : trimmed.slice(idx + 1);
}

/**
 * The parent directory path of a canonical path, or `''` for a top-level entry.
 * The parent is always a directory path (trailing slash) or the empty root.
 */
export function parentPath(path: string): string {
  const trimmed = isDirectoryPath(path) ? path.slice(0, -1) : path;
  const idx = trimmed.lastIndexOf('/');
  if (idx === -1) return '';
  return `${trimmed.slice(0, idx)}/`;
}

/**
 * Every ancestor directory path of `path`, root-first, excluding `path` itself
 * and the empty root. `a/b/c.ts` → `['a/', 'a/b/']`.
 */
export function ancestorPaths(path: string): string[] {
  const trimmed = isDirectoryPath(path) ? path.slice(0, -1) : path;
  const segments = trimmed.split('/');
  const out: string[] = [];
  let acc = '';
  // Every segment except the last is a directory ancestor.
  for (let i = 0; i < segments.length - 1; i += 1) {
    acc += `${segments[i]}/`;
    out.push(acc);
  }
  return out;
}

/** Segment names of a canonical path (no empties). `a/b/c.ts` → `[a,b,c.ts]`. */
export function pathSegments(path: string): string[] {
  const trimmed = isDirectoryPath(path) ? path.slice(0, -1) : path;
  return trimmed.split('/').filter(Boolean);
}

/** True when `candidate` is `ancestor` itself or nested anywhere beneath it. */
export function isSelfOrDescendant(candidate: string, ancestor: string): boolean {
  if (candidate === ancestor) return true;
  if (!isDirectoryPath(ancestor)) return false;
  return candidate.startsWith(ancestor);
}

// ── Natural-order comparator ────────────────────────────────────────────────

/**
 * Split a name into alternating text/number chunks for natural ordering so
 * `file2` sorts before `file10`. Text chunks are lowercased for
 * case-insensitive compare; number chunks are compared numerically.
 */
export function chunk(name: string): (string | number)[] {
  return name
    .split(NUMBER_CHUNK)
    .filter((part) => part.length > 0)
    .map((part) => (NUMBER_CHUNK_ONLY.test(part) ? Number(part) : part.toLowerCase()));
}

/** Compare two segment names, dirs-before-files handled by the caller. */
export function compareNames(a: string, b: string): number {
  const ca = chunk(a);
  const cb = chunk(b);
  const len = Math.min(ca.length, cb.length);
  for (let i = 0; i < len; i += 1) {
    const x = ca[i];
    const y = cb[i];
    if (x === undefined || y === undefined) break;
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x - y;
    } else {
      const sx = String(x);
      const sy = String(y);
      if (sx !== sy) return sx < sy ? -1 : 1;
    }
  }
  if (ca.length !== cb.length) return ca.length - cb.length;
  // Stable tiebreak on the raw strings so equal-ignoring-case names are ordered.
  if (a === b) return 0;
  if (a < b) return -1;
  return 1;
}

/**
 * Compare two canonical paths with Pierre's default ordering: walk segment by
 * segment; at the first differing segment, a directory sorts before a file, then
 * natural-order case-insensitive by name. Shared-prefix shorter path first.
 */
export function comparePaths(a: string, b: string): number {
  const sa = pathSegments(a);
  const sb = pathSegments(b);
  const aDir = isDirectoryPath(a);
  const bDir = isDirectoryPath(b);
  const len = Math.min(sa.length, sb.length);
  for (let i = 0; i < len; i += 1) {
    const na = sa[i] ?? '';
    const nb = sb[i] ?? '';
    // A segment that is NOT the last one is always a directory.
    const aIsDirHere = i < sa.length - 1 || aDir;
    const bIsDirHere = i < sb.length - 1 || bDir;
    if (aIsDirHere !== bIsDirHere) return aIsDirHere ? -1 : 1;
    const byName = compareNames(na, nb);
    if (byName !== 0) return byName;
  }
  return sa.length - sb.length;
}
