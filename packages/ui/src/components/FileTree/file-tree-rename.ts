// Pure rename over the canonical path set. Renaming a directory rewrites every
// descendant path; renaming a file rewrites just that entry. Returns the new
// path list plus an old→new remap so the controller can carry expansion,
// selection, and focus across the edit. RN-free + tested.

import { isDirectoryPath, leafName, parentPath } from './file-tree-paths';

export type RenameResult = {
  /** The full canonical path set after the rename. */
  paths: string[];
  /** old canonical path → new canonical path (only the entries that moved). */
  remap: Map<string, string>;
  /** The renamed entry's own new canonical path. */
  newPath: string;
};

/** Validate a proposed leaf name. Empty or slash-bearing names are rejected. */
export function isValidLeafName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && !trimmed.includes('/');
}

/**
 * Rename the entry at `target` to the new leaf `nextName`, preserving kind
 * (directory paths keep their trailing slash). For a directory, every path that
 * is the directory itself or nested beneath it is rewritten under the new name.
 *
 * `nextName` is the new leaf only (no slashes) — parent location is unchanged.
 * Returns `null` when the name is invalid or unchanged.
 */
export function renameFileTreePaths(paths: Iterable<string>, target: string, nextName: string): RenameResult | null {
  const trimmed = nextName.trim();
  if (!isValidLeafName(trimmed)) return null;
  if (trimmed === leafName(target)) return null;

  const isDir = isDirectoryPath(target);
  const parent = parentPath(target); // '' for top-level, else 'a/b/'
  const newPath = isDir ? `${parent}${trimmed}/` : `${parent}${trimmed}`;

  const remap = new Map<string, string>();
  const out: string[] = [];
  for (const path of paths) {
    if (path === target) {
      remap.set(path, newPath);
      out.push(newPath);
    } else if (isDir && path.startsWith(target)) {
      // Descendant of the renamed directory: swap the shared prefix.
      const suffix = path.slice(target.length);
      const moved = `${newPath}${suffix}`;
      remap.set(path, moved);
      out.push(moved);
    } else out.push(path);
  }
  return { paths: out, remap, newPath };
}

/** Remap a set of paths through a rename's old→new map (unmoved paths kept). */
export function remapPathSet(set: Set<string>, remap: Map<string, string>): Set<string> {
  if (remap.size === 0) return new Set(set);
  const next = new Set<string>();
  for (const path of set) next.add(remap.get(path) ?? path);
  return next;
}
