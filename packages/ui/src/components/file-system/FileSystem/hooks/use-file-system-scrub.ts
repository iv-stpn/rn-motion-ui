/** biome-ignore-all lint/style/useExportsLast: the session and gesture hooks bookend the plain helpers they wrap */
// The mobile views' drag-to-multi-select scrub.
//
// Two cooperating pieces, split so the part the browser can run stays plain JS and
// the part that needs a real touch surface stays behind the same `Platform.OS` gate
// the other transports use:
//
// - `useFileSystemScrubSession` is the JS side. A view holds it once and threads the
//   three callbacks down to every checkbox. `begin` snapshots the selection and fixes
//   the scrub's mode from the entry the drag started on; `move` resolves the finger
//   to an entry and commits the contiguous run; `end` forgets the session. It is the
//   whole of the selection semantics, and it is RN-free so the reducer it drives
//   (`applyFileSystemDeselect`) stays unit-testable.
//
// - `useFileSystemScrubGesture` is the native transport, a bare `Gesture.Pan()` with
//   `manualActivation(true)` modeled on `use-draggable-pan.ts`. It only exists off
//   web — RNGH would demand a `GestureHandlerRootView` under react-native-web, which
//   this package refuses to require, and the mobile views are native-first anyway.

import { useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { type DragTuning, resolveDragBehavior } from '../../../gestures/drag-behavior';
import { runBetween } from '../logic/file-system-selection';
import type { FileSystemEntry } from '../types/file-system.types';

/** What the touch callbacks remember between frames, on a shared value because they are worklets. */
type ScrubArm = {
  /** The pan activated. The touch callbacks stop deciding anything from here. */
  active: boolean;
  /** Moved before the arm window, so this touch is a scroll and never activates. */
  failed: boolean;
  /** When the touch went down, against which the arm window is measured. */
  startAt: number;
  startX: number;
  startY: number;
};

const SCRUB_ARM_IDLE: ScrubArm = { active: false, failed: false, startAt: 0, startX: 0, startY: 0 };

/** The scrub session a view holds between the checkbox press and the release. */
type ScrubState = {
  /** The selection as it stood when the drag started, which every move measures against. */
  base: ReadonlySet<string>;
  /** The entry the drag started on — one end of the run. */
  startPath: string;
  /** Fixed for the whole drag by the start entry's state: select or deselect the run. */
  mode: 'add' | 'remove';
};

type ScrubGestureParams = { onStart: (x: number, y: number) => void; onMove: (x: number, y: number) => void; onEnd: () => void };

export type FileSystemScrubSessionParams = {
  /** The view's entries in layout order — what the run measures through. */
  orderedPaths: readonly string[];
  selectedPaths: ReadonlySet<string>;
  onMarquee: (covered: readonly string[], base: ReadonlySet<string> | null) => void;
  onDeselectMarquee: (covered: readonly string[], base: ReadonlySet<string>) => void;
  /** Maps the finger's window position to the entry under it, an over-drag past the
   *  top/bottom edge, or `null` on empty space between entries. */
  resolveItemAt: (x: number, y: number) => FileSystemScrubHit;
};

export type FileSystemScrubSession = {
  begin: (entry: FileSystemEntry) => void;
  move: (x: number, y: number) => void;
  end: () => void;
};

/**
 * What the finger resolved to for one scrub move: an entry, an over-drag past
 * either edge of the list/grid, or nothing (empty space between entries).
 */
export type FileSystemScrubHit = { kind: 'item'; path: string } | { kind: 'beyond'; side: 'above' | 'below' } | null;

/**
 * The run one scrub move commits. Over an entry it is the contiguous span from the
 * anchor to it; past an edge it is everything on the far side of the anchor, with
 * the anchor itself cancelled — the entry the drag began on is left out. `below`
 * spans the anchor to the end; `above` spans the start to the anchor.
 */
function resolveScrubRun(
  scrub: ScrubState,
  hit: NonNullable<FileSystemScrubHit>,
  orderedPaths: readonly string[],
): string[] | null {
  if (hit.kind === 'item') return runBetween(scrub.startPath, hit.path, orderedPaths);
  const startIndex = orderedPaths.indexOf(scrub.startPath);
  if (startIndex === -1) return null;
  return hit.side === 'below' ? orderedPaths.slice(startIndex + 1) : orderedPaths.slice(0, startIndex);
}

/**
 * The JS side of the scrub. The three callbacks are stable for the component's life —
 * they read the latest selection, ordering and resolver off a ref — so the native
 * gesture never has to rebuild mid-scrub.
 */
export function useFileSystemScrubSession(params: FileSystemScrubSessionParams): FileSystemScrubSession {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const scrubRef = useRef<ScrubState | null>(null);

  const begin = useCallback((entry: FileSystemEntry) => {
    const base = new Set(paramsRef.current.selectedPaths);
    const startPath = entry.path;
    // The Photos model: the start entry's state decides the whole drag. An unselected
    // start adds the run; a selected start removes it — so dragging over an
    // already-selected entry is how you clear a run without tapping each one.
    scrubRef.current = { base, startPath, mode: base.has(startPath) ? 'remove' : 'add' };
  }, []);

  const move = useCallback((x: number, y: number) => {
    const scrub = scrubRef.current;
    if (!scrub) return;
    const { orderedPaths, onMarquee, onDeselectMarquee, resolveItemAt } = paramsRef.current;
    const hit = resolveItemAt(x, y);
    if (!hit) return;
    const run = resolveScrubRun(scrub, hit, orderedPaths);
    if (!run) return;
    // Re-evaluating from `base` each move is what lets the finger drag back over a run
    // it just cleared and re-add it, instead of sticking to the first clear.
    if (scrub.mode === 'add') onMarquee(run, scrub.base);
    else onDeselectMarquee(run, scrub.base);
  }, []);

  const end = useCallback(() => {
    scrubRef.current = null;
  }, []);

  return { begin, move, end };
}

function buildScrubGesture(arm: SharedValue<ScrubArm>, tuning: DragTuning, { onStart, onMove, onEnd }: ScrubGestureParams) {
  // Read the two numbers out on the JS thread rather than inside the worklets — a
  // worklet capturing the whole `tuning` object would carry it to the UI runtime, and
  // these two are all the gesture needs. Same shape as `use-draggable-pan.ts`.
  const { armDelay, slop } = tuning;

  // Plain JS functions, passed to `scheduleOnRN` by the worklets below — declared
  // rather than inlined so the arguments stay named and typed, and so DEV stack
  // traces carry a name. The `onStart`/`onMove`/`onEnd` they close over are the
  // stable session callbacks (each checkbox pre-binds its own `onStart` to its entry).
  function beginJS(x: number, y: number) {
    onStart(x, y);
  }
  function moveJS(x: number, y: number) {
    onMove(x, y);
  }
  function endJS() {
    onEnd();
  }

  return Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((event) => {
      'worklet';
      // Fires again for every extra finger. Only the first starts the clock.
      if (arm.value.startAt !== 0) return;
      const touch = event.allTouches[0];
      if (!touch) return;
      arm.value = { active: false, failed: false, startAt: Date.now(), startX: touch.absoluteX, startY: touch.absoluteY };
    })
    .onTouchesMove((event, manager) => {
      'worklet';
      const state = arm.value;
      if (state.active || state.failed) return;
      const touch = event.allTouches[0];
      if (!touch) return;
      const travel = Math.hypot(touch.absoluteX - state.startX, touch.absoluteY - state.startY);
      const elapsed = Date.now() - state.startAt;
      // The arm window: before it, movement is the scroll's. A quick swipe on the
      // checkbox fails the pan so the `ScrollView` keeps it, and a still finger that
      // then moves past `slop` lifts the scrub.
      if (elapsed < armDelay) {
        if (travel > slop) {
          arm.value = { ...state, failed: true };
          manager.fail();
        }
        return;
      }
      if (travel > slop) manager.activate();
    })
    .onTouchesUp((event, manager) => {
      'worklet';
      // `numberOfTouches` on an up event is the count that remains, so anything
      // above zero means a finger is still down. A press that never lifted a scrub
      // is a tap — fail so the checkbox's `Pressable.onPress` still toggles.
      if (arm.value.active || event.numberOfTouches > 0) return;
      manager.fail();
    })
    .onStart(() => {
      'worklet';
      arm.value = { ...arm.value, active: true };
      // Calibrate from the touch-down position, not the activation position: the arm
      // only lifts once the finger has already travelled `slop`, and the touch-down is
      // the one point guaranteed to still sit on the checkbox the gesture is attached to.
      scheduleOnRN(beginJS, arm.value.startX, arm.value.startY);
    })
    .onUpdate(({ absoluteX, absoluteY }) => {
      'worklet';
      scheduleOnRN(moveJS, absoluteX, absoluteY);
    })
    .onEnd(({ absoluteX, absoluteY }) => {
      'worklet';
      // Commit the final position, then release. The last `onUpdate` already ran the
      // run for it, but this keeps a lift with no trailing move from under-reporting.
      scheduleOnRN(moveJS, absoluteX, absoluteY);
      scheduleOnRN(endJS);
    })
    .onFinalize(() => {
      'worklet';
      arm.value = SCRUB_ARM_IDLE;
      // Every path out reaches here, including a scroll that won the arm window, so
      // this is where a pending session is guaranteed to be dropped. Idempotent.
      scheduleOnRN(endJS);
    });
}

/**
 * The native scrub gesture, or `null` where there is none (web).
 *
 * Attach one to each checkbox while selection mode is on. The checkbox wraps itself in
 * a `GestureDetector` so the press that begins a scrub is, by construction, a press on
 * a checkbox — no hit-test gate needed. Once the pan activates it keeps streaming the
 * finger's position even after it leaves the 28px target, so the scrub spans the list.
 */
export function useFileSystemScrubGesture({ onStart, onMove, onEnd }: ScrubGestureParams) {
  const arm = useSharedValue<ScrubArm>(SCRUB_ARM_IDLE);
  const tuning = useMemo(() => resolveDragBehavior(undefined, Platform.OS), []);

  return useMemo(
    () => (Platform.OS === 'web' ? null : buildScrubGesture(arm, tuning, { onStart, onMove, onEnd })),
    [arm, tuning, onStart, onMove, onEnd],
  );
}
