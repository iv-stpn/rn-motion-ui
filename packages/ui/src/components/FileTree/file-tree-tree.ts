/** biome-ignore-all lint/style/useExportsLast: exports and defines multiple utils */
// Pure tree building + projection. Turns a flat set of canonical paths into a
// nested node tree, then flattens single-child directory chains and walks the
// expanded structure in DFS preorder to produce the renderable visible rows.
// RN-free so it can be unit-tested in jsdom.

import type { FileTreeKind } from './file-tree.types';
import { ancestorPaths, canonicalizePath, comparePaths, kindOfPath, leafName, parentPath, pathSegments } from './file-tree-paths';

/** A node in the structural tree (built once per canonical path set). */
export type TreeNode = {
  path: string;
  name: string;
  kind: FileTreeKind;
  /** Structural depth in the original tree (0 = top-level). */
  depth: number;
  children: TreeNode[];
};

/**
 * Build a sorted node tree from a set of canonical paths. Missing ancestor
 * directories are materialized implicitly (a file `a/b/c.ts` creates `a/` and
 * `a/b/` even if they weren't listed). Children are sorted dirs-before-files,
 * natural-order case-insensitive.
 */
export function buildTree(paths: Iterable<string>): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  const ensure = (path: string): TreeNode => {
    let node = nodes.get(path);
    if (!node) {
      node = { path, name: leafName(path), kind: kindOfPath(path), depth: pathSegments(path).length - 1, children: [] };
      nodes.set(path, node);
    }
    return node;
  };
  for (const raw of paths) {
    const path = canonicalizePath(raw);
    if (path) {
      ensure(path);
      for (const anc of ancestorPaths(path)) ensure(anc);
    }
  }
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = parentPath(node.path);
    if (parent === '') roots.push(node);
    else nodes.get(parent)?.children.push(node);
  }
  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => comparePaths(a.path, b.path));
    for (const n of list) if (n.children.length > 0) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

/**
 * Resolve the flattened chain starting at `node`. When `flatten` is on and the
 * node is a directory whose only child is itself a directory, the chain is
 * collapsed: successive single-directory-child folders merge into one row whose
 * terminal node owns the rendered children. Returns the terminal node plus the
 * ordered collapsed segment names (length 1 when nothing was flattened).
 */
type FlattenedChain = { terminal: TreeNode; segments: string[] };
export function resolveFlattenedChain(node: TreeNode, flatten: boolean): FlattenedChain {
  let terminal = node;
  const segments = [node.name];
  if (!flatten || node.kind !== 'directory') return { terminal, segments };
  while (terminal.children.length === 1) {
    const only = terminal.children[0];
    if (only?.kind !== 'directory') break;
    terminal = only;
    segments.push(only.name);
  }
  return { terminal, segments };
}
