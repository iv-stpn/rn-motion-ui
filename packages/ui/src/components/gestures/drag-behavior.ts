// What a press has to do to become a drag — as data, per platform.
//
// Pure and dependency-free so it can be unit-tested and read without pulling React
// or react-native in. The hook that resolves it against the running platform and the
// enclosing `<DragManager>` is `use-drag-behavior.ts`.
//
// Why this is configurable at all: the same four numbers cannot be right everywhere.
// A finger on a phone shares the surface with a scrolling list, so a drag has to wait
// its turn; a mouse on a desktop has a dedicated button for dragging and a separate
// gesture (right-click) for menus, so making it wait buys nothing and a hold that
// fires under it is a surprise. Android and iOS disagree about how far a resting
// finger drifts. None of that is knowable from inside a component.

/*
 * ── The three-phase press ──────────────────────────────────────────────────────
 *
 * One finger landing on a `<Draggable>` can mean three different things, and which
 * one it meant is not knowable until it has been down a while. So the press is read
 * in phases, and each field below is the boundary between two answers:
 *
 * ```
 *  0ms                 armDelay               holdDelay
 *   ├──────────────────────┼──────────────────────┼────────────────────▶
 *   │  move  → the scroll  │  move > slop         │  still holding?
 *   │  owns it, pan fails  │  → lift a drag       │  → onHold fires
 *   │                      │                      │    (then a move past
 *   │                      │                      │     escapeSlop still
 *   │                      │                      │     lifts one)
 * ```
 *
 * The point of the first window is that a list stays scrollable: a finger that
 * starts moving straight away is panning the surface, not picking an item up, and
 * the pan gives the gesture up rather than fight the `ScrollView` it is inside.
 *
 * The point of the second is that a drag and a hold are mutually exclusive *by
 * construction* rather than by two timers being set to the same number: a hold that
 * never moves cannot become a drag, so whatever else is watching the press keeps it.
 *
 * Both pan transports read the same resolved numbers, so a press means the same
 * thing on a phone's browser as it does in the app.
 */

/** iOS, and the floor for anything touch-first. */
const TOUCH_TUNING: DragTuning = { armDelay: 150, escapeSlop: 24, holdDelay: 300, slop: 10 };

/**
 * Android. Tighter than iOS because the platforms genuinely disagree: Android's
 * `ViewConfiguration` scaled touch slop is 8dp, where UIKit allows a long press
 * 10pt of drift. The escape bar scales with it.
 */
const ANDROID_TUNING: DragTuning = { armDelay: 150, escapeSlop: 20, holdDelay: 300, slop: 8 };

/**
 * Web, macOS and Windows — everywhere the pointer is a mouse by default.
 *
 * `holdDelay: null` is the difference that matters: a desktop already has a gesture
 * for "tell me about this thing", and it is the right button, not a wait. A hold
 * firing under a stationary mouse would be a surprise, and on web a long press on
 * touch is already the browser's own (text selection, its context menu). So a press
 * here only ever becomes a drag, and `onHold` never fires.
 *
 * The arm window stays, because web touch still shares the surface with the page's
 * scroll — this is what keeps a `<Draggable>` from hijacking a swipe in a mobile
 * browser. Set `armDelay: 0` for a board that does not scroll.
 */
const DESKTOP_TUNING: DragTuning = { armDelay: 150, escapeSlop: 24, holdDelay: null, slop: 10 };

const TUNING_BY_OS: Record<DragOS, DragTuning> = {
  android: ANDROID_TUNING,
  ios: TOUCH_TUNING,
  macos: DESKTOP_TUNING,
  web: DESKTOP_TUNING,
  windows: DESKTOP_TUNING,
};

/**
 * The same timeline for a press whose *point* is the hold — `<Holdable>`,
 * `<HoldDraggable>`.
 *
 * One field differs, on the three platforms where the pointer is a mouse: the hold
 * exists. `holdDelay: null` is the right default for a `<Draggable>` there, where a
 * hold firing under a stationary mouse is a surprise and the right button already
 * means "tell me about this thing" — but a component named for the hold that never
 * holds is not a default, it is a component that does nothing.
 *
 * A mouse still never triggers one: both transports that watch a `<Holdable>` filter
 * to touch, so what this turns on is the hold on a *phone's browser* — which is the
 * platform that has no right button to fall back to, and where a long press is the
 * only gesture that means this. See `use-holdable-pointer.ts`.
 */
const HOLD_TUNING_BY_OS: Record<DragOS, DragTuning> = {
  android: ANDROID_TUNING,
  ios: TOUCH_TUNING,
  macos: { ...DESKTOP_TUNING, holdDelay: 300 },
  web: { ...DESKTOP_TUNING, holdDelay: 300 },
  windows: { ...DESKTOP_TUNING, holdDelay: 300 },
};

/** The per-OS block that applies, or `undefined`. Exhaustive so a new `DragOS` fails here. */
function osOverride(behavior: DragBehavior, os: DragOS): Partial<DragTuning> | undefined {
  switch (os) {
    case 'android':
      return behavior.android;
    case 'ios':
      return behavior.ios;
    case 'macos':
      return behavior.macos;
    case 'web':
      return behavior.web;
    default:
      return behavior.windows;
  }
}

function merge(base: DragTuning, over: Partial<DragTuning> | undefined): DragTuning {
  if (over === undefined) return base;
  return {
    armDelay: over.armDelay ?? base.armDelay,
    escapeSlop: over.escapeSlop ?? base.escapeSlop,
    // Not `??`: `null` is a value here — "this platform has no hold" — and has to
    // survive the merge, where an absent field must not.
    holdDelay: over.holdDelay === undefined ? base.holdDelay : over.holdDelay,
    slop: over.slop ?? base.slop,
  };
}

/**
 * Flatten a behavior against one platform, from a given per-OS base table.
 *
 * The two exported resolvers below differ only in which table they start from, so the
 * merge order — default, flat fields, `native`, then the OS's own block — is written
 * once here and cannot drift between a drag's press and a hold's.
 */
function resolveBehavior(base: DragTuning, behavior: DragBehavior | undefined, os: DragOS): DragTuning {
  if (behavior === undefined) return base;
  // Listed rather than rested off the object, so adding a per-OS key above cannot
  // silently start leaking into the flat layer.
  const flat: Partial<DragTuning> = {
    armDelay: behavior.armDelay,
    escapeSlop: behavior.escapeSlop,
    holdDelay: behavior.holdDelay,
    slop: behavior.slop,
  };
  const withFlat = merge(base, flat);
  const withNative = os === 'web' ? withFlat : merge(withFlat, behavior.native);
  return merge(withNative, osOverride(behavior, os));
}

/** The platforms `Platform.OS` can report. `'native'` is a selector, not one of these. */
export type DragOS = 'android' | 'ios' | 'macos' | 'web' | 'windows';

export type DragTuning = {
  /**
   * How long the finger must be down before a move can lift a drag, in ms.
   *
   * Before this, movement belongs to whatever is scrolling underneath — so this is
   * the window in which a `<Draggable>` inside a list refuses to compete with the
   * list. Short enough that a deliberate grab does not feel laggy; long enough that
   * a flick to scroll is never mistaken for one. `0` opts out, which is right for a
   * board that does not scroll and wrong for a row in a `FlatList`.
   */
  armDelay: number;
  /**
   * How long the finger must be down, without a {@link slop} move, for the press to
   * be a hold — `<Draggable onHold>`. `null` means this platform has no hold at all:
   * no timer is armed, `onHold` never fires, and {@link escapeSlop} never applies.
   *
   * Past {@link armDelay} but short of this, a move lifts a drag and no hold ever
   * fires. Reach this still holding and the hold is what the press meant.
   *
   * 300ms rather than the 500ms both mobile platforms use for their own long press:
   * half a second is too slow to feel like a menu. That is this library's choice
   * rather than a platform convention, so it is the field most worth retuning.
   */
  holdDelay: number | null;
  /**
   * The travel that counts as "the finger is going somewhere", in px.
   *
   * Read twice, meaning the opposite thing each side of {@link armDelay}: before it,
   * this much travel means the gesture was a scroll and the pan gives up; after it,
   * this much means the drag lifts.
   */
  slop: number;
  /**
   * The travel that lifts a drag *after* {@link holdDelay} — the escape hatch out
   * from under whatever the hold opened.
   *
   * Larger than {@link slop}, and that is the whole point: by this stage there is a
   * menu (or a selection, or a preview) on screen that the hold just produced, and
   * the finger is still down on top of it. Escaping has to take a deliberate shove
   * rather than the drift of a hand that thought it had finished. Unused where
   * {@link holdDelay} is `null`.
   */
  escapeSlop: number;
};

/**
 * Per-OS overrides for the press timeline, in `Platform.select` vocabulary.
 *
 * Fields at the top level apply everywhere; a block applies only on its platform,
 * and `native` on everything except web. Later wins, so the order is: the built-in
 * default for this OS, then the flat fields, then `native`, then the OS's own block.
 *
 * ```tsx
 * <DragManager behavior={{ android: { slop: 12 }, armDelay: 100, ios: { holdDelay: 400 } }}>
 * ```
 */
export type DragBehavior = Partial<DragTuning> & {
  /** Every platform except web — the same set `Platform.select`'s `native` covers. */
  native?: Partial<DragTuning>;
  android?: Partial<DragTuning>;
  ios?: Partial<DragTuning>;
  macos?: Partial<DragTuning>;
  web?: Partial<DragTuning>;
  windows?: Partial<DragTuning>;
};

/**
 * What each platform does with no `behavior` at all.
 *
 * Touch platforms hold; desktop ones do not. Exported for docs and tests — a
 * consumer reading one number out of here is usually better served by
 * {@link resolveDragBehavior}, which applies their overrides too.
 */
export const DRAG_TUNING_DEFAULTS: Record<DragOS, DragTuning> = TUNING_BY_OS;

/**
 * What each platform does with no `behavior` at all, for a press whose point is the
 * hold — `<Holdable>` and `<HoldDraggable>`.
 *
 * Identical to {@link DRAG_TUNING_DEFAULTS} except that every platform holds, where
 * a bare drag holds only on touch. See {@link HOLD_TUNING_BY_OS} for why that is not
 * the same thing as a mouse hold firing.
 */
export const HOLD_TUNING_DEFAULTS: Record<DragOS, DragTuning> = HOLD_TUNING_BY_OS;

/**
 * Flatten a {@link DragBehavior} against one platform.
 *
 * Pure, and the whole of the platform decision: everything downstream reads the four
 * numbers this returns and never asks which OS it is on again.
 */
export function resolveDragBehavior(behavior: DragBehavior | undefined, os: DragOS): DragTuning {
  return resolveBehavior(TUNING_BY_OS[os], behavior, os);
}

/**
 * The same, from the hold defaults — for a component whose press is a hold first and
 * a drag second.
 *
 * Same vocabulary, same merge order, same overrides. The only difference is where it
 * starts from, which is the one honest way to express "this component holds on every
 * platform" without making every consumer write `{ web: { holdDelay: 300 } }`.
 */
export function resolveHoldBehavior(behavior: DragBehavior | undefined, os: DragOS): DragTuning {
  return resolveBehavior(HOLD_TUNING_BY_OS[os], behavior, os);
}
