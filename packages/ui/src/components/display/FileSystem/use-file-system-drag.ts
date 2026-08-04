/** biome-ignore-all lint/style/useExportsLast: constants exported alongside the types they configure */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the session, its refs and the hook that owns them are one unit — the pointer path reads all three */

// Drag-and-drop session for FileSystem views.
//
// Architecture: hot-path drag state lives in refs so the
// pointer-move path causes zero React re-renders. One setState fires per
// visual event — drag start, folder boundary crossing, drag end.
//
// Platform split:
//  - Web:    pointer-capture transport in use-file-system-drag-web.ts
//  - Native: RNGH Gesture.Pan below, activated after 300ms long-press
//
// Entry index resolution is parameterized via `toEntryIndex` so both the list
// view (row-based, 1-D) and the icons view (tile-based, 2-D) can share this
// session without duplicating the commit/cancel logic.

import { type MutableRefObject, type RefObject, useCallback, useMemo, useRef, useState } from 'react';
import { Animated, type FlatList, Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import type { FileSystemMoveEvent } from './file-system.types';
import type { FileSystemRow } from './file-system-rows';

/** Row height in the list view — import this in the view instead of re-defining it. */
export const FS_ROW_HEIGHT = 30;

/**
 * The nodes the web transport listens on, one per draggable view. Fixed rather
 * than props: a drag test has to dispatch its pointer stream at this exact
 * element — pointer capture only works for a pointer the browser considers
 * active on it — and there is one per view, so there is nothing for a consumer
 * to disambiguate.
 */
export const FS_DRAG_CONTAINER_TEST_ID = {
  column: 'file-system-column-drag-container',
  icons: 'file-system-icons-drag-container',
  list: 'file-system-list-drag-container',
};

const GHOST_OFFSET_X = 14;
const GHOST_OFFSET_Y = -10;
const SCROLL_ZONE = 36;
const SCROLL_STEP = 6;
const SCROLL_INTERVAL_MS = 16;

export type FileSystemDragSession = {
  begin: (localX: number, localY: number) => boolean;
  move: (localX: number, localY: number) => void;
  finish: (commit: boolean) => void;
  isActive: () => boolean;
  /**
   * The flat index a drop would commit to, live off the ref rather than render
   * state. The hover highlight reads it on the pointer path — one pointermove
   * updates the target and re-resolves the highlight in the same tick, so the
   * two can never disagree by a frame.
   */
  getTargetIndex: () => number | null;
};

/** A point in the container-local frame — the grabbed element's top-left corner. */
export type FileSystemGrabAnchor = { x: number; y: number };

export type FileSystemDragRender = {
  active: boolean;
  previewLabel: string;
  targetIndex: number | null;
  /** Flat index of the entry the drag was lifted from, so a view can render it as a ghost. */
  draggedIndex: number | null;
  /** Every path the drag carries — the lifted one alone, or the selection it belongs to. */
  draggedPaths: string[];
};

const NO_PATHS: string[] = [];
const IDLE_DRAG: FileSystemDragRender = {
  active: false,
  draggedIndex: null,
  draggedPaths: NO_PATHS,
  previewLabel: '',
  targetIndex: null,
};

export type UseFileSystemDragParams = {
  enabled: boolean;
  rows: FileSystemRow[];
  scrollOffsetRef: MutableRefObject<number>;
  containerHeightRef: MutableRefObject<number>;
  flatListRef: RefObject<FlatList | null>;
  onMove?: (event: FileSystemMoveEvent) => void;
  /**
   * Map a container-local pointer position to a flat entry index.
   * Defaults to the list-view formula: `Math.floor((y + scrollOffset) / FS_ROW_HEIGHT)`.
   * Override for 2-D layouts (e.g. the icons grid).
   */
  toEntryIndex?: (localX: number, localY: number) => number;
  /**
   * The list's content-container top padding, subtracted by the default
   * resolver. Without it every row boundary sits `contentOffsetTop` px above
   * where the pointer actually resolves it.
   */
  contentOffsetTop?: number;
  /**
   * Top-left corner of the element under `(localX, localY)`, container-local.
   * Given one, the ghost is offset by where inside the element the grab landed,
   * so it stays pinned under the pointer the way an OS drag image does. Without
   * one the ghost trails the pointer by a fixed offset (the list-view chip).
   */
  getGrabAnchor?: (localX: number, localY: number) => FileSystemGrabAnchor | null;
  /**
   * Every path this drag carries, given the one it was lifted from — see
   * {@link useDragSources}. Defaults to the lifted path alone.
   */
  getDragSources?: (draggedPath: string) => string[];
  /**
   * Whether a lift may start at this container-local point. `toEntryIndex`
   * clamps to the nearest entry — which is what a *drop* wants — so without this
   * a press in the grid's padding would lift whichever tile happened to be
   * nearest. It is also what keeps the drag and the selection box exclusive:
   * one starts exactly where the other refuses. Defaults to always.
   */
  canBeginAt?: (localX: number, localY: number) => boolean;
};

export type UseFileSystemDragReturn = {
  /** The session object — pass to the web transport hook. */
  session: FileSystemDragSession;
  /** Drives the ghost chip's Animated.View transform. */
  previewPos: Animated.ValueXY;
  /** Render state for the list view overlay. */
  drag: FileSystemDragRender;
  /** RNGH Gesture.Pan for native, `null` on web. */
  // biome-ignore lint/suspicious/noExplicitAny: RNGH types vary by version
  nativeGesture: any | null;
};

type PanGestureEvent = { x: number; y: number };

// ── Session builder ────────────────────────────────────────────────────────────
// Extracted so useFileSystemDrag itself stays under the 100-line limit.

type SessionRefs = {
  rowsRef: RefObject<FileSystemRow[]>;
  onMoveRef: RefObject<((event: FileSystemMoveEvent) => void) | undefined>;
  draggedIndexRef: MutableRefObject<number | null>;
  /** Resolved once at `begin` — the selection can move under a drag it started. */
  draggedPathsRef: MutableRefObject<string[]>;
  getDragSources: (draggedPath: string) => string[];
  canBeginAt: (localX: number, localY: number) => boolean;
  targetIndexRef: MutableRefObject<number | null>;
  isDraggingRef: MutableRefObject<boolean>;
  /** Where inside the grabbed element the press landed — see moveGhost. */
  grabOffsetRef: MutableRefObject<FileSystemGrabAnchor | null>;
  scrollTimerRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
  scrollOffsetRef: MutableRefObject<number>;
  containerHeightRef: MutableRefObject<number>;
  flatListRef: RefObject<FlatList | null>;
  previewPos: Animated.ValueXY;
  toEntryIndex: (localX: number, localY: number) => number;
  getGrabAnchor: (localX: number, localY: number) => FileSystemGrabAnchor | null;
  setDrag: (updater: (prev: FileSystemDragRender) => FileSystemDragRender) => void;
  setDragDirect: (next: FileSystemDragRender) => void;
};

/**
 * Whether dropping `source` onto `target` is a move at all. Three cases are not:
 * the row onto itself, a row onto the folder it already sits in, and a folder
 * onto anything inside its own subtree — the last one would reparent a folder
 * under its own child. Only folders can receive a drop.
 */
export function isValidDropTarget(source: FileSystemRow | undefined, target: FileSystemRow | undefined): boolean {
  if (!source || target?.entry.kind !== 'folder') return false;
  const sourcePath = source.entry.path;
  const targetPath = target.entry.path;
  if (targetPath === sourcePath || targetPath === source.entry.parentPath) return false;
  // Folder paths carry a trailing slash, so a prefix test is a subtree test.
  return !(source.entry.kind === 'folder' && targetPath.startsWith(sourcePath));
}

/**
 * The paths a drop onto `target` would actually move, out of everything the
 * drag carries. Each is re-checked against the destination on its own: a
 * multi-selection can hold entries the destination is already the parent of, or
 * a folder the destination lives inside, and those are not moves.
 */
export function movableSources(sourcePaths: string[], rows: FileSystemRow[], target: FileSystemRow): string[] {
  const byPath = new Map(rows.map((row) => [row.entry.path, row]));
  return sourcePaths.filter((path) => isValidDropTarget(byPath.get(path), target));
}

function buildDragSession(refs: SessionRefs): FileSystemDragSession {
  const {
    rowsRef,
    onMoveRef,
    draggedIndexRef,
    draggedPathsRef,
    getDragSources,
    canBeginAt,
    targetIndexRef,
    isDraggingRef,
    grabOffsetRef,
    scrollTimerRef,
    scrollOffsetRef,
    containerHeightRef,
    flatListRef,
    previewPos,
    toEntryIndex,
    getGrabAnchor,
    setDrag,
    setDragDirect,
  } = refs;

  function stopAutoScroll() {
    if (scrollTimerRef.current === null) return;
    clearInterval(scrollTimerRef.current);
    scrollTimerRef.current = null;
  }

  /**
   * Place the ghost for a pointer at `(localX, localY)`. With a grab offset the
   * ghost's top-left keeps the same position under the pointer it had at press
   * time, so the tile appears lifted from where it sat rather than snapping its
   * corner to the cursor. Without one it trails by a fixed offset.
   */
  function moveGhost(localX: number, localY: number) {
    const grab = grabOffsetRef.current;
    if (grab) previewPos.setValue({ x: localX - grab.x, y: localY - grab.y });
    else previewPos.setValue({ x: localX + GHOST_OFFSET_X, y: localY + GHOST_OFFSET_Y });
  }

  return {
    begin(localX, localY) {
      if (!canBeginAt(localX, localY)) return false;
      const entryIndex = toEntryIndex(localX, localY);
      const row = rowsRef.current?.[entryIndex];
      if (!row) return false;
      const anchor = getGrabAnchor(localX, localY);
      const sources = getDragSources(row.entry.path);
      draggedIndexRef.current = entryIndex;
      draggedPathsRef.current = sources;
      targetIndexRef.current = null;
      isDraggingRef.current = true;
      grabOffsetRef.current = anchor === null ? null : { x: localX - anchor.x, y: localY - anchor.y };
      moveGhost(localX, localY);
      // A multi-drag has no one name to show, so the chip counts instead.
      const previewLabel = sources.length > 1 ? `${sources.length} items` : row.entry.name;
      setDragDirect({ active: true, draggedIndex: entryIndex, draggedPaths: sources, previewLabel, targetIndex: null });
      return true;
    },
    move(localX, localY) {
      if (!isDraggingRef.current) return;
      moveGhost(localX, localY);
      const entryIndex = toEntryIndex(localX, localY);
      const clamped = Math.max(0, Math.min(entryIndex, (rowsRef.current?.length ?? 1) - 1));
      const draggedIndex = draggedIndexRef.current;
      const sourceRow = draggedIndex === null ? undefined : rowsRef.current?.[draggedIndex];
      const newTarget = isValidDropTarget(sourceRow, rowsRef.current?.[clamped]) ? clamped : null;
      if (newTarget !== targetIndexRef.current) {
        targetIndexRef.current = newTarget;
        setDrag((prev) => ({ ...prev, targetIndex: newTarget }));
      }
      // Auto-scroll near container edges.
      stopAutoScroll();
      const h = containerHeightRef.current;
      if (h > 0 && localY < SCROLL_ZONE)
        scrollTimerRef.current = setInterval(() => {
          flatListRef.current?.scrollToOffset({ animated: false, offset: Math.max(0, scrollOffsetRef.current - SCROLL_STEP) });
        }, SCROLL_INTERVAL_MS);
      else if (h > 0 && localY > h - SCROLL_ZONE)
        scrollTimerRef.current = setInterval(() => {
          flatListRef.current?.scrollToOffset({ animated: false, offset: scrollOffsetRef.current + SCROLL_STEP });
        }, SCROLL_INTERVAL_MS);
    },
    finish(commit) {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      stopAutoScroll();
      const dst = targetIndexRef.current === null ? undefined : rowsRef.current?.[targetIndexRef.current];
      // Re-checked rather than trusted: the rows can have changed between the last
      // move and the release (a lazy folder resolving, a re-sort), and each carried
      // path stands or falls against the destination on its own.
      if (commit && dst) {
        const sources = movableSources(draggedPathsRef.current, rowsRef.current ?? [], dst);
        if (sources.length > 0) onMoveRef.current?.({ destination: dst.entry.path, sources });
      }
      draggedIndexRef.current = null;
      draggedPathsRef.current = [];
      targetIndexRef.current = null;
      grabOffsetRef.current = null;
      setDragDirect(IDLE_DRAG);
    },
    isActive: () => isDraggingRef.current,
    getTargetIndex: () => targetIndexRef.current,
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useFileSystemDrag({
  enabled,
  rows,
  scrollOffsetRef,
  containerHeightRef,
  flatListRef,
  onMove,
  toEntryIndex,
  contentOffsetTop = 0,
  getGrabAnchor,
  getDragSources,
  canBeginAt,
}: UseFileSystemDragParams): UseFileSystemDragReturn {
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const draggedIndexRef = useRef<number | null>(null);
  const draggedPathsRef = useRef<string[]>(NO_PATHS);
  const targetIndexRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const grabOffsetRef = useRef<FileSystemGrabAnchor | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const previewPos = useRef(new Animated.ValueXY()).current;

  const [drag, setDrag] = useState<FileSystemDragRender>(IDLE_DRAG);
  const setDragDirect = useCallback((next: FileSystemDragRender) => setDrag(() => next), []);

  // Default index resolver: list-view row formula. `contentOffsetTop` is the
  // list's own top padding — without it every boundary sits that many pixels
  // off, so the row the pointer looks to be over is not the one that commits.
  const defaultToEntryIndex = useCallback(
    (_localX: number, localY: number) => Math.floor((localY + scrollOffsetRef.current - contentOffsetTop) / FS_ROW_HEIGHT),
    [contentOffsetTop, scrollOffsetRef],
  );
  const resolvedToEntryIndex = toEntryIndex ?? defaultToEntryIndex;
  // Keep the resolver in a ref so the session memo never needs to re-fire when
  // it changes (e.g. columns / tileWidth update in the icons view).
  const toEntryIndexRef = useRef(resolvedToEntryIndex);
  toEntryIndexRef.current = resolvedToEntryIndex;
  const stableToEntryIndex = useCallback((x: number, y: number) => toEntryIndexRef.current(x, y), []);

  // Same treatment for the anchor resolver: the icons view rebuilds it whenever
  // the grid metrics change, and a session rebuilt mid-drag loses the gesture.
  const grabAnchorRef = useRef(getGrabAnchor);
  grabAnchorRef.current = getGrabAnchor;
  const stableGetGrabAnchor = useCallback((x: number, y: number) => grabAnchorRef.current?.(x, y) ?? null, []);

  // Same again for the source resolver: it closes over the live selection, which
  // changes far more often than a session should be torn down and rebuilt.
  const dragSourcesRef = useRef(getDragSources);
  dragSourcesRef.current = getDragSources;
  const stableGetDragSources = useCallback((path: string) => dragSourcesRef.current?.(path) ?? [path], []);

  // And for the lift gate, which the icons view rebuilds whenever the grid
  // metrics or the entry count change.
  const canBeginRef = useRef(canBeginAt);
  canBeginRef.current = canBeginAt;
  const stableCanBeginAt = useCallback((x: number, y: number) => canBeginRef.current?.(x, y) ?? true, []);

  const session = useMemo(
    () =>
      buildDragSession({
        rowsRef,
        onMoveRef,
        draggedIndexRef,
        draggedPathsRef,
        getDragSources: stableGetDragSources,
        canBeginAt: stableCanBeginAt,
        targetIndexRef,
        isDraggingRef,
        grabOffsetRef,
        scrollTimerRef,
        scrollOffsetRef,
        containerHeightRef,
        flatListRef,
        previewPos,
        toEntryIndex: stableToEntryIndex,
        getGrabAnchor: stableGetGrabAnchor,
        setDrag,
        setDragDirect,
      }),
    // All deps are stable refs or stable callbacks — this memo fires exactly once.
    [
      containerHeightRef,
      flatListRef,
      previewPos,
      scrollOffsetRef,
      setDragDirect,
      stableCanBeginAt,
      stableGetDragSources,
      stableGetGrabAnchor,
      stableToEntryIndex,
    ],
  );

  const nativeGesture = useMemo(() => {
    if (Platform.OS === 'web' || !enabled) return null;
    return Gesture.Pan()
      .activateAfterLongPress(300)
      .runOnJS(true)
      .onStart(({ x, y }: PanGestureEvent) => session.begin(x, y))
      .onUpdate(({ x, y }: PanGestureEvent) => session.move(x, y))
      .onEnd(() => session.finish(true))
      .onFinalize(() => {
        if (session.isActive()) session.finish(false);
      });
  }, [enabled, session]);

  return { session, previewPos, drag, nativeGesture };
}

/**
 * What a drag lifted from `path` should carry: the whole selection when `path`
 * is part of one, and just `path` otherwise.
 *
 * Dragging an unselected entry out of a multi-selection is deliberately not a
 * "move all of it" — the entry under the pointer is the one the gesture is
 * about, and a stale selection elsewhere in the folder should not ride along.
 */
export function useDragSources(selectedPaths: ReadonlySet<string>): (path: string) => string[] {
  return useCallback(
    (path: string) => (selectedPaths.size > 1 && selectedPaths.has(path) ? [...selectedPaths] : [path]),
    [selectedPaths],
  );
}
