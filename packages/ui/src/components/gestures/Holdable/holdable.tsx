// A hold-only wrapper — the smallest interactive primitive in the library.
//
// `useHoldable` is the whole behaviour; this is that hook plus the elements it
// cannot render: a host `View` and the `GestureDetector` a hook cannot mount.
// Reach for the hook directly when the host must be something other than a
// plain `View`.
//
// The child may be a plain node or a render-prop receiving the current press
// state, which is how a child drives its own pressed or selected look without
// lifting state to the parent:
//
//   <Holdable onHold={() => select(id)}>
//     {({ isPressed, isHeld }) => (
//       <Chip pressed={isPressed} selected={isHeld} label={name} />
//     )}
//   </Holdable>

import type { ReactNode, Ref } from 'react';
import { View, type ViewProps } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import type { PressPhase } from '../press-timeline';
import { type UseHoldableOptions, useHoldable } from './use-holdable';

/** State passed to a render-prop child. */
export type HoldableState = {
  /** The hold has fired and the finger has not let go. */
  isHeld: boolean;
  /**
   * The press has committed — true from `armDelay` through the hold.
   * Use this for a pressed style rather than `phase === 'active'` directly, to
   * avoid dropping the pressed look the instant the hold fires.
   */
  isPressed: boolean;
  /** Raw phase, for consumers that need finer-grained branching. */
  phase: PressPhase;
};

export type HoldableProps = Omit<ViewProps, 'children' | 'ref'> &
  UseHoldableOptions & {
    children?: ReactNode | ((state: HoldableState) => ReactNode);
    ref?: Ref<View>;
  };

/**
 * Makes its child respond to a hold press, with a clean separation between the
 * scroll window (before `armDelay`), the pressed state (after it), and the hold
 * action (at `holdDelay`).
 *
 * ```tsx
 * <Holdable onHold={() => select(row.id)}>
 *   {({ isPressed }) => <Row pressed={isPressed} row={row} />}
 * </Holdable>
 * ```
 *
 * **No drag.** For a component that holds *and* drags, use `<HoldDraggable>`.
 *
 * **Thresholds.** The defaults hold on every platform (unlike `<Draggable>`,
 * which has no hold on web by default). Override with `behavior` — same shape as
 * `<Draggable behavior>`.
 *
 * **Accessibility.** Carries none: no role, no announcement. A hold is
 * touch-only and pointer-only — add a second path to the same outcome, such as
 * an `accessibilityActions` entry on the host.
 */
export function Holdable({
  behavior,
  children,
  className,
  disabled,
  onActive,
  onHold,
  onHoldEscape,
  onPhaseChange,
  ref,
  style,
  testID,
  ...viewProps
}: HoldableProps) {
  const hold = useHoldable({ behavior, disabled, onActive, onHold, onHoldEscape, onPhaseChange });

  const root = hold.getRootProps();
  const state: HoldableState = { isHeld: hold.isHeld, isPressed: hold.isPressed, phase: hold.phase };
  const resolvedChildren = typeof children === 'function' ? children(state) : children;

  const host = (
    <View ref={ref ?? root.ref} className={className} style={[root.style, style]} testID={testID} {...viewProps}>
      {resolvedChildren}
    </View>
  );

  return hold.gesture === null ? host : <GestureDetector gesture={hold.gesture}>{host}</GestureDetector>;
}
