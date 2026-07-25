/** biome-ignore-all lint/style/useExportsLast: hook + its param/return types read best together */
// Long-press → pan drag-and-drop for the FileTree. The gesture layer is kept
// deliberately thin: every "what does this move mean" decision lives in the pure
// file-tree-dnd module, and hit-testing is the pure `rowIndexAtOffset`. This hook
// only turns finger coordinates into (dragged paths, hovered row) and calls the
// controller's `commitMove` on release.
//
// It runs on the JS thread (`runOnJS(true)`): the callbacks read component refs
// directly (no worklet shared-value plumbing), which is simpler and safe for a
// file tree. Preview position rides an Animated.ValueXY so following the finger
// costs no React re-render; only a drop-target row *crossing* bumps state.

import { type RefObject, useCallback, useMemo, useRef, useState } from 'react';
import { Animated, type FlatList } from 'react-native';
import {
  Gesture,
  type GestureStateChangeEvent,
  type GestureUpdateEvent,
  type PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import type { FileTreeVisibleRow } from './file-tree.types';
import { resolveDraggedPathsForStart } from './file-tree-dnd';
import { rowIndexAtOffset } from './file-tree-layout';
import { leafName } from './file-tree-paths';

/** How long a press must be held before the drag activates (ms). */
const DRAG_LONG_PRESS = 300;
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
  /** Drag is only wired when this is true (`draggable` prop). */
  enabled: boolean;
  /** The current visible rows (hit-test domain). */
  rows: FileTreeVisibleRow[];
  /** Uniform row height. */
  itemHeight: number;
  /** Scroll viewport height (for edge auto-scroll). */
  viewportHeight: number;
  /** Live scroll offset, kept current by the list's `onScroll`. */
  scrollOffsetRef: RefObject<number>;
  /** The list, for programmatic auto-scroll. */
  listRef: RefObject<FlatList<FileTreeVisibleRow> | null>;
  /** Read the current selection (a selected row drags the whole selection). */
  getSelected: () => Set<string>;
  /** Commit the resolved move (from `useSyncedFileTree`). */
  commitMove: (dragged: Iterable<string>, targetPath: string | null) => void;
};

/** What the render layer needs to draw the drag preview + drop highlight. */
export type FileTreeDragRender = { active: boolean; label: string; dropTargetPath: string | null; previewPos: Animated.ValueXY };

export type UseFileTreeDrag = { gesture: ReturnType<typeof Gesture.Pan>; render: FileTreeDragRender };

/**
 * Build the drag gesture + the state the preview/highlight render from. The
 * gesture is always constructed (hooks can't be conditional); the caller only
 * attaches it via `<GestureDetector>` when `draggable` is set.
 */
export function useFileTreeDrag(params: UseFileTreeDragParams): UseFileTreeDrag {
  const { enabled, rows, itemHeight, viewportHeight, scrollOffsetRef, listRef, getSelected, commitMove } = params;
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState('');
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const previewPos = useRef(new Animated.ValueXY()).current;

  const draggedRef = useRef<string[]>([]);
  const targetRef = useRef<string | null>(null);
  const autoScrollDir = useRef(0);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimer.current !== null) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
    autoScrollDir.current = 0;
  }, []);

  const tickAutoScroll = useCallback(() => {
    if (autoScrollDir.current === 0) return;
    const next = clampOffset(
      scrollOffsetRef.current + autoScrollDir.current * AUTO_SCROLL_STEP,
      rows.length,
      itemHeight,
      viewportHeight,
    );
    listRef.current?.scrollToOffset({ offset: next, animated: false });
  }, [scrollOffsetRef, rows.length, itemHeight, viewportHeight, listRef]);

  const hoveredPathAt = useCallback(
    (localY: number): string | null => {
      const index = rowIndexAtOffset(localY, scrollOffsetRef.current, itemHeight, rows.length);
      return index === null ? null : (rows[index]?.path ?? null);
    },
    [rows, itemHeight, scrollOffsetRef],
  );

  const onStart = useCallback(
    (event: PanStart) => {
      if (!enabled) return;
      const path = hoveredPathAt(event.y);
      if (!path) return;
      const dragged = resolveDraggedPathsForStart(path, getSelected());
      draggedRef.current = dragged;
      targetRef.current = path;
      previewPos.setValue({ x: event.x, y: event.y });
      setLabel(dragLabel(dragged));
      setDropTargetPath(path);
      setActive(true);
      autoScrollTimer.current = setInterval(tickAutoScroll, AUTO_SCROLL_MS);
    },
    [enabled, hoveredPathAt, getSelected, previewPos, tickAutoScroll],
  );

  const onUpdate = useCallback(
    (event: PanUpdate) => {
      if (draggedRef.current.length === 0) return;
      previewPos.setValue({ x: event.x, y: event.y });
      if (event.y < EDGE_ZONE) autoScrollDir.current = -1;
      else if (event.y > viewportHeight - EDGE_ZONE) autoScrollDir.current = 1;
      else autoScrollDir.current = 0;
      const path = hoveredPathAt(event.y);
      if (path !== targetRef.current) {
        targetRef.current = path;
        setDropTargetPath(path);
      }
    },
    [previewPos, viewportHeight, hoveredPathAt],
  );

  const onEnd = useCallback(() => {
    if (draggedRef.current.length > 0) commitMove(draggedRef.current, targetRef.current);
  }, [commitMove]);

  const onFinalize = useCallback(() => {
    stopAutoScroll();
    draggedRef.current = [];
    targetRef.current = null;
    setActive(false);
    setDropTargetPath(null);
  }, [stopAutoScroll]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .maxPointers(1)
        .activateAfterLongPress(DRAG_LONG_PRESS)
        .runOnJS(true)
        .onStart(onStart)
        .onUpdate(onUpdate)
        .onEnd(onEnd)
        .onFinalize(onFinalize),
    [enabled, onStart, onUpdate, onEnd, onFinalize],
  );

  return { gesture, render: { active, label, dropTargetPath, previewPos } };
}
