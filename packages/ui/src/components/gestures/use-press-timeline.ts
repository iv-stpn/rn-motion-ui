// The two timers that turn a press into phases, and the one object every transport
// drives them through.
//
// Replaces the single hold timer this package used to have (`use-draggable-hold.ts`),
// for one reason: a hold was the only phase anything could observe, so nothing could
// render "the finger is down and committed, but has not held yet". That is the state a
// squeeze under the finger wants, and driving one from touch-down instead means a
// flick that scrolls the page squeezes for its first 150ms on the way past.
//
// Timers rather than anything derived: what these fire is React work — opening a menu,
// toggling a selection — so it has to land on the JS thread whichever transport is
// driving. The native pan reaches this from its worklets through `scheduleOnRN`; the
// two web transports call it directly. How long they wait, and whether they wait at
// all, is per-platform: see `drag-behavior.ts`.

import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { DragTuning } from './drag-behavior';
import { type PressMoveOutcome, type PressPhase, readPressMove } from './press-timeline';

export type PressTimelineCallbacks = {
  /**
   * The press committed: it survived `armDelay` without being taken by a scroll.
   *
   * The first phase worth rendering, and the one a pressed style belongs on. Fires
   * before {@link onHold} on every press that reaches one.
   */
  onActive?: () => void;
  /** Fired once, `holdDelay` after the press began, if nothing took the gesture first. */
  onHold?: () => void;
  /** Fired when a drag takes the gesture away from a hold that had already fired. */
  onHoldEscape?: () => void;
  /** Every phase transition, in order. Fires alongside the three above, never instead. */
  onPhaseChange?: (phase: PressPhase) => void;
};

export type PressTimeline = {
  /**
   * The finger went down. Arms the arm timer, and the hold timer after it.
   *
   * Replaces whatever was pending, so a fresh touch never inherits the previous
   * one's deadlines — and it is the only thing that forgets a hold that already
   * fired, because only a new press is new information.
   */
  press: () => void;
  /**
   * Read a move against the phase it arrived in — see `readPressMove`. Pure: the
   * caller decides what to do with the answer, and says so by calling {@link end}
   * or {@link lift}.
   */
  move: (travel: number) => PressMoveOutcome;
  /**
   * The press is over — the finger lifted, or a scroll took it. Cancels both
   * pending timers and goes back to `'idle'`, reporting nothing: nothing took the
   * gesture over, it simply ended.
   *
   * Deliberately does *not* forget that a hold fired. Only {@link press} does, so
   * an `end` arriving while the finger is still down — one finger of several
   * lifting, a cancelled touch — cannot leave {@link lift} unable to report the
   * escape it is there for.
   */
  end: () => void;
  /**
   * A drag is taking the gesture. Cancels both timers, moves to `'drag'`, and
   * reports `onHoldEscape` when a hold had already fired — the case where something
   * is on screen that the host now has to take back down.
   */
  lift: () => void;
  /**
   * The live phase, for a transport that has to decide something between renders.
   * Always current, unlike the returned render state, which a caller can opt out of.
   */
  phase: RefObject<PressPhase>;
};

export type UsePressTimelineParams = PressTimelineCallbacks & {
  /** Whether a lift is possible at all — `false` for a `<Holdable>`. See `readPressMove`. */
  canDrag: boolean;
  /**
   * Whether the returned `phase` is live render state.
   *
   * Off means the timeline still runs and every callback still fires; only the
   * re-render is skipped, and `phase` stays `'idle'`. Which is what keeps a list of
   * drag sources from re-rendering a row twice per press for a phase nothing reads.
   */
  track: boolean;
  /** The four thresholds, already resolved for this platform. Read live. */
  tuning: DragTuning;
};

export type UsePressTimelineReturn = {
  /** Stable for the life of the component — the transports capture it. */
  timeline: PressTimeline;
  /** The current phase as render state, or `'idle'` throughout when `track` is off. */
  phase: PressPhase;
};

/**
 * The press timeline for one component.
 *
 * {@link UsePressTimelineReturn.timeline} keeps its identity for the life of the
 * component, because the transports capture it — the native one into worklets that
 * are rebuilt only when the gesture is — so a new object per render would strand the
 * timers that are actually running. Every input is read live off a ref instead.
 */
export function usePressTimeline(params: UsePressTimelineParams): UsePressTimelineReturn {
  const armRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<PressPhase>('idle');
  /** Whether *this* press produced a hold. Outlives the `'hold'` phase — see `end`. */
  const heldRef = useRef(false);
  const [phase, setPhase] = useState<PressPhase>('idle');

  const latest = useRef(params);
  latest.current = params;

  // biome-ignore lint/plugin: clearing pending timers on unmount is imperative teardown, not data fetching
  useEffect(
    () => () => {
      if (armRef.current !== null) clearTimeout(armRef.current);
      if (holdRef.current !== null) clearTimeout(holdRef.current);
    },
    [],
  );

  const timeline = useMemo<PressTimeline>(() => {
    function clearTimers() {
      if (armRef.current !== null) clearTimeout(armRef.current);
      if (holdRef.current !== null) clearTimeout(holdRef.current);
      armRef.current = null;
      holdRef.current = null;
    }

    function goTo(next: PressPhase) {
      if (phaseRef.current === next) return;
      phaseRef.current = next;
      if (latest.current.track) setPhase(next);
      latest.current.onPhaseChange?.(next);
    }

    function fireHold() {
      holdRef.current = null;
      // A gesture that moved on, or ended, between the timer and this callback.
      if (phaseRef.current !== 'active') return;
      heldRef.current = true;
      goTo('hold');
      latest.current.onHold?.();
    }

    function becomeActive() {
      armRef.current = null;
      if (phaseRef.current !== 'pending') return;
      goTo('active');
      latest.current.onActive?.();
      const { onHold, tuning } = latest.current;
      // Nothing to report, or nowhere to report it: either way, arming a timer to
      // call nothing is how a component ends up holding an unmounted closure.
      if (tuning.holdDelay === null || !onHold) return;
      // Chained off the arm rather than armed alongside it, so the phases stay in
      // order however the two are tuned. Both deadlines are measured from the
      // press, so this is the remainder — clamped, because a `holdDelay` below
      // `armDelay` can only mean "hold as soon as the press commits".
      holdRef.current = setTimeout(fireHold, Math.max(0, tuning.holdDelay - tuning.armDelay));
    }

    return {
      end() {
        clearTimers();
        goTo('idle');
      },
      lift() {
        clearTimers();
        const wasHeld = heldRef.current;
        heldRef.current = false;
        goTo('drag');
        if (wasHeld) latest.current.onHoldEscape?.();
      },
      move(travel) {
        const { canDrag, tuning } = latest.current;
        return readPressMove({ canDrag, phase: phaseRef.current, thresholds: tuning, travel });
      },
      phase: phaseRef,
      press() {
        clearTimers();
        heldRef.current = false;
        goTo('pending');
        const { tuning } = latest.current;
        // Synchronously when the window is off: a board that does not scroll has
        // nothing to wait for, and a zero-delay timer would still cost a frame.
        if (tuning.armDelay <= 0) becomeActive();
        else armRef.current = setTimeout(becomeActive, tuning.armDelay);
      },
    };
  }, []);

  return { phase, timeline };
}
