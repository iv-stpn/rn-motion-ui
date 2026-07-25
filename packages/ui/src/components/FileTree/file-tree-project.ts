// DFS preorder projection: walk the expanded (and optionally search-filtered)
// tree and emit one FileTreeVisibleRow per rendered line. Pure + RN-free.

import type { FileTreeVisibleRow } from './file-tree.types';
import { ancestorPaths } from './file-tree-paths';
import { resolveFlattenedChain, type TreeNode } from './file-tree-tree';

export type ProjectionOptions = {
  roots: TreeNode[];
  /** Terminal directory paths the user has expanded. */
  expanded: Set<string>;
  /** Selected canonical paths. */
  selected: Set<string>;
  /** Roving-focus path, or null. */
  focusedPath: string | null;
  /** Collapse single-child directory chains into one row. */
  flatten: boolean;
  /** When set, only paths in this set are rendered (hide-non-matches search). */
  allowedPaths?: Set<string> | null;
  /** Treat every directory as expanded (used with a search filter). */
  forceExpand?: boolean;
};

/** Project the tree into the flat, ordered list the FlatList renders. */
export function projectVisibleRows(opts: ProjectionOptions): FileTreeVisibleRow[] {
  const { roots, expanded, selected, focusedPath, flatten, allowedPaths = null, forceExpand = false } = opts;
  const rows: FileTreeVisibleRow[] = [];

  const visit = (siblings: TreeNode[], level: number) => {
    const shown = allowedPaths ? siblings.filter((n) => allowedPaths.has(n.path)) : siblings;
    const setSize = shown.length;
    for (let posInSet = 0; posInSet < shown.length; posInSet += 1) {
      const node = shown[posInSet];
      if (node) {
        const { terminal, segments } = resolveFlattenedChain(node, flatten);
        const hasChildren = terminal.children.length > 0;
        const isExpanded = hasChildren && (forceExpand || expanded.has(terminal.path));
        rows.push({
          path: terminal.path,
          name: segments.join('/'),
          kind: terminal.kind,
          ancestorPaths: ancestorPaths(node.path),
          depth: node.depth,
          level,
          hasChildren,
          isExpanded,
          isFlattened: segments.length > 1,
          flattenedSegments: segments.length > 1 ? segments : undefined,
          index: rows.length,
          posInSet,
          setSize,
          isFocused: focusedPath === terminal.path,
          isSelected: selected.has(terminal.path),
        });
        if (isExpanded) visit(terminal.children, level + 1);
      }
    }
  };

  visit(roots, 0);
  return rows;
}
