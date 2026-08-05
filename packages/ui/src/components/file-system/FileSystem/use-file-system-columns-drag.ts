/** biome-ignore-all lint/style/useExportsLast: types exported alongside the hook that uses them */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: session builder, helpers, and hook are one cohesive unit — splitting would scatter tightly coupled drag state */
// Cross-column drag session for FileSystemColumnsView.
//
// Architecture mirrors use-file-system-drag.ts: hot-path state lives in refs,
// one setState fires per visual event (drag start, target change, drag end).
// The session covers the entire horizontal ScrollView so pointer capture routes
// all pointermove/pointerup to the single container node, enabling drops onto
// any column regardless of which column the drag started in.
//
// Coordinate system: localX/localY from the pointer transport are relative to
// the outer container's visible viewport. Column resolution adds the horizontal
// scroll offset: columnIndex = floor((localX + hScrollOffset) / COLUMN_WIDTH).

import { type MutableRefObject, type RefObject, useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Platform, type View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import type { FileSystemEntry, FileSystemIndex, FileSystemMoveEvent } from './file-system.types';
import type { ColumnDragState } from './file-system-column';
import { COLUMN_WIDTH, columnRowHitAt } from './file-system-column';
import type { FileSystemRow } from './file-system-rows';
import type { FileSystemDragSession } from './use-file-system-drag';
import { isValidDropTarget, movableSources } from './use-file-system-drag';

const GHOST_OFFSET_X = 14;
const GHOST_OFFSET_Y = -10;

export type ColumnsDragRender = {
  active: boolean;
  previewLabel: string;
  draggedPaths: string[];
  /** Column the drag was lifted from. */
  sourceColumnIndex: number | null;
  sourceRowIndex: number | null;
  /** Column where the drop would land. */
  targetColumnIndex: number | null;
  /**
   * Non-null → a specific folder row is the drop target (row border outline).
   * Null + targetColumnIndex non-null → the whole column is the target (column ring).
   */
  targetRowIndex: number | null;
};

export type UseColumnsDragParams = {
  enabled: boolean;
  columnPaths: string[];
  index: FileSystemIndex;
  selectedPaths: ReadonlySet<string>;
  containerRef: RefObject<View | null>;
  containerHeightRef: MutableRefObject<number>;
  horizontalScrollOffsetRef: MutableRefObject<number>;
  /** Per-column vertical scroll offsets, indexed by column order. */
  columnScrollOffsetsRef: MutableRefObject<number[]>;
  onMove?: (event: FileSystemMoveEvent) => void;
};

export type UseColumnsDragReturn = {
  drag: ColumnsDragRender;
  session: FileSystemDragSession;
  previewPos: Animated.ValueXY;
  /** RNGH Gesture.Pan for native, `null` on web. */
  // biome-ignore lint/suspicious/noExplicitAny: RNGH types vary by version
  nativeGesture: any | null;
};

const NO_PATHS: string[] = [];
const IDLE_DRAG: ColumnsDragRender = {
  active: false,
  draggedPaths: NO_PATHS,
  previewLabel: '',
  sourceColumnIndex: null,
  sourceRowIndex: null,
  targetColumnIndex: null,
  targetRowIndex: null,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function toRow(entry: FileSystemEntry): FileSystemRow {
  return { entry, isExpandable: false, isExpanded: false, level: 0 };
}

/**
 * Source paths that can legitimately be moved to `colPath` (the column's root
 * folder). Mirrors `isValidDropTarget` but for a destination identified by path
 * rather than a row object — used for column-level drops.
 */
function movableSourcesForColumnPath(sourcePaths: string[], colPath: string, index: FileSystemIndex): string[] {
  return sourcePaths.filter((sp) => {
    const entry = index.files.get(sp) ?? index.folders.get(sp);
    if (!entry) return false;
    if (colPath === sp) return false;
    if (colPath === entry.parentPath) return false;
    if (entry.kind === 'folder' && colPath.startsWith(sp)) return false;
    return true;
  });
}

/** Wrap dragged paths as FileSystemRow objects for `isValidDropTarget` / `movableSources`. */
function asRows(sourcePaths: string[], index: FileSystemIndex): FileSystemRow[] {
  return sourcePaths.flatMap((p) => {
    const entry = index.files.get(p) ?? index.folders.get(p);
    return entry ? [toRow(entry)] : [];
  });
}

/**
 * Per-column drag state derived from the view-level `ColumnsDragRender` just
 * before rendering each `FileSystemColumn`.
 */
export function columnDragStateFor(colIdx: number, drag: ColumnsDragRender): ColumnDragState {
  if (!drag.active) return null;
  if (drag.sourceColumnIndex === colIdx)
    return drag.sourceRowIndex === null ? null : { kind: 'source', rowIndex: drag.sourceRowIndex };
  if (drag.targetColumnIndex !== colIdx) return null;
  if (drag.targetRowIndex !== null) return { kind: 'row-target', rowIndex: drag.targetRowIndex };
  return { kind: 'column-target' };
}

// ── Session builder ────────────────────────────────────────────────────────────

type SessionRefs = {
  columnPathsRef: RefObject<string[]>;
  indexRef: RefObject<FileSystemIndex>;
  selectedPathsRef: RefObject<ReadonlySet<string>>;
  onMoveRef: RefObject<((e: FileSystemMoveEvent) => void) | undefined>;
  horizontalScrollOffsetRef: MutableRefObject<number>;
  columnScrollOffsetsRef: MutableRefObject<number[]>;
  draggedPathsRef: MutableRefObject<string[]>;
  sourceColumnIndexRef: MutableRefObject<number | null>;
  sourceRowIndexRef: MutableRefObject<number | null>;
  targetColumnIndexRef: MutableRefObject<number | null>;
  targetRowIndexRef: MutableRefObject<number | null>;
  isDraggingRef: MutableRefObject<boolean>;
  previewPos: Animated.ValueXY;
  setDrag: (updater: (prev: ColumnsDragRender) => ColumnsDragRender) => void;
  setDragDirect: (next: ColumnsDragRender) => void;
};

function resolveColumnIndex(localX: number, hOffset: number, columnCount: number): number {
  return Math.max(0, Math.min(Math.floor((localX + hOffset) / COLUMN_WIDTH), columnCount - 1));
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: begin/move/finish share refs — extracting would scatter them
function buildColumnsSession(refs: SessionRefs): FileSystemDragSession {
  const {
    columnPathsRef,
    indexRef,
    selectedPathsRef,
    onMoveRef,
    horizontalScrollOffsetRef,
    columnScrollOffsetsRef,
    draggedPathsRef,
    sourceColumnIndexRef,
    sourceRowIndexRef,
    targetColumnIndexRef,
    targetRowIndexRef,
    isDraggingRef,
    previewPos,
    setDrag,
    setDragDirect,
  } = refs;

  return {
    begin(localX, localY) {
      const columnPaths = columnPathsRef.current ?? [];
      if (!columnPaths.length) return false;
      const colIdx = resolveColumnIndex(localX, horizontalScrollOffsetRef.current, columnPaths.length);
      const colPath = columnPaths[colIdx];
      if (colPath === undefined) return false;
      const index = indexRef.current;
      if (!index) return false;
      const entries = index.children.get(colPath) ?? [];
      const vOffset = columnScrollOffsetsRef.current[colIdx] ?? 0;
      const rowIdx = columnRowHitAt(0, localY, vOffset, entries.length);
      if (rowIdx === null) return false;
      const entry = entries[rowIdx];
      if (!entry) return false;
      const sel = selectedPathsRef.current;
      if (!sel) return false;
      const sources = sel.size > 1 && sel.has(entry.path) ? [...sel] : [entry.path];
      draggedPathsRef.current = sources;
      sourceColumnIndexRef.current = colIdx;
      sourceRowIndexRef.current = rowIdx;
      targetColumnIndexRef.current = null;
      targetRowIndexRef.current = null;
      isDraggingRef.current = true;
      previewPos.setValue({ x: localX + GHOST_OFFSET_X, y: localY + GHOST_OFFSET_Y });
      const previewLabel = sources.length > 1 ? `${sources.length} items` : entry.name;
      setDragDirect({
        active: true,
        draggedPaths: sources,
        previewLabel,
        sourceColumnIndex: colIdx,
        sourceRowIndex: rowIdx,
        targetColumnIndex: null,
        targetRowIndex: null,
      });
      return true;
    },

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: move resolves column + row target in one pass to avoid double iteration — extracting helpers would require threading multiple refs through extra call frames
    move(localX, localY) {
      if (!isDraggingRef.current) return;
      previewPos.setValue({ x: localX + GHOST_OFFSET_X, y: localY + GHOST_OFFSET_Y });
      const columnPaths = columnPathsRef.current ?? [];
      const colIdx = resolveColumnIndex(localX, horizontalScrollOffsetRef.current, columnPaths.length);
      const colPath = columnPaths[colIdx];
      if (colPath === undefined) return;
      const index = indexRef.current;
      if (!index) return;
      const entries = index.children.get(colPath) ?? [];
      const vOffset = columnScrollOffsetsRef.current[colIdx] ?? 0;
      const rowIdx = columnRowHitAt(0, localY, vOffset, entries.length);
      const draggedPaths = draggedPathsRef.current;
      let newColIdx: number | null = null;
      let newRowIdx: number | null = null;
      if (rowIdx !== null) {
        const entry = entries[rowIdx];
        if (entry) {
          const targetRow = toRow(entry);
          const sRows = asRows(draggedPaths, index);
          const anyValid = sRows.some((sr) => isValidDropTarget(sr, targetRow));
          if (anyValid) {
            newColIdx = colIdx;
            newRowIdx = rowIdx;
          } else if (movableSourcesForColumnPath(draggedPaths, colPath, index).length > 0) newColIdx = colIdx;
        }
      } else if (movableSourcesForColumnPath(draggedPaths, colPath, index).length > 0) newColIdx = colIdx;
      if (newColIdx !== targetColumnIndexRef.current || newRowIdx !== targetRowIndexRef.current) {
        targetColumnIndexRef.current = newColIdx;
        targetRowIndexRef.current = newRowIdx;
        setDrag((prev) => ({ ...prev, targetColumnIndex: newColIdx, targetRowIndex: newRowIdx }));
      }
    },

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: move resolves column + row target in one pass to avoid double iteration; finish branches on row-target vs column-target — both share the same reset tail — extracting would scatter the reset logic that always runs after it
    finish(commit) {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      const colIdx = targetColumnIndexRef.current;
      const rowIdx = targetRowIndexRef.current;
      if (commit && colIdx !== null) {
        const columnPaths = columnPathsRef.current ?? [];
        const colPath = columnPaths[colIdx];
        const index = indexRef.current;
        const draggedPaths = draggedPathsRef.current;
        if (!index) {
          /* ref always set; guard for type safety */
        }
        if (colPath !== undefined) {
          if (rowIdx === null) {
            const sources = movableSourcesForColumnPath(draggedPaths, colPath, index);
            if (sources.length > 0) onMoveRef.current?.({ destination: colPath, sources });
          } else {
            const entry = (index.children.get(colPath) ?? [])[rowIdx];
            if (entry) {
              const sRows = asRows(draggedPaths, index);
              const sources = movableSources(draggedPaths, sRows, toRow(entry));
              if (sources.length > 0) onMoveRef.current?.({ destination: entry.path, sources });
            }
          }
        }
      }
      draggedPathsRef.current = NO_PATHS;
      sourceColumnIndexRef.current = null;
      sourceRowIndexRef.current = null;
      targetColumnIndexRef.current = null;
      targetRowIndexRef.current = null;
      setDragDirect(IDLE_DRAG);
    },

    isActive: () => isDraggingRef.current,
    getTargetIndex: () => null, // hover is driven per-column by dragState, not this session
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/** Coordinate pair from RNGH gesture events. */
type GesturePoint = { x: number; y: number };

export function useFileSystemColumnsDrag({
  enabled,
  columnPaths,
  index,
  selectedPaths,
  containerRef: _containerRef,
  containerHeightRef: _containerHeightRef,
  horizontalScrollOffsetRef,
  columnScrollOffsetsRef,
  onMove,
}: UseColumnsDragParams): UseColumnsDragReturn {
  // biome-ignore lint/plugin: useRef<T>(val) coerced to RefObject to match session param types
  const columnPathsRef = useRef(columnPaths) as RefObject<string[]>;
  columnPathsRef.current = columnPaths;
  // biome-ignore lint/plugin: same — coerce MutableRefObject to RefObject
  const indexRef = useRef(index) as RefObject<FileSystemIndex>;
  indexRef.current = index;
  // biome-ignore lint/plugin: same
  const selectedPathsRef = useRef(selectedPaths) as RefObject<ReadonlySet<string>>;
  selectedPathsRef.current = selectedPaths;
  // biome-ignore lint/plugin: same
  const onMoveRef = useRef(onMove) as RefObject<((e: FileSystemMoveEvent) => void) | undefined>;
  onMoveRef.current = onMove;

  const draggedPathsRef = useRef<string[]>(NO_PATHS);
  const sourceColumnIndexRef = useRef<number | null>(null);
  const sourceRowIndexRef = useRef<number | null>(null);
  const targetColumnIndexRef = useRef<number | null>(null);
  const targetRowIndexRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const previewPos = useRef(new Animated.ValueXY()).current;

  const [drag, setDrag] = useState<ColumnsDragRender>(IDLE_DRAG);
  const setDragDirect = useCallback((next: ColumnsDragRender) => setDrag(() => next), []);

  const session = useMemo(
    () =>
      buildColumnsSession({
        columnPathsRef,
        indexRef,
        selectedPathsRef,
        onMoveRef,
        horizontalScrollOffsetRef,
        columnScrollOffsetsRef,
        draggedPathsRef,
        sourceColumnIndexRef,
        sourceRowIndexRef,
        targetColumnIndexRef,
        targetRowIndexRef,
        isDraggingRef,
        previewPos,
        setDrag,
        setDragDirect,
      }),
    // All deps are stable refs — this memo fires exactly once.
    [columnScrollOffsetsRef, horizontalScrollOffsetRef, previewPos, setDragDirect],
  );

  const nativeGesture = useMemo(() => {
    if (Platform.OS === 'web' || !enabled) return null;
    return Gesture.Pan()
      .activateAfterLongPress(300)
      .runOnJS(true)
      .onStart(({ x, y }: GesturePoint) => session.begin(x, y))
      .onUpdate(({ x, y }: GesturePoint) => session.move(x, y))
      .onEnd(() => session.finish(true))
      .onFinalize(() => {
        if (session.isActive()) session.finish(false);
      });
  }, [enabled, session]);

  return { drag, session, previewPos, nativeGesture };
}
