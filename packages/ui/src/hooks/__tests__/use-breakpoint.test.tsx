/**
 * Regression tests for useBreakpoint / useBreakpointAtLeast.
 *
 * The contract worth guarding is the *absence* of renders: a resize that does
 * not cross a tier edge must not re-render the consumer. Each test therefore
 * counts renders rather than only asserting the returned value.
 *
 * `Dimensions` is mocked so tests can emit `change` events synchronously.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type WindowDimensions = { width: number; height: number };
type DimensionsChange = { window: WindowDimensions };
type ChangeListener = (dims: DimensionsChange) => void;

type ProbeProps = { overrides?: Record<string, number> };
type AtLeastProbeProps = { value?: 'md' | 'lg' | number };

const listeners = new Set<ChangeListener>();
let currentWidth = 1024;

vi.mock('react-native', () => ({
  Dimensions: {
    get: () => ({ width: currentWidth, height: 800 }),
    addEventListener: (_event: string, listener: ChangeListener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
  },
}));

const { useBreakpoint, useBreakpointAtLeast } = await import('../use-breakpoint');

/** Sets the window width and notifies subscribers, wrapped in act(). */
function resizeTo(width: number) {
  currentWidth = width;
  React.act(() => {
    for (const listener of listeners) listener({ window: { width, height: 800 } });
  });
}

describe('useBreakpoint', () => {
  let container: HTMLDivElement;
  let root: Root;
  let renders: number;
  let seen: string[];

  function Probe({ overrides }: ProbeProps) {
    const breakpoint = useBreakpoint(overrides);
    renders += 1;
    seen.push(breakpoint);
    return null;
  }

  beforeEach(() => {
    currentWidth = 1024;
    listeners.clear();
    renders = 0;
    seen = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    React.act(() => root.unmount());
    container.remove();
  });

  it('reports the initial breakpoint on first render', () => {
    currentWidth = 800;
    React.act(() => root.render(<Probe />));
    expect(seen.at(-1)).toBe('md');
  });

  it('does not re-render when a resize stays inside the same tier', () => {
    currentWidth = 800;
    React.act(() => root.render(<Probe />));
    const baseline = renders;

    resizeTo(820);
    resizeTo(900);
    resizeTo(1023);

    expect(renders).toBe(baseline);
    expect(seen.at(-1)).toBe('md');
  });

  it('re-renders exactly once when a resize crosses an edge', () => {
    currentWidth = 800;
    React.act(() => root.render(<Probe />));
    const baseline = renders;

    resizeTo(1024);

    expect(renders).toBe(baseline + 1);
    expect(seen.at(-1)).toBe('lg');
  });

  it('tracks repeated crossings in both directions', () => {
    currentWidth = 800;
    React.act(() => root.render(<Probe />));

    resizeTo(1200);
    expect(seen.at(-1)).toBe('lg');
    resizeTo(500);
    expect(seen.at(-1)).toBe('base');
    resizeTo(700);
    expect(seen.at(-1)).toBe('sm');
  });

  it('picks up a width that changed between initial state and effect', () => {
    currentWidth = 500;
    React.act(() => {
      root.render(<Probe />);
      // Resize before effects flush — the effect re-reads Dimensions on mount.
      currentWidth = 1300;
    });
    expect(seen.at(-1)).toBe('xl');
  });

  it('does not re-subscribe for an inline overrides literal with unchanged values', () => {
    currentWidth = 800;
    React.act(() => root.render(<Probe overrides={{ md: 700 }} />));
    const subscriptions = listeners.size;

    // A fresh object each render must not accumulate listeners.
    React.act(() => root.render(<Probe overrides={{ md: 700 }} />));
    React.act(() => root.render(<Probe overrides={{ md: 700 }} />));

    expect(listeners.size).toBe(subscriptions);
  });

  it('re-resolves when the overrides values actually change', () => {
    currentWidth = 700;
    React.act(() => root.render(<Probe />));
    expect(seen.at(-1)).toBe('sm');

    React.act(() => root.render(<Probe overrides={{ md: 680 }} />));
    expect(seen.at(-1)).toBe('md');
  });

  it('removes its listener on unmount', () => {
    React.act(() => root.render(<Probe />));
    expect(listeners.size).toBe(1);
    React.act(() => root.unmount());
    expect(listeners.size).toBe(0);
  });
});

describe('useBreakpointAtLeast', () => {
  let container: HTMLDivElement;
  let root: Root;
  let renders: number;
  let seen: boolean[];

  function Probe({ value = 'md' }: AtLeastProbeProps) {
    const matches = useBreakpointAtLeast(value);
    renders += 1;
    seen.push(matches);
    return null;
  }

  beforeEach(() => {
    currentWidth = 1024;
    listeners.clear();
    renders = 0;
    seen = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    React.act(() => root.unmount());
    container.remove();
  });

  it('is inclusive at the edge', () => {
    currentWidth = 768;
    React.act(() => root.render(<Probe />));
    expect(seen.at(-1)).toBe(true);
  });

  it('does not re-render while the answer is unchanged', () => {
    currentWidth = 400;
    React.act(() => root.render(<Probe />));
    const baseline = renders;

    resizeTo(500);
    resizeTo(600);
    resizeTo(767);

    expect(renders).toBe(baseline);
    expect(seen.at(-1)).toBe(false);
  });

  it('flips once when the threshold is crossed', () => {
    currentWidth = 400;
    React.act(() => root.render(<Probe />));
    const baseline = renders;

    resizeTo(768);

    expect(renders).toBe(baseline + 1);
    expect(seen.at(-1)).toBe(true);
  });

  it('re-resolves when the threshold prop changes', () => {
    currentWidth = 800;
    React.act(() => root.render(<Probe value="md" />));
    expect(seen.at(-1)).toBe(true);

    React.act(() => root.render(<Probe value="lg" />));
    expect(seen.at(-1)).toBe(false);
  });

  it('accepts a raw pixel threshold', () => {
    currentWidth = 900;
    React.act(() => root.render(<Probe value={880} />));
    expect(seen.at(-1)).toBe(true);

    resizeTo(870);
    expect(seen.at(-1)).toBe(false);
  });
});
