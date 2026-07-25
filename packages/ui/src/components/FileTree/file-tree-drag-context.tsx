/** biome-ignore-all lint/style/useComponentExportOnlyModules: the provider and its reader are one unit — a context is useless without both */
// What the live drag is, for the rows that have to stop reacting to the pointer
// while one is running.
//
// Rows own their own hover state, driven by RNW's onHoverIn/onHoverOut — which
// are pointerenter/pointerleave underneath. The web transport takes
// setPointerCapture on the scroll container for the length of a drag, and a
// captured pointer no longer generates boundary events against the rows: the row
// the drag was lifted from keeps the hover it had at press time, and no row the
// drag passes over ever gets one. The result is a highlight stuck at the origin
// while the drop outline moves — two marks, neither of them where the drop is.
//
// So a row stops reading its own hover for the length of the drag and takes the
// answer from here instead: the rows being dragged hold the tint (they are still
// the active ones — the drag came from them), and every other row drops it. The
// drop target is marked separately by the scroll body's outline, so the two
// questions — where this came from, where it is going — never share a mark.
//
// Context rather than a prop because the row renderer is built in file-tree.tsx
// while the drag lives in the scroll body, so the value has to reach the rows
// past it. It changes twice per drag — at start and at release — so the
// re-render it costs every row is not on the pointer path.

import { createContext, type ReactNode, useContext, useMemo } from 'react';

/** The dragged paths while a drag is live; `null` when none is. */
const FileTreeDragContext = createContext<ReadonlySet<string> | null>(null);

/** True while a drag is in flight anywhere in this tree. */
export function useFileTreeDragActive(): boolean {
  return useContext(FileTreeDragContext) !== null;
}

/**
 * Whether `path` is one of the rows this drag lifted. False when no drag is
 * live, so a row can ask unconditionally.
 */
export function useFileTreeIsDragSource(path: string): boolean {
  return useContext(FileTreeDragContext)?.has(path) ?? false;
}

export type FileTreeDragActiveProviderProps = { active: boolean; draggedPaths: readonly string[]; children: ReactNode };

export function FileTreeDragActiveProvider({ active, draggedPaths, children }: FileTreeDragActiveProviderProps) {
  // Rebuilt only when the drag flips or its path set is replaced, both of which
  // happen once per drag — never on the pointer path.
  const value = useMemo(() => (active ? new Set(draggedPaths) : null), [active, draggedPaths]);
  return <FileTreeDragContext.Provider value={value}>{children}</FileTreeDragContext.Provider>;
}
