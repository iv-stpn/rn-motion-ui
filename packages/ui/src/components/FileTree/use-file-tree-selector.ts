// React bindings over the FileTreeController's subscribe/getVersion pair. A
// single generic selector hook (a hand-rolled useSyncExternalStoreWithSelector)
// lets components subscribe to just the slice they render, re-rendering only
// when that slice actually changes. Concrete selectors sit on top.

import { useCallback, useDebugValue, useMemo, useRef, useSyncExternalStore } from 'react';
import type { FileTreeDensity, FileTreeSearchMode, FileTreeSelectionMode, FileTreeVisibleRow } from './file-tree.types';
import type { FileTreeController } from './file-tree-controller';

/** Reference-stable shallow equality for arrays. */
function shallowArrayEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Subscribe to a derived slice of the controller. `selector` is re-run on every
 * store change; when `isEqual` (default `Object.is`) reports the new value equal
 * to the last, the previous reference is kept so React can bail out of the
 * re-render. This mirrors useSyncExternalStoreWithSelector without the extra dep.
 */
export function useFileTreeSelector<T>(
  controller: FileTreeController,
  selector: (controller: FileTreeController) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const lastRef = useRef<{ value: T } | null>(null);

  const getSnapshot = useCallback((): T => {
    const next = selector(controller);
    const last = lastRef.current;
    if (last && isEqual(last.value, next)) return last.value;
    lastRef.current = { value: next };
    return next;
  }, [controller, selector, isEqual]);

  const value = useSyncExternalStore(controller.subscribe, getSnapshot, getSnapshot);
  useDebugValue(value);
  return value;
}

/** The projected visible rows (memoized by the controller per version). */
export function useFileTreeRows(controller: FileTreeController): FileTreeVisibleRow[] {
  return useFileTreeSelector(controller, (c) => c.getVisibleRows());
}

/** The selected paths as a Set (rebuilt only when the selection changes). */
export function useFileTreeSelection(controller: FileTreeController): Set<string> {
  const selector = useCallback((c: FileTreeController) => c.getSelectedPaths(), []);
  const paths = useFileTreeSelector(controller, selector, shallowArrayEqual);
  return useMemo(() => new Set(paths), [paths]);
}

/** The currently focused path (or null). */
export function useFileTreeFocus(controller: FileTreeController): string | null {
  return useFileTreeSelector(controller, (c) => c.getFocusedPath());
}

/** The expanded directory paths as a Set. */
export function useFileTreeExpanded(controller: FileTreeController): Set<string> {
  const selector = useCallback((c: FileTreeController) => c.getExpandedPaths(), []);
  const paths = useFileTreeSelector(controller, selector, shallowArrayEqual);
  return useMemo(() => new Set(paths), [paths]);
}

/** The active search query + mode. */
export type FileTreeSearch = { query: string; mode: FileTreeSearchMode };
export function useFileTreeSearch(controller: FileTreeController): FileTreeSearch {
  const query = useFileTreeSelector(controller, (c) => c.getSearchQuery());
  const mode = useFileTreeSelector(controller, (c) => c.getSearchMode());
  return useMemo(() => ({ query, mode }), [query, mode]);
}

/** The current density preset. */
export function useFileTreeDensity(controller: FileTreeController): FileTreeDensity {
  return useFileTreeSelector(controller, (c) => c.getDensity());
}

/** The current selection mode. */
export function useFileTreeSelectionMode(controller: FileTreeController): FileTreeSelectionMode {
  return useFileTreeSelector(controller, (c) => c.getSelectionMode());
}

/** Whether empty-directory flattening is on. */
export function useFileTreeFlatten(controller: FileTreeController): boolean {
  return useFileTreeSelector(controller, (c) => c.getFlatten());
}
