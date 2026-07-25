// Pure drag-and-drop resolution over canonical paths. The gesture layer (Phase
// 6) only feeds coordinates and the hovered row; every "what does this move
// mean" decision lives here so it can be unit-tested without gestures.

import { isDirectoryPath, isSelfOrDescendant, leafName, parentPath } from './file-tree-paths';

export type DropOperation = { from: string; to: string };

export type DropResolution = {
  /** The directory the dragged paths land in ('' = top level). */
  destination: string;
  /** Concrete from→to moves (no-op moves already filtered out). */
  operations: DropOperation[];
  /** old→new remap for every moved path AND its descendants. */
  remap: Map<string, string>;
};

/**
 * Collapse a dragged selection so that when a directory and something inside it
 * are both selected, only the ancestor is carried (its descendants move with
 * it). Keeps input order minus the redundant descendants.
 */
export function normalizeDraggedPaths(paths: Iterable<string>): string[] {
  const list = [...paths];
  return list.filter((path) => !list.some((other) => other !== path && isSelfOrDescendant(path, other)));
}

/**
 * Decide what actually gets dragged when a drag begins on `row`. If the row is
 * part of the current selection, the whole (normalized) selection moves;
 * otherwise just the row.
 */
export function resolveDraggedPathsForStart(row: string, selected: Set<string>): string[] {
  if (selected.has(row) && selected.size > 1) return normalizeDraggedPaths(selected);
  return [row];
}

/**
 * Resolve the destination directory for a drop onto `targetPath`. Dropping onto
 * a file targets that file's parent directory; dropping onto a directory targets
 * the directory itself. `null` target means the top-level root ('').
 */
export function resolveMoveDestinationPath(targetPath: string | null): string {
  if (!targetPath) return '';
  return isDirectoryPath(targetPath) ? targetPath : parentPath(targetPath);
}

/**
 * True when dropping `dragged` into `destination` is illegal: a directory cannot
 * be dropped into itself or any of its own descendants.
 */
export function isSelfOrDescendantDrop(dragged: string[], destination: string): boolean {
  return dragged.some((path) => isSelfOrDescendant(destination, path));
}

/**
 * Build the full set of move operations for dropping `draggedInput` into the
 * directory resolved from `targetPath`. Returns `null` when the drop is illegal
 * (into itself/descendant) or a pure no-op (everything already lives there).
 */
export function buildDropOperations(
  allPaths: Iterable<string>,
  draggedInput: Iterable<string>,
  targetPath: string | null,
): DropResolution | null {
  const dragged = normalizeDraggedPaths(draggedInput);
  if (dragged.length === 0) return null;
  const destination = resolveMoveDestinationPath(targetPath);
  if (isSelfOrDescendantDrop(dragged, destination)) return null;

  const remap = new Map<string, string>();
  const operations: DropOperation[] = [];
  const all = [...allPaths];

  for (const src of dragged) {
    // Skip if already directly inside the destination (no-op move).
    if (parentPath(src) !== destination) {
      const isDir = isDirectoryPath(src);
      const name = leafName(src);
      const to = isDir ? `${destination}${name}/` : `${destination}${name}`;
      operations.push({ from: src, to });
      remap.set(src, to);
      if (isDir) {
        for (const path of all) {
          if (path !== src && path.startsWith(src)) remap.set(path, `${to}${path.slice(src.length)}`);
        }
      }
    }
  }

  if (operations.length === 0) return null;
  return { destination, operations, remap };
}

/** Apply a resolved drop's remap to the full path list, returning new paths. */
export function applyDropToPaths(allPaths: Iterable<string>, remap: Map<string, string>): string[] {
  return [...allPaths].map((path) => remap.get(path) ?? path);
}
