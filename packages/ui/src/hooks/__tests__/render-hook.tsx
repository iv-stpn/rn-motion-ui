/**
 * A minimal `renderHook` for the calendar hooks.
 *
 * The repo has no testing-library dependency, so this follows the same
 * `createRoot` + `React.act` pattern `use-breakpoint.test.tsx` uses by hand, and
 * only adds what testing a return value (rather than a render count) needs: the
 * latest result, and a way to re-render with new props.
 *
 * Not a `.test.tsx`, so vitest treats it as a module rather than a suite.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

// React's documented precondition for `act`. Without it, an update that schedules
// another update inside the same `act` — a field commit that sets a range, whose
// change handler then closes a panel — is reported as unwrapped, because React
// cannot tell a test's nested update from a stray one in production code.
// Assigned through `Object.assign` because the flag is not on `globalThis`'s type
// and this repo disallows `as` casts.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** A mounted hook: its latest return value, plus the levers a test needs. */
export type HookHarness<P, R> = {
  /** The value from the most recent render. Throws if read before mounting. */
  readonly current: R;
  /** How many times the probe has rendered — for asserting the *absence* of renders. */
  readonly renders: number;
  /** Runs `fn` inside `act`, so state updates flush before the next assertion. */
  act: (fn: () => void) => void;
  /** Re-renders with new props, as a parent passing changed props would. */
  rerender: (props: P) => void;
  unmount: () => void;
};

/**
 * Mounts `hook` in a real root and returns a handle on its result.
 *
 * The container is attached to the document because focus only moves for nodes
 * that are actually in it, and the day cells' focus behaviour is part of the
 * contract under test.
 */
export function renderHook<P extends object, R>(hook: (props: P) => R, initialProps: P): HookHarness<P, R> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  const state: { result: { value: R } | null; renders: number } = { result: null, renders: 0 };

  function Probe(props: P) {
    // Assigned during render rather than in an effect, so `current` is already
    // the latest value by the time `act` returns.
    state.result = { value: hook(props) };
    state.renders += 1;
    return null;
  }

  const render = (props: P) => {
    React.act(() => {
      root.render(<Probe {...props} />);
    });
  };

  render(initialProps);

  return {
    get current() {
      if (state.result === null) throw new Error('renderHook: the hook has not rendered yet');
      return state.result.value;
    },
    get renders() {
      return state.renders;
    },
    act: (fn) => {
      React.act(fn);
    },
    rerender: render,
    unmount: () => {
      React.act(() => root.unmount());
      container.remove();
    },
  };
}
