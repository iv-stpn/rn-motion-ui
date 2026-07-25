// Pure search resolution for the three filtering modes. RN-free + tested.
//
//  - `expand-matches`      — every row stays present; ancestors of matches are
//    force-expanded so matches are revealed. No rows removed.
//  - `collapse-non-matches`— every row stays present; only directories with a
//    descendant match are expanded (others collapse). No rows removed.
//  - `hide-non-matches`    — rows that neither match nor lie on the path to a
//    match are removed entirely (the only mode that changes the row count).

import type { FileTreeSearchMode } from './file-tree.types';
import { ancestorPaths, isDirectoryPath, leafName } from './file-tree-paths';

/** Result of resolving a query against the full canonical path set. */
export type SearchResolution = {
  /** Paths whose leaf name matched the query. */
  matches: Set<string>;
  /**
   * When non-null, only these paths render (hide-non-matches): the matches,
   * every ancestor on the way to them, and — for a matched directory — all of
   * its descendants so an opened match isn't hollow.
   */
  allowedPaths: Set<string> | null;
  /** Directories to force-expand so matches are visible. */
  forceExpand: Set<string>;
};

/** Case-insensitive leaf-name substring match. */
export function matchesQuery(path: string, needle: string): boolean {
  return leafName(path).toLowerCase().includes(needle.toLowerCase());
}

/**
 * Resolve a search query into the sets the projection needs. `allPaths` is the
 * canonical path set (files + directories, implicit ancestors included).
 */
export function resolveSearch(allPaths: Iterable<string>, query: string, mode: FileTreeSearchMode): SearchResolution {
  const needle = query.trim().toLowerCase();
  const empty: SearchResolution = { matches: new Set(), allowedPaths: null, forceExpand: new Set() };
  if (!needle) return empty;

  const all = Array.from(allPaths);
  const matches = new Set<string>();
  const forceExpand = new Set<string>();
  const matchedDirs: string[] = [];
  for (const path of all) {
    if (matchesQuery(path, needle)) {
      matches.add(path);
      if (isDirectoryPath(path)) matchedDirs.push(path);
      // Expand every ancestor so the match is reachable.
      for (const anc of ancestorPaths(path)) forceExpand.add(anc);
    }
  }

  if (mode !== 'hide-non-matches') return { matches, allowedPaths: null, forceExpand };

  // hide-non-matches: build the allowed set — matches + ancestors + descendants
  // of matched directories.
  const allowedPaths = new Set<string>(matches);
  for (const path of matches) for (const anc of ancestorPaths(path)) allowedPaths.add(anc);
  if (matchedDirs.length > 0) {
    for (const path of all) {
      for (const dir of matchedDirs) {
        if (path !== dir && path.startsWith(dir)) {
          allowedPaths.add(path);
          break;
        }
      }
    }
  }
  return { matches, allowedPaths, forceExpand };
}
