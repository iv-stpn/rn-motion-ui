import { act, createElement, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresenceContext } from '../../../../moti/presence/animate-presence-context';
import { ButtonDots } from '../button-internals';

const animation = vi.hoisted(() => ({
  repeat: vi.fn(() => -4),
  cancel: vi.fn(),
  values: Array<{ value: number }>(),
}));

vi.mock('react-native', () => ({ View: 'div', StyleSheet: { create: (styles: unknown) => styles } }));
vi.mock('react-native-svg', () => ({ default: 'svg', Circle: 'circle' }));
vi.mock('../../../../moti/components/view', () => ({ MotiView: 'div' }));
vi.mock('../../../typography/Text/text', () => ({ Text: 'span' }));
vi.mock('../../../../lib/ease', () => ({ EASE_IN_OUT: () => 0, EASE_OUT: () => 0 }));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'div' },
  Easing: { linear: () => 0 },
  cancelAnimation: animation.cancel,
  withRepeat: animation.repeat,
  withDelay: (_delay: number, value: number) => value,
  withTiming: (value: number) => value,
  useAnimatedStyle: () => ({}),
  useSharedValue: (initial: number) => {
    const shared = useRef<{ value: number } | null>(null);
    if (!shared.current) {
      shared.current = { value: initial };
      animation.values.push(shared.current);
    }
    return shared.current;
  },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const container = document.createElement('div');
let root = createRoot(container);

function render(reduce: boolean, isPresent = true) {
  act(() => {
    root.render(
      createElement(
        PresenceContext.Provider,
        { value: { isPresent, register: () => () => undefined, safeToUnmount: null } },
        createElement(ButtonDots, { color: 'currentColor', reduce }),
      ),
    );
  });
}

afterEach(() => {
  act(() => root.unmount());
  root = createRoot(container);
  vi.clearAllMocks();
  animation.values.length = 0;
});

describe('button loading dots', () => {
  it('cancels every animated value when unmounted mid-loading', () => {
    render(false);
    expect(animation.repeat).toHaveBeenCalledTimes(3);
    act(() => root.render(null));
    expect(animation.cancel).toHaveBeenCalledTimes(6);
    for (const value of animation.values) expect(animation.cancel).toHaveBeenCalledWith(value);
  });

  it('never starts a loop with reduced motion enabled', () => {
    render(true);
    expect(animation.repeat).not.toHaveBeenCalled();
    expect(animation.values.map(({ value }) => value)).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it('cancels running loops when reduced motion changes and restarts when disabled', () => {
    render(false);
    render(true);
    expect(animation.cancel).toHaveBeenCalledTimes(6);
    expect(animation.values.map(({ value }) => value)).toEqual([0, 1, 0, 1, 0, 1]);
    render(false);
    expect(animation.repeat).toHaveBeenCalledTimes(6);
  });

  it('stops loops as soon as presence exit starts', () => {
    render(false);
    render(false, false);
    expect(animation.cancel).toHaveBeenCalledTimes(6);
    expect(animation.repeat).toHaveBeenCalledTimes(3);
  });

  it('keeps the same loops across parent rerenders', () => {
    render(false);
    render(false);
    expect(animation.repeat).toHaveBeenCalledTimes(3);
    expect(animation.cancel).not.toHaveBeenCalled();
  });
});
