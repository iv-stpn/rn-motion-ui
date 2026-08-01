/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: the hook and the node it drives are one unit — the Animated values are useless apart */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the transport, its actions and the node they drive are one gesture — splitting would scatter the refs they all read */
// The selection box — the rubber band you drag across empty space in a file
// manager to sweep up everything it touches. Web only, and only under
// `selectionMode="multiple"`: it is a pointer affordance with no touch
// equivalent (a finger dragged across a grid scrolls it), and a box that could
// only ever land on one entry would be theatre.
//
// Two invariants shape the implementation:
//
//  1. It never fights the drag. A press either lands on a tile — where a drag
//     lifts — or it does not, where the box starts. Both ask the same strict
//     `tileHitAt`, so exactly one of them arms on any given press.
//  2. The box's own rect costs no re-renders. Its geometry lives in Animated
//     values written straight from the DOM listener, the same invariant
//     file-system-hover.tsx and use-file-system-drag.ts hold. What the box
//     *selects* does write to the store — that is the point of it — but only
//     when the covered set actually changes, which `applyFileSystemMarquee`
//     decides by identity.

import { type RefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, type View } from 'react-native';

/**
 * The box itself. Fixed rather than a prop, like the drag containers and the
 * hover highlight: a test asserting the band was drawn has to find this exact
 * node, and there is only ever one on screen.
 */
export const FS_MARQUEE_TEST_ID = 'file-system-marquee';

/** Below this the gesture is a click, not a drag — the same slop the drag transport uses. */
const MARQUEE_SLOP = 4;

/** A rectangle in the grid's content frame — scroll folded into `y`. */
export type FileSystemMarqueeRect = { x: number; y: number; width: number; height: number };

export type FileSystemMarqueeController = {
  /** Drives the box's geometry and visibility. Never read during render. */
  rect: { x: Animated.Value; y: Animated.Value; width: Animated.Value; height: Animated.Value };
  opacity: Animated.Value;
  /**
   * Re-place the box against the live scroll offset. Call from `onScroll`: the
   * pointer has not moved, but the content the box is anchored to has.
   */
  refresh: () => void;
};

type MarqueeSession = {
  /** Where the press landed, in the content frame. */
  originX: number;
  originY: number;
  pointerId: number;
  /** The selection to union with, or `null` when the box replaces it. */
  base: ReadonlySet<string> | null;
  /** Past the slop — until then the press is still a candidate click. */
  active: boolean;
};

export type UseFileSystemMarqueeParams = {
  containerRef: RefObject<View | null>;
  /** `false` outside `selectionMode="multiple"`, which unbinds the listeners entirely. */
  enabled: boolean;
  /** Whether a box may start here — false wherever a drag would lift instead. */
  canStartAt: (localX: number, localY: number) => boolean;
  /** Live scroll offset, so the content frame can be entered and left. */
  getScrollOffset: () => number;
  /** The selection as it stands, snapshotted when an additive box starts. */
  getSelectedPaths: () => ReadonlySet<string>;
  /**
   * When `true`, the list scrolls horizontally: the scroll offset folds into x
   * rather than y, and the box's viewport position is adjusted accordingly.
   * Default `false`.
   */
  horizontal?: boolean;
  /** Which entries a content-frame rect covers, in the view's own order. */
  resolve: (rect: FileSystemMarqueeRect) => readonly string[];
  /** One frame of the box: what it covers, and what to union it with. */
  onMarquee: (covered: readonly string[], base: ReadonlySet<string> | null) => void;
};

/** One bit, shared by the pointer listeners and the click guard. */
type ClickGate = { swallow: boolean };

type MarqueeListenerRefs = {
  actions: MarqueeActions;
  canStartRef: RefObject<(localX: number, localY: number) => boolean>;
  gate: ClickGate;
  horizontalRef: RefObject<boolean>;
  opacity: Animated.Value;
  scrollRef: RefObject<() => number>;
  selectedRef: RefObject<() => ReadonlySet<string>>;
  sessionRef: RefObject<MarqueeSession | null>;
};

/**
 * The three pointer handlers, built once per binding. Extracted so the hook body
 * stays readable — everything they touch is a ref, an Animated value or the
 * gate, because they run on the pointermove path.
 */
function buildMarqueeListeners(node: HTMLElement, refs: MarqueeListenerRefs) {
  const { actions, canStartRef, gate, horizontalRef, opacity, scrollRef, selectedRef, sessionRef } = refs;

  const local = (event: PointerEvent) => {
    const bounds = node.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  return {
    onPointerDown(event: PointerEvent) {
      // A stale bit cannot outlive the next press (a band whose click never came).
      gate.swallow = false;
      // Mouse and pen only: a finger dragged across the grid is a scroll, and
      // there is no modifier key on a touchscreen to say otherwise.
      if (event.pointerType === 'touch' || event.button !== 0 || sessionRef.current !== null) return;
      const { x, y } = local(event);
      if (!canStartRef.current(x, y)) return;
      const additive = event.ctrlKey || event.metaKey;
      const h = horizontalRef.current;
      sessionRef.current = {
        active: false,
        base: additive ? new Set(selectedRef.current()) : null,
        originX: h ? x + scrollRef.current() : x,
        originY: h ? y : y + scrollRef.current(),
        pointerId: event.pointerId,
      };
    },

    onPointerMove(event: PointerEvent) {
      const session = sessionRef.current;
      if (session === null || event.pointerId !== session.pointerId) return;
      const { x, y } = local(event);
      if (!session.active) {
        const h = horizontalRef.current;
        const cx = h ? x + scrollRef.current() : x;
        const cy = h ? y : y + scrollRef.current();
        if (Math.hypot(cx - session.originX, cy - session.originY) < MARQUEE_SLOP) return;
        session.active = true;
        // Captured only once the gesture has committed, so an ordinary click on
        // the background still reaches the press handler that clears the selection.
        try {
          node.setPointerCapture(session.pointerId);
        } catch {
          /* synthetic events may throw */
        }
        opacity.setValue(1);
      }
      // A text-selection drag over the labels would fight the band.
      event.preventDefault();
      actions.moveTo(x, y);
    },

    onPointerUp(event: PointerEvent) {
      const session = sessionRef.current;
      if (session === null || event.pointerId !== session.pointerId) return;
      // A release over empty space is followed by a `click`, and the container's
      // press handler reads that as "nothing was pressed" and clears — undoing
      // the band on the very frame it finished. Only a band that actually drew
      // arms the gate; a plain click on the background still clears, as it must.
      gate.swallow = session.active;
      actions.end();
    },
  };
}

/**
 * Wires the selection box to a view's scroll container.
 *
 * The origin is kept in the *content* frame rather than the viewport's, so a
 * wheel-scroll mid-drag leaves the band anchored to the tiles it was pulled
 * from instead of sliding out from under them.
 */
export function useFileSystemMarquee({
  containerRef,
  enabled,
  canStartAt,
  getScrollOffset,
  getSelectedPaths,
  horizontal,
  resolve,
  onMarquee,
}: UseFileSystemMarqueeParams): FileSystemMarqueeController {
  const rect = useRef({
    height: new Animated.Value(0),
    width: new Animated.Value(0),
    x: new Animated.Value(0),
    y: new Animated.Value(0),
  }).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const sessionRef = useRef<MarqueeSession | null>(null);
  /** Last pointer position in the content frame — what `refresh` re-applies. */
  const pointRef = useRef<{ x: number; y: number } | null>(null);
  // One bit shared by the pointer listeners and the click guard below, which are
  // bound in separate effects: the band just finished, so swallow the click the
  // browser sends after the release. Same arrangement as the drag transport.
  const gate = useRef({ swallow: false }).current;

  // Every callback is read through a ref so a re-measured grid or a changed
  // selection never re-binds the listeners mid-gesture, which would strand the
  // box with a pointer capture nothing is listening for.
  const canStartRef = useRef(canStartAt);
  canStartRef.current = canStartAt;
  const scrollRef = useRef(getScrollOffset);
  scrollRef.current = getScrollOffset;
  const selectedRef = useRef(getSelectedPaths);
  selectedRef.current = getSelectedPaths;
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;
  const marqueeRef = useRef(onMarquee);
  marqueeRef.current = onMarquee;
  const horizontalRef = useRef(horizontal ?? false);
  horizontalRef.current = horizontal ?? false;

  const actions = useMemo(
    () => buildMarqueeActions({ horizontalRef, marqueeRef, opacity, pointRef, rect, resolveRef, scrollRef, sessionRef }),
    [opacity, rect],
  );

  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;

    const { onPointerDown, onPointerMove, onPointerUp } = buildMarqueeListeners(node, {
      actions,
      canStartRef,
      gate,
      horizontalRef,
      opacity,
      scrollRef,
      selectedRef,
      sessionRef,
    });

    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove, { passive: false });
    node.addEventListener('pointerup', onPointerUp);
    node.addEventListener('pointercancel', onPointerUp);
    node.addEventListener('lostpointercapture', onPointerUp);

    return () => {
      actions.end();
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerUp);
      node.removeEventListener('lostpointercapture', onPointerUp);
    };
  }, [actions, containerRef, enabled, gate, opacity]);

  // The click guard, in its own effect so it outlives any listener rebuild. The
  // click it swallows lands after the release that set the bit, so they cannot
  // race; a stale bit is cleared by the next press either way.
  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const guard = (event: MouseEvent) => {
      if (!gate.swallow) return;
      gate.swallow = false;
      event.stopPropagation();
      event.preventDefault();
    };
    node.addEventListener('click', guard, true);
    return () => node.removeEventListener('click', guard, true);
  }, [containerRef, enabled, gate]);

  return { opacity, rect, refresh: actions.refresh };
}

// ── Box actions ────────────────────────────────────────────────────────────────
// Built once per hook instance, outside it so the hook body stays readable.
// Everything they touch is a ref or an Animated value: these run on the
// pointermove path.

type MarqueeRefs = {
  horizontalRef: RefObject<boolean>;
  rect: FileSystemMarqueeController['rect'];
  opacity: Animated.Value;
  sessionRef: RefObject<MarqueeSession | null>;
  pointRef: RefObject<{ x: number; y: number } | null>;
  scrollRef: RefObject<() => number>;
  resolveRef: RefObject<(rect: FileSystemMarqueeRect) => readonly string[]>;
  marqueeRef: RefObject<(covered: readonly string[], base: ReadonlySet<string> | null) => void>;
};

type MarqueeActions = { moveTo: (localX: number, localY: number) => void; refresh: () => void; end: () => void };

function buildMarqueeActions({
  horizontalRef,
  rect,
  opacity,
  sessionRef,
  pointRef,
  scrollRef,
  resolveRef,
  marqueeRef,
}: MarqueeRefs) {
  function apply(localX: number, localY: number) {
    const session = sessionRef.current;
    if (session === null || !session.active) return;
    const h = horizontalRef.current;
    const scroll = scrollRef.current();
    const contentX = h ? localX + scroll : localX;
    const contentY = h ? localY : localY + scroll;

    const box: FileSystemMarqueeRect = {
      height: Math.abs(contentY - session.originY),
      width: Math.abs(contentX - session.originX),
      x: Math.min(contentX, session.originX),
      y: Math.min(contentY, session.originY),
    };

    // Painted in the viewport's frame; resolved in the content's.
    rect.x.setValue(h ? box.x - scroll : box.x);
    rect.y.setValue(h ? box.y : box.y - scroll);
    rect.width.setValue(box.width);
    rect.height.setValue(box.height);

    marqueeRef.current(resolveRef.current(box), session.base);
  }

  const actions: MarqueeActions = {
    moveTo(localX, localY) {
      pointRef.current = { x: localX, y: localY };
      apply(localX, localY);
    },
    refresh() {
      const point = pointRef.current;
      if (point !== null) apply(point.x, point.y);
    },
    end() {
      if (sessionRef.current === null) return;
      sessionRef.current = null;
      pointRef.current = null;
      opacity.setValue(0);
      rect.width.setValue(0);
      rect.height.setValue(0);
    },
  };
  return actions;
}

// ── Node ───────────────────────────────────────────────────────────────────────

export type FileSystemMarqueeBoxProps = { controller: FileSystemMarqueeController };

/**
 * The band itself: a tinted rectangle with a hairline border, painted *over* the
 * tiles rather than behind them like the hover highlight — a rubber band that
 * slid under the content it is sweeping would read as a rendering bug.
 * Non-interactive, so it never takes the pointer stream drawing it.
 */
export function FileSystemMarqueeBox({ controller }: FileSystemMarqueeBoxProps) {
  const { rect, opacity } = controller;
  return (
    <Animated.View
      className="pointer-events-none absolute rounded-sm border border-info bg-info/20"
      style={{ height: rect.height, left: rect.x, opacity, top: rect.y, width: rect.width, zIndex: 5 }}
      testID={FS_MARQUEE_TEST_ID}
    />
  );
}

/**
 * The strict-hit predicate a view hands to both the drag and the box, so the two
 * partition every press between them. `hitTest` returns the entry under the
 * point, or `null` for padding, gaps and the empty run past the last entry.
 */
export function useMarqueeGate(hitTest: (localX: number, localY: number) => number | null) {
  const canBeginDragAt = useCallback((x: number, y: number) => hitTest(x, y) !== null, [hitTest]);
  const canStartMarqueeAt = useCallback((x: number, y: number) => hitTest(x, y) === null, [hitTest]);
  return { canBeginDragAt, canStartMarqueeAt };
}
