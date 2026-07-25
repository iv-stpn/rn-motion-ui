// Pure composition of search + projection into the final visible-row list.
// Given the structural tree and the current UI state, resolve the active search
// (if any) into the expansion/filter sets the projection needs, then project.
// Kept separate from the controller so the "what renders" decision is a pure,
// independently-tested function.

import type { FileTreeSearchMode, FileTreeVisibleRow } from './file-tree.types';
import { projectVisibleRows } from './file-tree-project';
import { resolveSearch } from './file-tree-search';
import type { TreeNode } from './file-tree-tree';

export type ComputeVisibleRowsParams = {
  roots: TreeNode[];
  /** Canonical paths including implicit ancestor directories (search domain). */
  allPaths: Iterable<string>;
  /** Directories the user has expanded. */
  expanded: Set<string>;
  selected: Set<string>;
  focusedPath: string | null;
  flatten: boolean;
  searchQuery: string;
  searchMode: FileTreeSearchMode;
};

/**
 * Fold the search resolution into the projection. The three search modes map to
 * projection inputs like so:
 *  - no query            → user expansion, no filter.
 *  - expand-matches      → user expansion ∪ match ancestors, no filter.
 *  - collapse-non-matches→ ONLY match ancestors expanded, no filter.
 *  - hide-non-matches    → force-expand everything, filter to allowed paths.
 */
export function computeVisibleRows(params: ComputeVisibleRowsParams): FileTreeVisibleRow[] {
  const { roots, allPaths, expanded, selected, focusedPath, flatten, searchQuery, searchMode } = params;
  const search = resolveSearch(allPaths, searchQuery, searchMode);
  const active = search.matches.size > 0 || searchQuery.trim().length > 0;

  if (!active) return projectVisibleRows({ roots, expanded, selected, focusedPath, flatten });

  if (searchMode === 'hide-non-matches')
    return projectVisibleRows({
      roots,
      expanded,
      selected,
      focusedPath,
      flatten,
      allowedPaths: search.allowedPaths,
      forceExpand: true,
    });

  // expand-matches keeps the user's expansion and adds the match ancestors;
  // collapse-non-matches replaces it with only the match ancestors.
  const effectiveExpanded = searchMode === 'expand-matches' ? new Set([...expanded, ...search.forceExpand]) : search.forceExpand;
  return projectVisibleRows({ roots, expanded: effectiveExpanded, selected, focusedPath, flatten });
}
