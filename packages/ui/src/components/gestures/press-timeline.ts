// What a press has become, and what a move through it should do — as data.
//
// Pure and dependency-free, for the same two reasons `drag-behavior.ts` is: the
// arithmetic is the part worth unit-testing, and nothing in this package that
// imports react-native can be tested at all. The hook that runs it against real
// timers is `use-press-timeline.ts`; the thresholds it reads are resolved by
// `resolveDragBehavior` / `resolveHoldBehavior` next door.
//
// Every press in this package — a `<Draggable>`, a `<Holdable>`, a
// `<HoldDraggable>` — runs this one machine, so a finger means the same thing
// whichever of them it landed on.

/*
 * ── The phases ─────────────────────────────────────────────────────────────────
 *
 * ```
 *  down              armDelay            holdDelay
 *   ├──── pending ──────┼───── active ───────┼───── hold ─────────────▶
 *   │                   │                    │
 *   │ a move > slop     │ a move > slop      │ a move > escapeSlop
 *   │ is the scroll's:  │ lifts a drag       │ lifts a drag, and takes
 *   │ give the gesture  │ (or, with nothing  │ back whatever the hold
 *   │ up                │ to drag, ends it)  │ put on screen
 * ```
 *
 * `pending` is the window that keeps a list scrollable: a finger that starts
 * moving straight away is panning the surface, not picking anything up, so the
 * gesture gives itself up rather than fight the `ScrollView` it is inside.
 *
 * `active` is the press having committed — past the scroll's claim on it, and the
 * first phase worth rendering. It is what a squeeze under the finger should be
 * driven from: start one at touch-down instead and a flick that scrolls the page
 * still squeezes for its first 150ms.
 *
 * `hold` and `drag` are the two outcomes, and they are exclusive *by construction*
 * rather than by two timers set to similar numbers: a hold that never moved cannot
 * become a drag, and a move past `escapeSlop` is the one crossing between them.
 */

/**
 * Where a press is in the timeline above.
 *
 * `'idle'` covers both "nothing is happening" and "the last press is over" — a
 * released finger goes back to it, so this is render state a component can drive a
 * pressed style from without also having to know when to clear one.
 *
 * `'drag'` is only ever reached by a press that had something to drag. A
 * `<Holdable>` never reports it.
 */
export type PressPhase = 'idle' | 'pending' | 'active' | 'hold' | 'drag';

/** Whether a phase is one the finger is still down for. */
export function isPressTracking(phase: PressPhase): boolean {
  return phase !== 'idle';
}

/**
 * What the caller should do about a move.
 *
 * - `'ignore'` — the finger has not travelled far enough to mean anything yet.
 * - `'scrolled'` — this press belongs to whatever is scrolling underneath (or, with
 *   nothing to drag, has been shoved off). End it.
 * - `'lift'` — start the drag.
 */
export type PressMoveOutcome = 'ignore' | 'scrolled' | 'lift';

/** The two distances a move is read against. Both come off a resolved `DragTuning`. */
export type PressMoveThresholds = {
  /** Travel that means "the finger is going somewhere". */
  slop: number;
  /** The higher bar that applies once a hold has fired. Unread when it has not. */
  escapeSlop: number;
};

export type ReadPressMoveParams = {
  /**
   * Whether a lift is even possible. `false` for a `<Holdable>`, which has nothing
   * to drag — so the same shove that would lift a drag ends the press instead.
   */
  canDrag: boolean;
  phase: PressPhase;
  thresholds: PressMoveThresholds;
  /** Distance from where the finger landed, in px. */
  travel: number;
};

/**
 * Read one move against the phase it arrived in.
 *
 * Keyed on the phase rather than on elapsed time, because the phase is the answer
 * the timers have already computed — asking the clock again is how two parts of one
 * gesture end up disagreeing about which side of a deadline they are on. (The native
 * pan's worklets are the exception, and have to be: they run on the UI thread, where
 * a phase JS wrote a frame ago is still in flight. See `use-draggable-pan.ts`.)
 */
export function readPressMove({ canDrag, phase, thresholds, travel }: ReadPressMoveParams): PressMoveOutcome {
  switch (phase) {
    // Before the press committed, travel belongs to the scroll — whether or not
    // there is anything here to drag.
    case 'pending':
      return travel > thresholds.slop ? 'scrolled' : 'ignore';
    case 'active':
      if (travel <= thresholds.slop) return 'ignore';
      return canDrag ? 'lift' : 'scrolled';
    // The hold has fired, so something is on screen underneath the finger and the
    // bar rises: escaping takes a deliberate shove, not the drift of a hand that
    // thought it had finished. With nothing to escape *to*, the hold simply keeps
    // the press — which is what makes a held menu stay open under a resting thumb.
    case 'hold':
      return canDrag && travel > thresholds.escapeSlop ? 'lift' : 'ignore';
    // 'idle' (nothing is tracking) and 'drag' (the transport owns the move now).
    default:
      return 'ignore';
  }
}
