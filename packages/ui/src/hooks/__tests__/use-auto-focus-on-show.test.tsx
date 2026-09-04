/**
 * Tests for useAutoFocusOnShow.
 *
 * The hook is the shim that turns a menu's `onShow` signal (iOS `Modal.onShow`)
 * into an imperative `focus()` on a ref'd element, so it is deliberately pure —
 * it never imports react-native, only React. That keeps it unit-testable here.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useAutoFocusOnShow } from '../use-auto-focus-on-show';
import { renderHook } from './render-hook';

type Focusable = { focus: () => void };
type ProbeProps = { ref: React.RefObject<Focusable | null> };
type Result = { onShow: () => void; focusOnShow: () => void };

describe('useAutoFocusOnShow', () => {
  it('focuses the ref when onShow fires', () => {
    const focus = vi.fn();
    const ref = React.createRef<Focusable>();
    ref.current = { focus };

    const { current, act } = renderHook<ProbeProps, Result>(({ ref: hookRef }) => useAutoFocusOnShow(hookRef), { ref });

    act(() => current.onShow());
    expect(focus).toHaveBeenCalledTimes(1);

    act(() => current.focusOnShow());
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it('is a no-op while the ref has no current element', () => {
    const ref = React.createRef<Focusable>();
    ref.current = null;

    const { current, act } = renderHook<ProbeProps, Result>(({ ref: hookRef }) => useAutoFocusOnShow(hookRef), { ref });

    expect(() => act(() => current.onShow())).not.toThrow();
    expect(() => act(() => current.focusOnShow())).not.toThrow();
  });
});
