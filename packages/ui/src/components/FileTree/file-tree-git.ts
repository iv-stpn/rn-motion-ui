/** biome-ignore-all lint/style/useExportsLast: exports and defines multiple utils */
// Pure git-status resolution: per-path status + directory rollups. RN-free.
//
// A directory's rolled-up status summarizes its descendants so a collapsed
// folder still signals "something changed inside". Rollup precedence follows
// Pierre: conflicts (U) dominate, then modifications (M/R), then additions (A),
// then deletions (D). `null` means ignored/clean and never rolls up.

import type { FileTreeGitStatus, FileTreeGitStatusCode, FileTreeGitStatusMap } from './file-tree.types';
import { ancestorPaths } from './file-tree-paths';

/** Presentation for a status code: single letter + theme color token. */
export type GitStatusPresentation = { letter: string; token: string; label: string };

const PRESENTATION: Record<FileTreeGitStatusCode, GitStatusPresentation> = {
  A: { letter: 'A', token: 'success', label: 'Added' },
  M: { letter: 'M', token: 'warning', label: 'Modified' },
  R: { letter: 'R', token: 'warning', label: 'Renamed' },
  D: { letter: 'D', token: 'danger', label: 'Deleted' },
  U: { letter: 'U', token: 'info', label: 'Conflicted' },
};

/** Higher wins when rolling up mixed statuses into a directory. */
const ROLLUP_RANK: Record<FileTreeGitStatusCode, number> = { U: 4, M: 3, R: 3, A: 2, D: 1 };

export function gitStatusPresentation(code: FileTreeGitStatusCode): GitStatusPresentation {
  return PRESENTATION[code];
}

/** Combine two statuses by rollup precedence; `null` is clean. */
function combine(a: FileTreeGitStatus, b: FileTreeGitStatus): FileTreeGitStatus {
  if (a === null) return b;
  if (b === null) return a;
  return ROLLUP_RANK[a] >= ROLLUP_RANK[b] ? a : b;
}

/**
 * Given the raw file-level status map, compute the effective status for every
 * path including directory rollups. Directories with no changed descendant stay
 * absent from the result (treated as clean/`null` by callers).
 */
export function computeGitRollups(statusMap: FileTreeGitStatusMap | undefined): Map<string, FileTreeGitStatusCode> {
  const rolled = new Map<string, FileTreeGitStatusCode>();
  if (!statusMap) return rolled;

  for (const [rawPath, status] of Object.entries(statusMap)) {
    if (status !== null) {
      // Own status wins for the file/dir itself.
      const combined = combine(rolled.get(rawPath) ?? null, status);
      if (combined !== null) rolled.set(rawPath, combined);
      // Roll up into each ancestor directory.
      for (const anc of ancestorPaths(rawPath)) {
        const combinedAnc = combine(rolled.get(anc) ?? null, status);
        if (combinedAnc !== null) rolled.set(anc, combinedAnc);
      }
    }
  }
  return rolled;
}

/** Resolve one path's effective status from a precomputed rollup map. */
export function resolveGitStatus(rollups: Map<string, FileTreeGitStatusCode>, path: string): FileTreeGitStatusCode | null {
  return rollups.get(path) ?? null;
}

/**
 * The set of explicitly-ignored paths (`null` in the status map). These never
 * roll up a status but the render layer dims them, so they need their own set —
 * the rollup map drops `null` entries entirely.
 */
export function computeIgnoredPaths(statusMap: FileTreeGitStatusMap | undefined): Set<string> {
  const ignored = new Set<string>();
  if (!statusMap) return ignored;
  for (const [path, status] of Object.entries(statusMap)) if (status === null) ignored.add(path);
  return ignored;
}
