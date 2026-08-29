/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: the pan's three-phase decision is one worklet state machine — splitting buildPanGesture would scatter the arm logic it is the only reader of */
// The native transport: an RNGH pan armed by a hold and lifted by the move after it.
//
// Its own module rather than part of `draggable.tsx` because it is the one transport
// whose decision is a state machine: three phases, read from worklets, against the
// deadlines in `draggable-session.ts`. The two web transports sit beside it as
// `use-draggable-html5.ts` and `use-draggable-pointer.ts`, on the same shape — a
// hook that takes the session and binds itself.
//
// Everything here runs on the UI thread. `manualActivation` requires it:
// `GestureStateManager.activate()` writes gesture state through Reanimated's
// `setGestureState`, which warns and does nothing off the UI runtime, so the
// callbacks cannot be `.runOnJS(true)`. Everything that reaches the store — which is
// plain JS state — hops back with `scheduleOnRN`.
//
// That hop is always written *inside* the worklet. A plain function captured by a
// worklet crosses over as a Remote Function, which on the UI runtime is a guard that
// throws if called — so pre-wrapping one on the JS thread and calling the wrapper
// from a worklet fails at the first touch. `scheduleOnRN` is a worklet itself and
// takes the handle as its argument, which is the supported direction.

import { useMemo } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { DragEffectAllowed } from '../drag.types';
import type { DragTuning } from '../drag-behavior';
import { createDragTransfer } from '../drag-transfer';
import type { PressTimeline } from '../use-press-timeline';
import type { DraggableSession } from './draggable-session';

/** Only the fields the pan handlers read — RNGH's own event type varies by version. */
type PanEvent = { absoluteX: number; absoluteY: number };

/**
 * What the three-phase decision needs to remember between touch callbacks.
 *
 * On a shared value because those callbacks are worklets: the decision runs on the
 * UI thread, where a plain closure variable would be a different copy each frame.
 * Written whole rather than field by field — Reanimated does not propagate a
 * mutation of `value`'s interior.
 */
type PanArm = {
  /**
   * The pan activated and claimed the finger — the enclosing `ScrollView` can no
   * longer take the vertical movement. Distinct from {@link dragging}: the claim
   * happens as soon as the press commits, before the drag itself lifts.
   */
  active: boolean;
  /** A drag has actually lifted — `begin` ran and `onUpdate` is streaming the moves. */
  dragging: boolean;
  /** Travelled before `armDelay`, so this touch is a scroll and never arms. */
  failed: boolean;
  /** When the touch went down, against which both deadlines are measured. */
  startAt: number;
  startX: number;
  startY: number;
  /**
   * How many fingers are down behind this arm. `startAt` alone cannot say whether
   * the stream that set it is still alive: an Android `Modal` (the hold menu's
   * overlay) can take the window's touch stream away without the pan ever seeing
   * an up or a finalize, leaving `startAt` non-zero with no finger behind it. A
   * zero count while `startAt` is non-zero is that stale arm, and the next
   * touch-down reads it as a new press rather than as a second finger.
   */
  touches: number;
};

const PAN_ARM_IDLE: PanArm = { active: false, dragging: false, failed: false, startAt: 0, startX: 0, startY: 0, touches: 0 };

type PanGestureParams = {
  arm: SharedValue<PanArm>;
  effectAllowed: DragEffectAllowed;
  session: DraggableSession;
  /**
   * The JS-side phase machine: starts on touch-down, ends when the press does, and is
   * overruled by a lift. See `use-press-timeline.ts`.
   *
   * Which phase it is in is *not* read back here — the decision below is made off
   * elapsed time instead. See {@link PanGestureParams.tuning}.
   */
  timeline: PressTimeline;
  /**
   * The four thresholds, already resolved for this OS.
   *
   * Captured into the worklets rather than read off a shared value, so the higher
   * post-hold bar applies from the exact frame the hold lands: a number JS wrote on
   * touch-down would still be in flight to the UI thread. A `holdDelay` of `null`
   * means this platform has no hold, so there is nothing to escape from and
   * `slop` lifts throughout.
   */
  tuning: DragTuning;
};

/**
 * The pan itself.
 *
 * `manualActivation` rather than `activateAfterLongPress`, because that prop cannot
 * express this gesture: it flips the pan to ACTIVE off a timer with no regard for
 * whether the finger moved, and RNGH cancels the touches under an activating
 * handler — so a bare hold *became* a drag, and the press responder underneath had
 * its timer cleared before it could fire. Holding an entry in `<FileSystem draggable>`
 * could therefore never open its context menu. Deciding it here instead makes the
 * hold and the drag two outcomes of one arbiter rather than two timers that happen
 * to be set to similar numbers — see `drag-behavior.ts` for the phases.
 */
function buildPanGesture({ arm, effectAllowed, session, timeline, tuning }: PanGestureParams) {
  // Read out here rather than through `tuning` inside the worklets: a worklet
  // capturing one object would carry the whole of it across to the UI runtime on
  // every rebuild, and these four numbers are all it needs.
  const { armDelay, escapeSlop, holdDelay, slop } = tuning;

  // Plain JS functions, passed to `scheduleOnRN` by the worklets below. Declared
  // rather than inlined at each call site so the arguments stay named and typed, and
  // so DEV stack traces carry a name instead of `anonymous`.
  function beginJS(x: number, y: number) {
    session.begin({ point: { x, y }, transfer: createDragTransfer(effectAllowed), transport: 'pan' });
  }
  function moveJS(x: number, y: number) {
    session.move({ x, y });
  }
  function finishJS(x: number, y: number, commit: boolean) {
    // The cancel path checks first: a gesture the system took away (a scroll won,
    // the view unmounted) reaches `onFinalize` and never `onEnd`, so that is the
    // only place it can be ended — and the only one that can arrive twice.
    if (commit || session.isDragging()) session.finish({ commit, point: { x, y } });
  }

  // Read off the timeline out here so the worklets carry three function handles rather
  // than the whole object — `phase` is a ref, and nothing on the UI thread can read it.
  const { end: endPress, lift: liftPress, press: startPress } = timeline;

  return (
    Gesture.Pan()
      .manualActivation(true)
      .onTouchesDown((event) => {
        'worklet';
        // Fires again for every extra finger. Only the first one starts the clock:
        // a second finger landing at 400ms must not restart a deadline the first one
        // already passed, nor re-arm a hold that has fired. `startAt` is the marker —
        // `onFinalize` puts it back to 0 — and `touches` says how many fingers are
        // behind it. A non-zero `startAt` with fingers down is the live stream, and
        // gets counted, not re-armed. A non-zero `startAt` with *zero* fingers is a
        // stale arm: the previous stream vanished without an up, a cancel or a
        // finalize (an Android Modal can take the window's touches away from under
        // the held row), so this touch is a new press and falls through to arm fresh
        // — overwriting the stale arm is the reset.
        if (arm.value.startAt !== 0 && arm.value.touches > 0) {
          arm.value = { ...arm.value, touches: event.allTouches.length };
          return;
        }
        const touch = event.allTouches[0];
        if (!touch) return;
        arm.value = {
          active: false,
          dragging: false,
          failed: false,
          startAt: Date.now(),
          startX: touch.absoluteX,
          startY: touch.absoluteY,
          touches: event.allTouches.length,
        };
        scheduleOnRN(startPress);
      })
      .onTouchesMove((event, manager) => {
        'worklet';
        const state = arm.value;
        // Once the drag has lifted, the pan's own update stream carries the moves;
        // once the arm window ended in a scroll, nothing here can revive it.
        if (state.dragging || state.failed) return;
        const touch = event.allTouches[0];
        if (!touch) return;
        const travel = Math.hypot(touch.absoluteX - state.startX, touch.absoluteY - state.startY);
        const elapsed = Date.now() - state.startAt;
        if (elapsed < armDelay) {
          // Moved before the pan armed: the finger is scrolling. Fail explicitly so
          // RNGH stops tracking it rather than leaving a pan behind a scroll that
          // has already started, and end the press with it.
          if (travel > slop) {
            arm.value = { ...state, failed: true };
            scheduleOnRN(endPress);
            manager.fail();
          }
          return;
        }
        // Past the arm window the press has committed: claim the gesture so the
        // enclosing `ScrollView` cannot take the vertical movement from here. The
        // claim precedes the lift — a held item dragged straight down must lift,
        // not scroll — and it is what makes the pan win the direction the scroll
        // would otherwise have claimed.
        if (!state.active) {
          arm.value = { ...state, active: true };
          manager.activate();
        }
        // Past the hold deadline the bar rises: something the hold put on screen is
        // under the finger now, so escaping it takes a shove rather than a drift.
        // Derived from elapsed time rather than read back off the JS thread — a flag
        // JS set when the timer fired would still be in flight for a frame or two.
        const lift = holdDelay !== null && elapsed >= holdDelay ? escapeSlop : slop;
        if (travel > lift) {
          arm.value = { ...arm.value, dragging: true };
          // Lift before begin, so a menu the hold opened is on its way out in the
          // same batch the ghost appears in — and a hold still pending never fires
          // behind a drag that has already started.
          scheduleOnRN(liftPress);
          scheduleOnRN(beginJS, touch.absoluteX, touch.absoluteY);
        }
      })
      .onTouchesUp((event, manager) => {
        'worklet';
        // `numberOfTouches` on an up event is the count that remains, so anything
        // above zero means a finger is still down and the press is not over. The
        // count is mirrored onto the arm so a stream that later vanishes without a
        // finalize is recognised as gone by the next touch-down.
        arm.value = { ...arm.value, touches: event.numberOfTouches };
        if (arm.value.active || event.numberOfTouches > 0) return;
        // A press that never lifted a drag: nothing to pan. Ending it releases the
        // recognizer instead of leaving it BEGAN until the next touch. The timeline is
        // ended rather than lifted — a finger let go has not overruled anything, so
        // whatever the hold opened stays open.
        scheduleOnRN(endPress);
        manager.fail();
      })
      .onTouchesCancelled((_event, manager) => {
        'worklet';
        // A cancelled stream is gone — the touches that armed this pan are not coming
        // back, and on an Android Modal the finalize that should have cleaned up never
        // fires either. Zeroing the count is what lets the next touch-down see the
        // stale arm (`startAt` non-zero, no fingers) and re-arm instead of treating
        // itself as a second finger of a dead press. Ending the press drops any
        // pending timeline timer, so a hold cannot fire behind a stream that no longer
        // exists. Skipped while a drag is active: the pan owns the move there, and its
        // own finalize is what should end it.
        if (arm.value.startAt !== 0 && !arm.value.active) {
          arm.value = { ...arm.value, touches: 0 };
          scheduleOnRN(endPress);
          manager.fail();
        }
      })
      // Activation is the claim, not the lift: the pan is activated the moment the
      // press commits (see `onTouchesMove`) to take the finger off the enclosing
      // scroll, and the drag itself lifts there on the move past `slop`/`escapeSlop`.
      .onStart(() => {
        'worklet';
        arm.value = { ...arm.value, active: true };
      })
      .onUpdate(({ absoluteX, absoluteY }: PanEvent) => {
        'worklet';
        // Between the claim and the lift the pan is active but not dragging yet —
        // those moves are the escape in progress, not a drag to stream.
        if (!arm.value.dragging) return;
        scheduleOnRN(moveJS, absoluteX, absoluteY);
      })
      .onEnd(({ absoluteX, absoluteY }: PanEvent) => {
        'worklet';
        scheduleOnRN(finishJS, absoluteX, absoluteY, true);
      })
      .onFinalize(({ absoluteX, absoluteY }: PanEvent) => {
        'worklet';
        const wasActive = arm.value.active;
        arm.value = PAN_ARM_IDLE;
        // Every path out of the gesture reaches here, including the ones that never
        // reached a touch callback, so this is where a pending timer is guaranteed to
        // be dropped. Idempotent, which is what lets the touch handlers end too.
        scheduleOnRN(endPress);
        if (wasActive) scheduleOnRN(finishJS, absoluteX, absoluteY, false);
      })
  );
}

export type UseDraggablePanParams = Omit<PanGestureParams, 'arm'> & {
  /** Off when `disabled`, or when `transports` rules the pan out. */
  enabled: boolean;
};

/**
 * The gesture to wrap the host in, or `null` when this platform has no pan.
 *
 * `null` on web, where a finger is the pointer transport's business and RNGH would
 * additionally demand a `GestureHandlerRootView` this package refuses to require.
 */
export function useDraggablePan({ effectAllowed, enabled, session, timeline, tuning }: UseDraggablePanParams) {
  const arm = useSharedValue<PanArm>(PAN_ARM_IDLE);

  // `tuning` is captured into the worklets rather than read live, so the wider
  // post-hold bar applies from the frame the hold lands. Both it and `timeline` are
  // stable across renders, so this rebuilds the gesture only on a real change.
  return useMemo(
    () => (Platform.OS === 'web' || !enabled ? null : buildPanGesture({ arm, effectAllowed, session, timeline, tuning })),
    [arm, effectAllowed, enabled, session, timeline, tuning],
  );
}
