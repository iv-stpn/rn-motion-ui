/** biome-ignore-all lint/style/useExportsLast: hook + its param/return types read best together */
// Long-press → drag-and-drop for the FileTree. The gesture layer is kept
// deliberately thin: every "what does this move mean" decision lives in the pure
// file-tree-dnd module, and hit-testing is the pure `rowIndexAtOffset`. This hook
// only turns pointer coordinates into (dragged paths, hovered row) and calls the
// controller's `commitMove` on release.
//
// The *transport* is platform-split on purpose. Native drives the session from a
// react-native-gesture-handler pan (`runOnJS(true)`: the callbacks read component
// refs directly — no worklet shared-value plumbing — which is simpler and safe
// for a file tree). Web cannot use that pan: RNGH's web implementation takes
// pointer capture on whichever descendant row node the press landed on, and the
// re-render that activating a drag triggers drops that capture. Its
// `lostpointercapture` handler then synthesizes a `pointercancel`, so the pan
// dies one frame in and every drop resolves against a stale target. The web
// transport (`useFileTreeDragWeb`) captures on the scroll container instead —
// that node never unmounts mid-drag, so the pointer stream survives every
// re-render — and drives this same session.
//
// Preview position rides an Animated.ValueXY so following the pointer costs no
// React re-render; only a drop-target row *crossing* bumps state.

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, type FlatList, Platform } from 'react-native';
import {
  Gesture,
  type GestureStateChangeEvent,
  type GestureUpdateEvent,
  type PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import type { FileTreeVisibleRow } from './file-tree.types';
import { resolveDraggedPathsForStart, resolveDropHighlightPath } from './file-tree-dnd';
import { rowIndexAtOffset } from './file-tree-layout';
import { leafName } from './file-tree-paths';

/** How long a press must be held before the drag activates (ms). */
export const DRAG_LONG_PRESS = 300;
/** Distance from a viewport edge (px) that triggers auto-scroll while dragging. */
const EDGE_ZONE = 36;
/** Auto-scroll tick interval (ms) and per-tick step (px). */
const AUTO_SCROLL_MS = 16;
const AUTO_SCROLL_STEP = 6;

type PanStart = GestureStateChangeEvent<PanGestureHandlerEventPayload>;
type PanUpdate = GestureUpdateEvent<PanGestureHandlerEventPayload>;

/** A short label for the drag preview: the primary leaf, plus a `+N` for extras. */
function dragLabel(paths: string[]): string {
  const first = paths[0] ? leafName(paths[0]) : '';
  return paths.length > 1 ? `${first} +${paths.length - 1}` : first;
}

/** Clamp a scroll offset to the list's real scroll range. */
function clampOffset(offset: number, rowCount: number, itemHeight: number, viewportHeight: number): number {
  const max = Math.max(0, rowCount * itemHeight - viewportHeight);
  return Math.max(0, Math.min(max, offset));
}

export type UseFileTreeDragParams = {
  enabled: boolean;
  rows: FileTreeVisibleRow[];
  itemHeight: number;
  viewportHeight: number;
  /** Live scroll offset, read on every pointer sample without re-rendering. */
  scrollOffsetRef: RefObject<number>;
  listRef: RefObject<FlatList<FileTreeVisibleRow> | null>;
  /** Current selection, so dragging a selected row drags the whole selection. */
  getSelected: () => Set<string>;
  /** Applies the move; resolves to a no-op internally when the drop is illegal. */
  commitMove: (dragged: string[], targetPath: string | null) => void;
};

/** What the overlays need in order to draw. */
export type FileTreeDragRender = {
  active: boolean;
  label: string;
  dropTargetPath: string | null;
  /**
   * The paths this drag lifted. Rows read it to hold the hover tint on the source
   * for the length of the drag: a captured pointer sends them no boundary events,
   * so their own hover state cannot say it. Empty when no drag is in flight.
   */
  draggedPaths: readonly string[];
  previewPos: Animated.ValueXY;
};

/** Stable empty set so an idle tree never re-renders its rows over identity alone. */
const NO_DRAGGED_PATHS: readonly string[] = [];

/**
 * The imperative drag session a platform transport drives. Coordinates are local
 * to the scroll viewport (its top-left corner), matching `rowIndexAtOffset` and
 * the absolutely-positioned overlays.
 */
export type FileTreeDragSession = {
  /** Arms the drag at a point. Returns false when no row sits there. */
  begin: (localX: number, localY: number) => boolean;
  /** Tracks the pointer: moves the preview, re-resolves the drop target. */
  move: (localX: number, localY: number) => void;
  /** Ends the drag, committing the resolved move only when `commit` is true. */
  finish: (commit: boolean) => void;
  isActive: () => boolean;
};

export type UseFileTreeDrag = {
  /** Native pan. Disabled on web, where `useFileTreeDragWeb` takes over. */
  gesture: ReturnType<typeof Gesture.Pan>;
  session: FileTreeDragSession;
  render: FileTreeDragRender;
};

/**
 * Scrolls the list while a drag hovers an edge zone. Returns a setter for the
 * direction (-1 up / 0 idle / +1 down); the ticker only exists while a direction
 * is set, so a drag parked in the middle of the list costs nothing.
 */
function useDragAutoScroll(params: UseFileTreeDragParams): (dir: number) => void {
  const { rows, itemHeight, viewportHeight, scrollOffsetRef, listRef } = params;
  const dirRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    const dir = dirRef.current;
    if (dir === 0) return;
    const next = clampOffset(scrollOffsetRef.current + dir * AUTO_SCROLL_STEP, rows.length, itemHeight, viewportHeight);
    listRef.current?.scrollToOffset({ offset: next, animated: false });
  }, [scrollOffsetRef, rows.length, itemHeight, viewportHeight, listRef]);

  // biome-ignore lint/plugin: interval teardown — unmounting mid-drag must not leave a ticker running.
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    },
    [],
  );

  return useCallback(
    (dir: number) => {
      dirRef.current = dir;
      if (dir !== 0) {
        if (timerRef.current === null) timerRef.current = setInterval(tick, AUTO_SCROLL_MS);
        return;
      }
      if (timerRef.current === null) return;
      clearInterval(timerRef.current);
      timerRef.current = null;
    },
    [tick],
  );
}

/**
 * Native transport: a long-press pan feeding the session. Stays disabled on web,
 * where `useFileTreeDragWeb` takes over (see the note at the top of this file).
 */
function useNativeDragPan(enabled: boolean, session: FileTreeDragSession): ReturnType<typeof Gesture.Pan> {
  const { begin, move, finish } = session;
  const onStart = useCallback(
    (event: PanStart) => {
      begin(event.x, event.y);
    },
    [begin],
  );
  const onUpdate = useCallback((event: PanUpdate) => move(event.x, event.y), [move]);
  const onEnd = useCallback(
    (_event: PanUpdate, success: boolean) => {
      if (success) finish(true);
    },
    [finish],
  );
  // Always runs, including after a cancel — resets without committing. A no-op
  // when `onEnd` already committed, since the session is empty by then.
  const onFinalize = useCallback(() => finish(false), [finish]);

  return useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled && Platform.OS !== 'web')
        .maxPointers(1)
        .activateAfterLongPress(DRAG_LONG_PRESS)
        .runOnJS(true)
        .onStart(onStart)
        .onUpdate(onUpdate)
        .onEnd(onEnd)
        .onFinalize(onFinalize),
    [enabled, onStart, onUpdate, onEnd, onFinalize],
  );
}

export function useFileTreeDrag(params: UseFileTreeDragParams): UseFileTreeDrag {
  const { enabled, rows, itemHeight, viewportHeight, scrollOffsetRef, getSelected, commitMove } = params;

  const [active, setActive] = useState(false);
  const [label, setLabel] = useState('');
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  // Mirrors draggedRef into render state. Only the rows need it, and it changes
  // exactly twice per drag, so it is nowhere near the pointer path.
  const [draggedPaths, setDraggedPaths] = useState<readonly string[]>(NO_DRAGGED_PATHS);
  const previewPos = useRef(new Animated.ValueXY()).current;

  // Drag state lives in refs: the pointer stream reads it synchronously, and a
  // re-render per sample would be both wasteful and (on web) capture-hostile.
  const draggedRef = useRef<string[]>([]);
  const targetRef = useRef<string | null>(null);

  const setAutoScrollDir = useDragAutoScroll(params);

  const hoveredPathAt = useCallback(
    (localY: number): string | null => {
      const index = rowIndexAtOffset(localY, scrollOffsetRef.current, itemHeight, rows.length);
      return index === null ? null : (rows[index]?.path ?? null);
    },
    [rows, itemHeight, scrollOffsetRef],
  );

  const begin = useCallback(
    (localX: number, localY: number): boolean => {
      if (!enabled) return false;
      const path = hoveredPathAt(localY);
      if (!path) return false;
      const dragged = resolveDraggedPathsForStart(path, getSelected());
      draggedRef.current = dragged;
      targetRef.current = path;
      previewPos.setValue({ x: localX, y: localY });
      setLabel(dragLabel(dragged));
      setDropTargetPath(resolveDropHighlightPath(dragged, path));
      setDraggedPaths(dragged);
      setActive(true);
      return true;
    },
    [enabled, hoveredPathAt, getSelected, previewPos],
  );

  const move = useCallback(
    (localX: number, localY: number) => {
      if (draggedRef.current.length === 0) return;
      previewPos.setValue({ x: localX, y: localY });

      if (localY < EDGE_ZONE) setAutoScrollDir(-1);
      else if (localY > viewportHeight - EDGE_ZONE) setAutoScrollDir(1);
      else setAutoScrollDir(0);

      const path = hoveredPathAt(localY);
      if (path !== targetRef.current) {
        targetRef.current = path;
        setDropTargetPath(resolveDropHighlightPath(draggedRef.current, path));
      }
    },
    [previewPos, viewportHeight, hoveredPathAt, setAutoScrollDir],
  );

  const finish = useCallback(
    (commit: boolean) => {
      const dragged = draggedRef.current;
      const target = targetRef.current;
      setAutoScrollDir(0);
      draggedRef.current = [];
      targetRef.current = null;
      if (dragged.length === 0) return;
      setActive(false);
      setDropTargetPath(null);
      setDraggedPaths(NO_DRAGGED_PATHS);
      setLabel('');
      if (commit) commitMove(dragged, target);
    },
    [setAutoScrollDir, commitMove],
  );

  const session = useMemo<FileTreeDragSession>(
    () => ({ begin, move, finish, isActive: () => draggedRef.current.length > 0 }),
    [begin, move, finish],
  );

  const gesture = useNativeDragPan(enabled, session);

  const render = useMemo<FileTreeDragRender>(
    () => ({ active, draggedPaths, label, dropTargetPath, previewPos }),
    [active, draggedPaths, label, dropTargetPath, previewPos],
  );

  return { gesture, session, render };
}
