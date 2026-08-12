// biome-ignore-all lint/style/noExcessiveLinesPerFile: previewRef field added for the ghost fix
// A drag, minus the markup.
//
// This is the whole of `<Draggable>` except the three elements it renders, so a
// consumer who wants different markup — a `Pressable` as the host, a row inside a
// `FlatList` that must not gain a wrapper `View`, a ghost drawn their own way — can
// have the same drag without the wrapper's opinions. `<Draggable>` is this hook plus
// a `View`, and there is nothing it can do that this cannot.
//
// What stays the hook's business: which transport runs, the press timeline, the
// session, the store registration, the measured rect the ghost is anchored to, and
// the handle. What becomes the caller's: every element, every class name, and the
// `GestureDetector` on native — a hook cannot render one, and `gesture` is what goes
// in it.

import {
  type ComponentProps,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, type LayoutChangeEvent, Platform, type View, type ViewStyle } from 'react-native';
import type {
  CollisionAlgorithm,
  DragAxis,
  DragEffectAllowed,
  DragEndEvent,
  DragGroups,
  DraggableHandle,
  DragMoveEvent,
  DragPoint,
  DragRect,
  DragStartEvent,
  DragTransfer,
} from '../drag.types';
import type { DragBehavior, DragTuning } from '../drag-behavior';
import { useDragScope } from '../drag-scope';
import type { PressPhase } from '../press-timeline';
import { useDragBehavior } from '../use-drag-behavior';
import { type PressTimeline, usePressTimeline } from '../use-press-timeline';
import { buildSession, type DraggableLiveProps, type DraggableSession } from './draggable-session';
import { useDraggableHtml5 } from './use-draggable-html5';
import { useDraggablePan } from './use-draggable-pan';
import { useDraggablePointer } from './use-draggable-pointer';

// react-native-web honours userSelect at runtime, but it is not in RN's ViewStyle.
type WebViewStyle = ViewStyle & { userSelect?: 'none' };

/**
 * Functional, not cosmetic: without it a web drag starting on text selects the text
 * instead of lifting. Which is why the hook still supplies this one style while
 * supplying no other — it is part of the gesture working, not part of how it looks.
 */
const WEB_HOST_STYLE: WebViewStyle = { userSelect: 'none' };

/**
 * Anchors the ghost to the host's top-left, which is what `ghostPos` is measured from.
 *
 * `pointerEvents` rides in the style rather than the prop of the same name: RN
 * deprecated the prop, and `'none'` — unlike `'box-none'` — is real CSS, so RNW's
 * inline-style path carries it through untouched.
 */
const GHOST_STYLE: ViewStyle = { left: 0, pointerEvents: 'none', position: 'absolute', top: 0 };

type UseTransportsParams = {
  cursorMode: boolean;
  effectAllowed: DragEffectAllowed;
  enabled: boolean;
  timeline: PressTimeline;
  nodeRef: RefObject<View | null>;
  /** Ref to the preview DOM element, set by the component for `setDragImage` under HTML5. */
  previewElementRef: RefObject<View | null>;
  session: DraggableSession;
  transports: DraggableTransports;
  tuning: DragTuning;
};

/**
 * Binds whichever transports `transports` allows, and returns the native pan's
 * gesture — `null` when there is none.
 *
 * The two web transports bind through effects and so return nothing; only the native
 * one is a value the caller needs. Grouped here because which of the three runs is
 * one decision made three ways, and reading it in one place is the only way to see
 * that a mouse and a finger on the same web page take different paths.
 */
function useTransports({
  cursorMode,
  effectAllowed,
  enabled,
  timeline,
  nodeRef,
  previewElementRef,
  session,
  transports,
  tuning,
}: UseTransportsParams) {
  // Both pans are "the touch one", so they share a flag: whichever platform this is
  // running on, only one of them can bind.
  const pan = enabled && (transports !== 'html5' || cursorMode);
  // When cursorMode is on, the pointer transport handles mouse events — disable
  // HTML5 to avoid two transports competing for the same mouse gesture.
  useDraggableHtml5({
    enabled: enabled && transports !== 'pan' && !cursorMode,
    nodeRef,
    overlayHostId: session.overlayHostId,
    previewElementRef,
    session,
    timeline,
  });
  useDraggablePointer({ cursorMode, effectAllowed, enabled: pan, nodeRef, session, timeline });
  return useDraggablePan({ effectAllowed, enabled: pan, session, timeline, tuning });
}

type UseDraggableHostParams = {
  dragBoundsRef?: RefObject<View>;
  enabled: boolean;
  live: DraggableLiveProps;
  preview: ReactNode;
};

/**
 * The host node and the session bound to it: the refs a drag mutates, the two bits
 * of render state it publishes, the measured rect the ghost is anchored to, and the
 * getters for the two elements that carry any of it.
 *
 * Split from {@link useDraggable} because it is a separable concern — everything
 * here is about *this component's* node and the drag lifted from it, and none of it
 * knows which transport is driving.
 */
function useDraggableHost({ dragBoundsRef, enabled, live, preview }: UseDraggableHostParams) {
  const id = useId();
  const scope = useDragScope();
  const nodeRef = useRef<View | null>(null);
  /** The DOM node the component renders the preview into — used by the HTML5 transport for `setDragImage`. */
  const previewElementRef = useRef<View | null>(null);
  const draggingRef = useRef(false);
  const transferRef = useRef<DragTransfer | null>(null);
  const grabRef = useRef<DragPoint>({ x: 0, y: 0 });
  const rectRef = useRef<DragRect | null>(null);
  const boundsRef = useRef<DragRect | null>(null);
  const ghostPos = useRef(new Animated.ValueXY()).current;
  const [showGhost, setGhost] = useState(false);
  const [isDragging, setDragging] = useState(false);

  // Live props for the session, which is built once: a callback identity that changes
  // every render must not tear down a drag in flight.
  const propsRef = useRef<DraggableLiveProps>({});
  propsRef.current = live;

  const previewRef = useRef<ReactNode>(preview);
  previewRef.current = preview;

  const { managerId, managerPath, overlayHostId } = scope;
  const session = useMemo(
    () =>
      buildSession({
        boundsRef,
        draggingRef,
        ghostPos,
        grabRef,
        id,
        managerId,
        managerPath,
        overlayHostId,
        previewRef,
        propsRef,
        rectRef,
        setDragging,
        setGhost,
        transferRef,
      }),
    [ghostPos, id, managerId, managerPath, overlayHostId],
  );

  const measure = useCallback(
    () =>
      new Promise<DragRect | null>((resolve) => {
        const node = nodeRef.current;
        if (!node) return resolve(null);
        node.measureInWindow((x, y, width, height) => resolve({ height, width, x, y }));
      }),
    [],
  );

  // Read the bounds view rect into `boundsRef` so `session.move()` can clamp against it.
  // Measured on host layout and at lift time; the bounds view and host typically move together.
  const measureBounds = useCallback(() => {
    const node = dragBoundsRef?.current;
    if (!node) {
      boundsRef.current = null;
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      boundsRef.current = { height, width, x, y };
    });
  }, [dragBoundsRef]);

  // The rect the ghost is anchored and sized to. Kept on a ref through layout so
  // `begin` has it synchronously — a lift cannot wait a microtask for a measure.
  const handleLayout = useCallback(() => {
    measure()
      .then((rect) => {
        rectRef.current = rect;
      })
      .catch(() => undefined);
    measureBounds();
  }, [measure, measureBounds]);

  const handle = useMemo<DraggableHandle>(
    () => ({
      cancel: () => session.finish({ commit: false, point: grabRef.current }),
      getNode: () => nodeRef.current,
      getTransfer: () => transferRef.current,
      isDragging: () => draggingRef.current,
      measure,
    }),
    [measure, session],
  );

  const getRootProps = useCallback(
    (): DraggableRootProps => ({
      onLayout: handleLayout,
      ref: nodeRef,
      style: enabled && Platform.OS === 'web' ? WEB_HOST_STYLE : undefined,
    }),
    [enabled, handleLayout],
  );

  const getGhostProps = useCallback(
    (): DraggableGhostProps => ({ style: [GHOST_STYLE, { transform: ghostPos.getTranslateTransform() }] }),
    [ghostPos],
  );

  return {
    getGhostProps,
    getRootProps,
    ghostPos,
    handle,
    isDragging,
    nodeRef,
    previewElementRef,
    previewRef,
    session,
    showGhost,
  };
}

/** Which transports may run. `'auto'` is the right answer unless you are working around one. */
export type DraggableTransports = 'auto' | 'html5' | 'pan';

/** Spread onto the element the gesture is measured and bound on. */
export type DraggableRootProps = {
  onLayout: (event: LayoutChangeEvent) => void;
  ref: RefObject<View | null>;
  /** The web text-selection guard, or `undefined` where it does not apply. Merge, don't replace. */
  style: ViewStyle | undefined;
};

/** Spread onto an `Animated.View` inside the host, when {@link UseDraggableReturn.showGhost}. */
export type DraggableGhostProps = {
  /**
   * Position, offset, and `pointerEvents: 'none'` — opacity, elevation and stacking
   * are yours. Merge rather than replace: the ghost sits under the finger that is
   * dragging it, so a ghost that takes pointer events eats its own drag.
   */
  style: ComponentProps<typeof Animated.View>['style'];
};

/** What `<GestureDetector>` takes, or `null` where this platform has no pan. */
export type DraggableGesture = ReturnType<typeof useDraggablePan>;

export type UseDraggableOptions = {
  /**
   * Per-OS overrides for the press timeline — the arm window, the hold deadline and
   * the two slops. Inherited from an enclosing `<DragManager behavior>` when omitted,
   * and resolved against the platform defaults either way, so
   * `{ web: { holdDelay: 300 } }` changes web and leaves native alone.
   *
   * The defaults already differ per OS — no hold on web, Android's tighter slop — so
   * reach for this to tune a surface, not to make the platforms agree. See
   * `resolveDragBehavior` for the resolution order and the default table.
   */
  behavior?: DragBehavior;
  /**
   * Algorithm used to decide whether this draggable is over a drop zone.
   *
   * - Unset (default): point-based hit test — the grab point must be inside the zone
   * - `'intersect'`: any overlap between the draggable rect and the zone rect
   * - `'contain'`: the entire draggable must be inside the zone
   * - `'center'`: the draggable's center point must be inside the zone
   */
  collisionAlgorithm?: CollisionAlgorithm;
  /**
   * The payload, MIME key to string — `{ 'application/json': JSON.stringify(x) }`.
   * Read back with `transfer.getData(mime)` in any of the callbacks, from a
   * `<Dragzone onDrop>`, or from `event.dataTransfer` in a plain HTML5 drop listener
   * when the HTML5 transport ran.
   */
  data?: Record<string, string>;
  /**
   * When true, a mouse left-button press on web runs the same hold-and-drag
   * timeline a touch press does — hold fires at `holdDelay`, and a drag past
   * `slop` lifts through the pointer transport instead of HTML5. Right-click is
   * never intercepted.
   *
   * When set, the HTML5 transport is disabled for this source (it would compete
   * with the pointer transport for the same mouse events).
   * @default false
   */
  cursorMode?: boolean;
  /**
   * Constrains dragging to a single axis.
   *
   * - `'x'`: horizontal movement only
   * - `'y'`: vertical movement only
   * - `'both'` (or unset): free movement in both directions
   */
  dragAxis?: DragAxis;
  /**
   * Reference to a View that defines the dragging boundaries. The draggable
   * item will be constrained within this view's bounds in window coordinates.
   *
   * Only meaningful for pan transports (touch on web, native). Not applicable
   * to HTML5 drags where the browser controls the cursor position.
   */
  dragBoundsRef?: RefObject<View>;
  /** Turns the drag off. Nothing binds, and no timeline runs. @default false */
  disabled?: boolean;
  /** What a drop may do with the payload. @default 'copy' */
  effectAllowed?: DragEffectAllowed;
  /**
   * Labels deciding which `<Dragzone>`s will have this drag: a zone takes it when
   * their groups intersect. Omit — on both sides — and everything matches
   * everything, which is the right default for a tree with one kind of drag in it.
   * Inherited from an enclosing `<DragManager>` when not given here.
   */
  groups?: DragGroups;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
  /**
   * Called whenever the press phase changes. Fires even when `trackPhase` is false,
   * so this is the low-overhead path for responding to phase transitions without
   * triggering a re-render on every one.
   */
  onPhaseChange?: (phase: PressPhase) => void;
  /**
   * The press was a hold, not a drag: it stayed down past the resolved `holdDelay`
   * without travelling `slop`. Open a menu here, toggle a selection, start a preview —
   * whatever a long press means for this child.
   *
   * Fired by both pan transports, so once on touch wherever touch happens, and never
   * by the HTML5 mouse transport (a mouse has no long press). Exclusive with a drag
   * by construction: this fires *or* the drag lifts, and only {@link onHoldEscape}
   * crosses from one to the other.
   *
   * Passing nothing is also what tells the transports this press has no hold in it at
   * all, which is why {@link UseDraggableReturn.tuning} reports `holdDelay: null`
   * without one however the behavior is configured. And note the platform defaults:
   * web has no hold to begin with, so an `onHold` there needs
   * `behavior={{ web: { holdDelay: 300 } }}` to ever fire.
   *
   * Why here rather than on a `Pressable` underneath: the pan is the only thing that
   * sees the whole press, so it is the only place a hold and a drag can be arbitrated.
   * A nested `onLongPress` racing this on its own timer is exactly the bug this
   * replaces — the two fire at different moments and neither knows about the other.
   */
  onHold?: () => void;
  /**
   * A drag took the gesture from a hold that had already fired — the finger kept
   * going, past `escapeSlop`, after {@link onHold}. Undo whatever the hold did: close
   * the menu it opened, dismiss the preview.
   *
   * Fires immediately before `onDragStart`, so the drag is starting either way; this
   * is notice, not a veto. Never fires without a preceding {@link onHold}.
   */
  onHoldEscape?: () => void;
  /**
   * What the ghost shows, when a pan transport draws one. Unused under HTML5, where
   * the browser draws its own drag image.
   */
  preview?: ReactNode;
  /** Names this source in the store, and derives the testIDs under it. */
  testID?: string;
  /**
   * Which transports may run. `'auto'` picks per pointer: HTML5 for a mouse, a pan
   * for touch. Pin it to `'pan'` to keep a drag inside the library — a uniform ghost,
   * no OS drag session — or to `'html5'` to opt a component out of touch dragging.
   * @default 'auto'
   */
  transports?: DraggableTransports;
  /**
   * When true, the current press phase is tracked as render state and returned as
   * `phase` / `isActive` / `isHeld`. Off by default to avoid per-frame re-renders in
   * list items that do not need it — use `onPhaseChange` for side-effects instead.
   * @default false
   */
  trackPhase?: boolean;
};

export type UseDraggableReturn = {
  /** Props for the ghost element. Only meaningful while {@link showGhost}. */
  getGhostProps: () => DraggableGhostProps;
  getRootProps: () => DraggableRootProps;
  /**
   * The native pan, or `null` on web and whenever the pan cannot run.
   *
   * Non-null means the host **must** be wrapped in a `<GestureDetector gesture={…}>`
   * or no native drag happens at all. A hook cannot render one, so this is the one
   * piece of markup the caller owes the drag.
   */
  gesture: DraggableGesture;
  /** The same imperative handle `<Draggable ref>` exposes. */
  handle: DraggableHandle;
  /**
   * True when at least one `<Draggable.Handle>` child is mounted inside this source.
   * The host's `GestureDetector` is suppressed while handles are present, so the drag
   * only lifts from the handle area.
   */
  hasHandle: boolean;
  /**
   * True while the press is active or held (`phase === 'active' || phase === 'hold'`).
   * Only live when `trackPhase` was true; idle otherwise.
   */
  isActive: boolean;
  /**
   * A drag is up from this source — the flag to style the source itself from, and
   * true under every transport, including the ones that draw nothing here.
   */
  isDragging: boolean;
  /**
   * True while a hold has fired and the finger is still down
   * (`phase === 'hold'`). Only live when `trackPhase` was true; idle otherwise.
   */
  isHeld: boolean;
  /**
   * The current press phase. Only tracks as render state when `trackPhase` was true;
   * always `'idle'` otherwise. Read the ref at `usePressTimeline` level for
   * zero-render phase checks.
   */
  phase: PressPhase;
  /**
   * Ref for the DOM element the component renders the preview into.
   * Used by the HTML5 transport to call `setDragImage` with a custom ghost
   * instead of the browser's default screenshot of the dragged element.
   * @internal
   */
  previewElementRef: RefObject<View | null>;
  /**
   * Ref to the live preview node the `<DragManager>` ghost draws.
   *
   * Updated by the consumer (e.g. `<HoldDraggable>`) during render.
   * @internal
   */
  previewRef: MutableRefObject<ReactNode>;
  /**
   * Callback a `<Draggable.Handle>` child calls on mount to announce itself. The
   * host suppresses its own `GestureDetector` when at least one handle is present.
   * @internal
   */
  registerHandle: (registered: boolean) => void;
  /**
   * This component is the one that has to draw the ghost: a pan transport is running
   * and no `<DragManager>` above it took the job. False under HTML5, where the
   * browser draws its own drag image, and false with a manager hosting the overlay.
   */
  showGhost: boolean;
  /**
   * The press timeline actually in force, resolved for this OS. `holdDelay` is `null`
   * when this platform has no hold, or when no `onHold` was given.
   */
  tuning: DragTuning;
};

/**
 * A drag with no markup attached.
 *
 * ```tsx
 * const drag = useDraggable({ data: { 'text/plain': item.id }, onHold: openMenu });
 * const { style, ...root } = drag.getRootProps();
 * const host = (
 *   <View {...root} style={[style, styles.row, drag.isDragging && styles.lifted]}>
 *     <Row item={item} />
 *     {drag.showGhost ? <Animated.View {...drag.getGhostProps()}>{ghost}</Animated.View> : null}
 *   </View>
 * );
 * return drag.gesture ? <GestureDetector gesture={drag.gesture}>{host}</GestureDetector> : host;
 * ```
 *
 * `<Draggable>` is exactly this plus that markup, so reach for the component unless
 * you need the host to be something other than a `View` — and reach for this when you
 * do. Everything else about a drag is the same either way: the transports, the
 * timeline, the store, the groups, the handle.
 *
 * **Accessibility.** Carries none: no role, no name, no announcement. A drag is
 * pointer-only on every platform, so whatever this enables **needs a second,
 * non-pointer path to the same outcome** — a menu item, a keyboard command.
 */
export function useDraggable(options: UseDraggableOptions = {}): UseDraggableReturn {
  const {
    behavior,
    collisionAlgorithm,
    cursorMode = false,
    data,
    disabled = false,
    dragAxis,
    dragBoundsRef,
    effectAllowed = 'copy',
    groups,
    preview,
    testID,
  } = options;
  const {
    onDragEnd,
    onDragMove,
    onDragStart,
    onHold,
    onHoldEscape,
    onPhaseChange,
    trackPhase = false,
    transports = 'auto',
  } = options;

  const scope = useDragScope();
  const resolved = useDragBehavior(behavior ?? scope.behavior);
  // No `onHold` means there is no hold in this press however long it lasts — so the
  // effective timeline has none, and both transports lift on the ordinary slop
  // throughout rather than raising the bar at a deadline nothing will fire on.
  // Keyed on the presence of the callback, not its identity: an inline arrow would
  // otherwise rebuild the native gesture on every render.
  const hasHold = onHold !== undefined;
  const tuning = useMemo(() => (hasHold ? resolved : { ...resolved, holdDelay: null }), [hasHold, resolved]);

  // Shared by both pans, so the hold lands at the same moment on either.
  const { timeline, phase } = usePressTimeline({ canDrag: true, onHold, onHoldEscape, onPhaseChange, track: trackPhase, tuning });

  // `groups` is resolved here rather than in the session, and the same way `<Dragzone>`
  // resolves its own: the manager's groups are a default this source may override, and
  // neither side can inherit at registration time without asking React where it sits.
  const live: DraggableLiveProps = {
    collisionAlgorithm,
    data,
    dragAxis,
    effectAllowed,
    groups: groups ?? scope.groups,
    onDragEnd,
    onDragMove,
    onDragStart,
    testID,
  };

  const enabled = !disabled;

  // When handle children are present, the host GestureDetector is suppressed and only
  // the Handle sub-component carries it — so the drag only starts from the handle area.
  // A counter rather than a boolean: multiple handles may coexist, and the host should
  // only regain its GestureDetector when the last one unmounts.
  const handleCountRef = useRef(0);
  const [hasHandle, setHasHandle] = useState(false);
  const registerHandle = useCallback((registered: boolean) => {
    handleCountRef.current += registered ? 1 : -1;
    setHasHandle(handleCountRef.current > 0);
  }, []);

  const host = useDraggableHost({ dragBoundsRef, enabled, live, preview });
  const gesture = useTransports({
    cursorMode,
    effectAllowed,
    enabled,
    nodeRef: host.nodeRef,
    previewElementRef: host.previewElementRef,
    session: host.session,
    timeline,
    transports,
    tuning,
  });

  return {
    getGhostProps: host.getGhostProps,
    getRootProps: host.getRootProps,
    gesture,
    handle: host.handle,
    hasHandle,
    isActive: phase === 'active' || phase === 'hold',
    isDragging: host.isDragging,
    isHeld: phase === 'hold',
    phase,
    /** Ref for the DOM element the component renders the preview into — used by HTML5 `setDragImage`. */
    previewElementRef: host.previewElementRef,
    previewRef: host.previewRef,
    registerHandle,
    showGhost: host.showGhost,
    tuning,
  };
}
