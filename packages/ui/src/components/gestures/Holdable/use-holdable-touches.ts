// The native press observer: an RNGH pan that watches a press and never takes it.
//
// The whole gesture is the three touch callbacks. `manualActivation(true)` with no
// `manager.activate()` anywhere means this handler never becomes ACTIVE — and RNGH
// only cancels the touches under an *activating* handler, so a `ScrollView` above
// and a `Pressable` below both keep the press they would have had. That is the
// property the whole primitive rests on: a `<Holdable>` observes without competing.
//
// (`Gesture.Manual()` is the more literal name for "watch the touches, decide
// nothing". `Pan` is what `use-draggable-pan.ts` already runs, so it is the one this
// package has debugged, and the two behave identically while never activating.)
//
// Everything here runs on the UI thread, and every hop back to JS is written inside
// the worklet: a plain function captured by a worklet crosses as a Remote Function,
// which on the UI runtime is a guard that throws. `scheduleOnRN` takes the handle as
// an argument, which is the supported direction. Same constraint, same shape, as the
// draggable pan next door.

import { useMemo } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { DragTuning } from '../drag-behavior';
import type { PressTimeline } from '../use-press-timeline';

/**
 * What the touch callbacks remember between frames.
 *
 * On a shared value because they are worklets: a plain closure variable would be a
 * different copy on the UI runtime. Written whole rather than field by field —
 * Reanimated does not propagate a mutation of `value`'s interior.
 */
type TouchTrip = {
  /** Travelled too far, or already ended. Stops the move handler deciding twice. */
  done: boolean;
  /** When the first finger landed. 0 means nothing is being tracked. */
  startAt: number;
  startX: number;
  startY: number;
};

const TRIP_IDLE: TouchTrip = { done: false, startAt: 0, startX: 0, startY: 0 };

type BuildParams = {
  timeline: PressTimeline;
  trip: SharedValue<TouchTrip>;
  /**
   * The thresholds, captured into the worklets rather than read off a shared value.
   *
   * The phase decision has to be made here rather than deferred to
   * `timeline.move()`, because a worklet cannot read the JS phase ref and
   * `scheduleOnRN` has no return value. So this mirrors the elapsed-time arithmetic
   * `readPressMove` does off the phase — see the note there. Both sides read this
   * same resolved object, so the numbers cannot drift; only the way they are reached
   * differs, and only because one of them is on the wrong thread to ask.
   */
  tuning: DragTuning;
};

function buildTouchGesture({ timeline, trip, tuning }: BuildParams) {
  // Read out here so each worklet carries three numbers rather than the whole
  // object across to the UI runtime on every rebuild.
  const { holdDelay, slop } = tuning;
  const { end: endPress, press: startPress } = timeline;

  return Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((event) => {
      'worklet';
      // Fires again for every extra finger. Only the first starts the clock: a
      // second finger landing at 400ms must not restart a deadline the first one
      // already passed, nor re-arm a hold that has fired.
      if (trip.value.startAt !== 0) return;
      const touch = event.allTouches[0];
      if (!touch) return;
      trip.value = { done: false, startAt: Date.now(), startX: touch.absoluteX, startY: touch.absoluteY };
      scheduleOnRN(startPress);
    })
    .onTouchesMove((event) => {
      'worklet';
      const state = trip.value;
      if (state.done || state.startAt === 0) return;
      const touch = event.allTouches[0];
      if (!touch) return;
      const elapsed = Date.now() - state.startAt;
      // Once the hold has fired nothing a finger does ends the press but letting go.
      // There is no drag here to escape *to*, so the shove that would lift one in a
      // `<HoldDraggable>` means nothing — which is what keeps a held menu open under a
      // thumb that is still resting on the item that opened it. `readPressMove`
      // returns `'ignore'` for exactly this case; `escapeSlop` goes unread in this
      // transport for the same reason.
      //
      // Read off elapsed time rather than the JS phase because this is the UI thread:
      // a phase JS wrote when its timer fired would still be in flight for a frame or
      // two, and the bar has to change on the frame the hold lands.
      if (holdDelay !== null && elapsed >= holdDelay) return;
      const travel = Math.hypot(touch.absoluteX - state.startX, touch.absoluteY - state.startY);
      if (travel <= slop) return;
      // Before `armDelay` this is the scroll's press; after it, with nothing here to
      // drag, it is a shove off the item. Either way the press is over — which is
      // exactly what `readPressMove` returns `'scrolled'` for.
      trip.value = { ...state, done: true };
      scheduleOnRN(endPress);
    })
    .onTouchesUp((event) => {
      'worklet';
      // `numberOfTouches` on an up event is what remains, so anything above zero
      // means a finger is still down and the press is not over.
      if (event.numberOfTouches > 0) return;
      trip.value = { ...trip.value, done: true };
      scheduleOnRN(endPress);
    })
    .onFinalize(() => {
      'worklet';
      trip.value = TRIP_IDLE;
      // Every path out reaches here, including the ones that never saw a touch
      // callback, so this is where a pending timer is guaranteed to be dropped.
      // Idempotent, which is what lets the handlers above end too.
      scheduleOnRN(endPress);
    });
}

export type UseHoldableTouchesParams = {
  /** Off when `disabled`, and always off on web — the pointer transport has it there. */
  enabled: boolean;
  /** Stable for the life of the component, so listing it as a dependency is free. */
  timeline: PressTimeline;
  tuning: DragTuning;
};

/**
 * The gesture to wrap the host in, or `null` where there is none.
 *
 * `null` on web, where a finger belongs to `use-holdable-pointer.ts` and RNGH would
 * additionally demand a `GestureHandlerRootView` under react-native-web.
 */
export function useHoldableTouches({ enabled, timeline, tuning }: UseHoldableTouchesParams) {
  const trip = useSharedValue<TouchTrip>(TRIP_IDLE);

  return useMemo(
    () => (Platform.OS === 'web' || !enabled ? null : buildTouchGesture({ timeline, trip, tuning })),
    [enabled, timeline, trip, tuning],
  );
}
