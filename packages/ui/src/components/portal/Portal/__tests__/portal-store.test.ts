import { describe, expect, it } from 'vitest';
import { INITIAL_PORTAL_STATE, type PortalState, portalReducer } from '../portal-store';

/** A stand-in node — a string, the simplest valid `ReactNode`; the reducer only cares about identity. */
const NODE = 'node';

describe('register-host / deregister-host', () => {
  it('registers a host with an empty list', () => {
    const next = portalReducer(INITIAL_PORTAL_STATE, { type: 'register-host', hostName: 'root' });
    expect(next).toEqual({ root: [] });
  });

  it('is a no-op for an already-registered host', () => {
    const once = portalReducer(INITIAL_PORTAL_STATE, { type: 'register-host', hostName: 'root' });
    const twice = portalReducer(once, { type: 'register-host', hostName: 'root' });
    expect(twice).toBe(once);
  });

  it('deregisters a host without touching its siblings', () => {
    const registered = portalReducer({ root: [], extra: [] }, { type: 'register-host', hostName: 'root' });
    const next = portalReducer(registered, { type: 'deregister-host', hostName: 'extra' });
    expect(next).toEqual({ root: [] });
  });

  it('is a no-op when the host was never registered', () => {
    const next = portalReducer(INITIAL_PORTAL_STATE, { type: 'deregister-host', hostName: 'nope' });
    expect(next).toEqual({});
  });
});

describe('add-update-portal', () => {
  it('auto-registers the host and appends the entry', () => {
    const next = portalReducer(INITIAL_PORTAL_STATE, {
      type: 'add-update-portal',
      hostName: 'root',
      portalName: 'a',
      node: NODE,
    });
    expect(next.root).toEqual([{ name: 'a', node: NODE }]);
  });

  it('keeps entries in registration order', () => {
    let state = portalReducer(INITIAL_PORTAL_STATE, {
      type: 'add-update-portal',
      hostName: 'root',
      portalName: 'a',
      node: NODE,
    });
    state = portalReducer(state, { type: 'add-update-portal', hostName: 'root', portalName: 'b', node: NODE });
    expect((state.root ?? []).map((entry) => entry.name)).toEqual(['a', 'b']);
  });

  it('replaces the node in place rather than re-adding — the no-remount guarantee', () => {
    const added = portalReducer(INITIAL_PORTAL_STATE, {
      type: 'add-update-portal',
      hostName: 'root',
      portalName: 'a',
      node: NODE,
    });
    const replacement = 'replacement';
    const updated = portalReducer(added, {
      type: 'add-update-portal',
      hostName: 'root',
      portalName: 'a',
      node: replacement,
    });
    // Same slot (index 0), same name, new node — nothing else moved.
    expect(updated.root).toEqual([{ name: 'a', node: replacement }]);
  });

  it('updates one host without disturbing another', () => {
    const state: PortalState = { root: [{ name: 'a', node: NODE }], other: [{ name: 'b', node: NODE }] };
    const replacement = 'replacement';
    const next = portalReducer(state, {
      type: 'add-update-portal',
      hostName: 'other',
      portalName: 'b',
      node: replacement,
    });
    expect(next.root).toEqual([{ name: 'a', node: NODE }]);
    expect(next.other).toEqual([{ name: 'b', node: replacement }]);
  });
});

describe('remove-portal', () => {
  it('removes the named entry', () => {
    let state = portalReducer(INITIAL_PORTAL_STATE, {
      type: 'add-update-portal',
      hostName: 'root',
      portalName: 'a',
      node: NODE,
    });
    state = portalReducer(state, { type: 'add-update-portal', hostName: 'root', portalName: 'b', node: NODE });
    const next = portalReducer(state, { type: 'remove-portal', hostName: 'root', portalName: 'a' });
    expect(next.root).toEqual([{ name: 'b', node: NODE }]);
  });

  it('is a no-op for an unknown name', () => {
    const state: PortalState = { root: [{ name: 'a', node: NODE }] };
    const next = portalReducer(state, { type: 'remove-portal', hostName: 'root', portalName: 'b' });
    expect(next).toEqual(state);
  });

  it('is a no-op for an unregistered host', () => {
    const next = portalReducer(INITIAL_PORTAL_STATE, { type: 'remove-portal', hostName: 'root', portalName: 'a' });
    expect(next).toEqual({});
  });
});
