/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: the hook and the node it drives are one unit — the Animated values are useless apart */
// Pointer-driven hover highlight for the FileSystem views (web only).
//
// Why not CSS `:hover`? The web drag transport takes setPointerCapture on the
// scroll container, and while a pointer is captured the browser stops updating
// `:hover` and stops sending the boundary events RNW's onHoverIn/onHoverOut are
// built on. A CSS hover therefore freezes on whatever cell the drag started
// from — the opposite of showing the highlight while dragging.
//
// So the highlight reads the container's own pointermove stream, which does keep
// firing under capture. One absolutely-positioned node slides between cells; its
// position and opacity live in Animated values written straight from the DOM
// listener, so tracking the pointer costs zero React re-renders — the same
// invariant use-file-system-drag.ts holds for the drag itself.

import { type RefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';

/** Mirrors EASE_OUT in lib/ease — that one is a Reanimated factory, this API needs RN's own Easing. */
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
/** Gliding between cells: long enough to read as motion, short enough to stay attached to the pointer. */
const MOVE_MS = 110;
const FADE_IN_MS = 90;
/** Slower than the fade in — a highlight that vanishes on the frame the pointer leaves reads as a flicker. */
const FADE_OUT_MS = 140;

/**
 * The highlight node, one per view. Fixed rather than a prop for the same reason
 * the drag containers are: a test asserting the highlight tracks a drag has to
 * find this exact node, and there is one per view to disambiguate.
 */
export const FS_HOVER_TEST_ID = {
  columns: 'file-system-columns-hover-highlight',
  gallery: 'file-system-gallery-hover-highlight',
  icons: 'file-system-icons-hover-highlight',
  list: 'file-system-list-hover-highlight',
};

/** The cell under the pointer: its top-left corner, in the container's own frame. */
export type FileSystemHoverCell = { x: number; y: number };

/**
 * Map a container-local pointer position to the cell under it, or `null` where
 * there is no cell (past the last entry, or in the content padding). Resolvers
 * share the geometry the drag resolvers use, so the highlight marks the cell a
 * drop would actually commit to.
 */
export type FileSystemHoverResolve = (localX: number, localY: number) => FileSystemHoverCell | null;

export type FileSystemHoverController = {
  /** Drives the highlight's transform. Never read during render. */
  pos: Animated.ValueXY;
  opacity: Animated.Value;
  /**
   * Re-resolve the last pointer position. Call from `onScroll`: the pointer has
   * not moved but the content under it has, so the highlight has to change cells
   * with no pointermove to tell it to.
   */
  refresh: () => void;
};

// ── Highlight actions ──────────────────────────────────────────────────────────
// Built once per hook instance, outside it so the hook body stays readable. Every
// piece of state it touches is a ref: these run on the pointermove path.

type HoverRefs = {
  pos: Animated.ValueXY;
  opacity: Animated.Value;
  /** Whether the highlight is currently faded in — decides snap vs glide. */
  shownRef: RefObject<boolean>;
  cellRef: RefObject<FileSystemHoverCell | null>;
  /** Last pointer position, container-local — what `refresh` re-resolves. */
  pointRef: RefObject<FileSystemHoverCell | null>;
  reduceRef: RefObject<boolean>;
  resolveRef: RefObject<FileSystemHoverResolve>;
};

type HoverActions = {
  moveTo: (localX: number, localY: number) => void;
  refresh: () => void;
  /** Fade out and forget the pointer. */
  leave: () => void;
};

function buildHoverActions({ pos, opacity, shownRef, cellRef, pointRef, reduceRef, resolveRef }: HoverRefs): HoverActions {
  function fade(toValue: number, duration: number) {
    Animated.timing(opacity, { duration: reduceRef.current ? 0 : duration, toValue, useNativeDriver: false }).start();
  }

  function hide() {
    if (!shownRef.current) return;
    shownRef.current = false;
    cellRef.current = null;
    fade(0, FADE_OUT_MS);
  }

  /**
   * Put the highlight on `cell`. One that is already up glides across; one that
   * is coming up snaps into place first, because gliding in from wherever it was
   * last left has it fly the length of the list on re-entry.
   */
  function show(cell: FileSystemHoverCell, animate: boolean) {
    const from = cellRef.current;
    cellRef.current = cell;
    if (from !== null && animate && !reduceRef.current) {
      if (from.x !== cell.x || from.y !== cell.y)
        Animated.timing(pos, { duration: MOVE_MS, easing: EASE_OUT, toValue: cell, useNativeDriver: false }).start();
    } else pos.setValue(cell);
    if (shownRef.current) return;
    shownRef.current = true;
    fade(1, FADE_IN_MS);
  }

  function apply(localX: number, localY: number, animate: boolean) {
    const cell = resolveRef.current(localX, localY);
    if (cell === null) hide();
    else show(cell, animate);
  }

  return {
    leave() {
      pointRef.current = null;
      hide();
    },
    moveTo(localX, localY) {
      pointRef.current = { x: localX, y: localY };
      apply(localX, localY, true);
    },
    refresh() {
      const point = pointRef.current;
      if (point === null) return;
      // Unanimated: through a scroll the cell under a stationary pointer changes
      // every frame, and a glide per frame trails the content it is marking.
      apply(point.x, point.y, false);
    },
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export type UseFileSystemHoverParams = {
  containerRef: RefObject<View | null>;
  /**
   * Where the highlight goes. A draggable view narrows this under a drag — see
   * the row helper below — so the one highlight doubles as the drop indicator
   * instead of trailing the ghost across every cell it passes.
   */
  resolve: FileSystemHoverResolve;
  /**
   * Whether a drag is in flight. Touch hover is suppressed otherwise — a tap
   * would flash a highlight under the finger that no pointer is there to hold —
   * but a touch drag wants the same target feedback the mouse gets.
   */
  isDragging?: () => boolean;
};

export function useFileSystemHover({ containerRef, resolve, isDragging }: UseFileSystemHoverParams): FileSystemHoverController {
  const pos = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const shownRef = useRef(false);
  const cellRef = useRef<FileSystemHoverCell | null>(null);
  const pointRef = useRef<FileSystemHoverCell | null>(null);
  // Read through refs so a new resolver (the icons grid rebuilds one per resize)
  // never re-binds the listeners, which would drop the highlight mid-drag.
  const reduce = useReducedMotion();
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;
  const isDraggingRef = useRef(isDragging);
  isDraggingRef.current = isDragging;

  const actions = useMemo(
    () => buildHoverActions({ cellRef, opacity, pointRef, pos, reduceRef, resolveRef, shownRef }),
    [opacity, pos],
  );

  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;

    // An arrow, not a `function` declaration: a declaration is hoisted, so TS dates
    // its capture of `node` to before the null check above and loses the narrowing.
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' && !isDraggingRef.current?.()) return;
      const rect = node.getBoundingClientRect();
      actions.moveTo(event.clientX - rect.left, event.clientY - rect.top);
    };
    const onLeave = () => actions.leave();

    node.addEventListener('pointermove', onPointerMove);
    // Under pointer capture these hold off until the capture is released, which
    // is exactly the point — the highlight keeps tracking for the whole drag.
    node.addEventListener('pointerleave', onLeave);
    node.addEventListener('pointercancel', onLeave);

    return () => {
      onLeave();
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerleave', onLeave);
      node.removeEventListener('pointercancel', onLeave);
    };
  }, [actions, containerRef]);

  return useMemo(() => ({ opacity, pos, refresh: actions.refresh }), [actions, opacity, pos]);
}

// ── Uniform-stride list helper ─────────────────────────────────────────────────

export type UseFileSystemRowHoverParams = {
  containerRef: RefObject<View | null>;
  /** Number of rows — past the last one there is no cell to mark. */
  count: number;
  /**
   * The row index a drop would commit to, read live. Given one, a drag places
   * the highlight from it and ignores the pointer: the source row does not stay
   * lit, a file passed over never lights up, and the highlight sits exactly
   * under the drop outline that reads the same index.
   * Omit to suppress the highlight entirely while dragging.
   */
  getTargetIndex?: () => number | null;
  isDragging?: () => boolean;
  /** The list's content-container top padding: where row 0 starts. */
  offsetTop: number;
  scrollOffsetRef: RefObject<number>;
  /**
   * Flat row indexes of the selected entries. The highlight is suppressed on a
   * selected row — its own selection style already marks it.
   */
  selectedIndexesRef?: RefObject<ReadonlySet<number>>;
  /** Row height plus any gap below it. */
  stride: number;
};

/**
 * The hover controller for a vertical list of uniform rows — the list view and
 * each columns pane. Rows fill the container's width, so only the top edge is
 * resolved; the caller leaves the highlight's `width` unset to match.
 */
export function useFileSystemRowHover({
  containerRef,
  count,
  getTargetIndex,
  isDragging,
  offsetTop,
  scrollOffsetRef,
  selectedIndexesRef,
  stride,
}: UseFileSystemRowHoverParams): FileSystemHoverController {
  const resolve = useCallback(
    (_localX: number, localY: number) => {
      const top = (row: number) => ({ x: 0, y: row * stride + offsetTop - scrollOffsetRef.current });
      if (isDragging?.()) {
        if (!getTargetIndex) return null;
        const target = getTargetIndex();
        return target === null ? null : top(target);
      }
      const index = Math.floor((localY + scrollOffsetRef.current - offsetTop) / stride);
      if (index < 0 || index >= count) return null;
      if (selectedIndexesRef?.current.has(index)) return null;
      return top(index);
    },
    [count, getTargetIndex, isDragging, offsetTop, scrollOffsetRef, selectedIndexesRef, stride],
  );
  return useFileSystemHover({ containerRef, isDragging, resolve });
}

// ── Node ───────────────────────────────────────────────────────────────────────

export type FileSystemHoverHighlightProps = {
  /** Rounding (and any other face styling) matched to the cell it sits behind. */
  className?: string;
  controller: FileSystemHoverController;
  /** Cell height — uniform across a view's cells, so it never animates. */
  height: number;
  testID?: string;
  /** Cell width. Omit for a cell that spans the container, like a list row. */
  width?: number;
};

export type FileSystemSourceHighlightProps = {
  /** Rounding matched to the cell it sits behind, as with the sliding highlight. */
  className?: string;
  height: number;
  /** Container-local top-left of the cell the drag was lifted from, or `null`. */
  origin: FileSystemHoverCell | null;
  testID?: string;
  /** Cell width. Omit for a cell that spans the container, like a list row. */
  width?: number;
};

/**
 * The hover tint held on the cell a drag was lifted from, for the length of the
 * drag. By then the sliding highlight has moved to the drop target, and a
 * captured pointer sends no boundary events, so without this the source cell is
 * the one on screen with nothing marking it — even though it is still the subject
 * of the gesture.
 *
 * Static, not animated: the source does not move, so there is nothing to glide.
 * It only re-positions when the view scrolls, which the caller already re-renders
 * for. Mounted alongside the sliding highlight, behind the cells for the same
 * reason: a selected source is opaque and covers it, the same yield-to-selection
 * an ordinary hover does.
 */
export function FileSystemSourceHighlight({ className, height, origin, testID, width }: FileSystemSourceHighlightProps) {
  if (Platform.OS !== 'web' || origin === null) return null;
  return (
    <View className="pointer-events-none absolute inset-0 overflow-hidden">
      <View
        className={cn('absolute rounded-md bg-surface-hover', className)}
        style={{ height, left: origin.x, top: origin.y, width: width ?? '100%' }}
        testID={testID}
      />
    </View>
  );
}

/**
 * The highlight itself: absolute, non-interactive, inside its own clipping layer
 * so a cell at the edge of the scroll area cannot paint over the column header
 * or outside its pane.
 *
 * Mount it *before* the list. RNW gives every View `zIndex: 0`, so tree order
 * decides paint order and the highlight lands behind the rows — an opaque
 * selected row covers it, a transparent one lets the tint through, and the drop
 * outline and drag ghost keep their higher zIndex above both.
 */
export function FileSystemHoverHighlight({ className, controller, height, testID, width }: FileSystemHoverHighlightProps) {
  if (Platform.OS !== 'web') return null;
  return (
    <View className="pointer-events-none absolute inset-0 overflow-hidden">
      <Animated.View
        style={{
          height,
          left: 0,
          opacity: controller.opacity,
          position: 'absolute',
          top: 0,
          transform: controller.pos.getTranslateTransform(),
          width: width ?? '100%',
        }}
        testID={testID}
      >
        <View className={cn('size-full rounded-md bg-surface-hover', className)} />
      </Animated.View>
    </View>
  );
}
