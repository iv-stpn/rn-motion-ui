import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dismissToast,
  getToastDefaults,
  getToasts,
  resetToastStore,
  setToastDefaults,
  showToast,
  TOAST_DURATION_DEFAULT,
  toast,
} from '../toast-store';

describe('toast-store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetToastStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('appends a toast with defaults and returns its id', () => {
    const id = showToast('hello');

    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]?.message).toBe('hello');
    expect(getToasts()[0]?.variant).toBe('default');
    expect(getToasts()[0]?.position).toBe('bottom');
    expect(getToasts()[0]?.duration).toBe(TOAST_DURATION_DEFAULT);
    expect(getToasts()[0]?.glass).toBe(false);
    expect(id).toBe('toast-1');
  });

  it('auto-dismisses after the default duration', () => {
    showToast('hello');
    expect(getToasts()).toHaveLength(1);

    vi.advanceTimersByTime(TOAST_DURATION_DEFAULT);
    expect(getToasts()).toHaveLength(0);
  });

  it('honours a 0 duration by never auto-dismissing', () => {
    showToast('sticky', { duration: 0 });

    vi.advanceTimersByTime(TOAST_DURATION_DEFAULT * 10);
    expect(getToasts()).toHaveLength(1);
  });

  it('fires onClose when a toast is dismissed', () => {
    const onClose = vi.fn();
    const id = showToast('one', { onClose });

    dismissToast(id);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('variant helpers set the matching variant', () => {
    toast.success('ok');
    toast.error('bad');
    toast.warning('careful');
    toast.info('fyi');

    expect(getToasts().map((t) => t.variant)).toEqual(['success', 'error', 'warning', 'info']);
  });

  it('dismiss(id) removes only that toast', () => {
    const id = showToast('one');
    showToast('two');

    dismissToast(id);
    expect(getToasts().map((t) => t.message)).toEqual(['two']);
  });

  it('dismiss() removes every toast', () => {
    showToast('one');
    showToast('two');

    dismissToast();
    expect(getToasts()).toHaveLength(0);
  });

  it('setToastDefaults changes the fallbacks new toasts use', () => {
    setToastDefaults({ position: 'top', duration: 1000, glass: true });

    expect(getToastDefaults()).toEqual({ position: 'top', duration: 1000, glass: true });
    showToast('x');
    expect(getToasts()[0]?.position).toBe('top');
    expect(getToasts()[0]?.duration).toBe(1000);
    expect(getToasts()[0]?.glass).toBe(true);
  });

  it('a per-toast glass option overrides the default', () => {
    setToastDefaults({ glass: true });
    showToast('frosted');
    showToast('solid', { glass: false });

    expect(getToasts().map((t) => t.glass)).toEqual([true, false]);
  });
});
