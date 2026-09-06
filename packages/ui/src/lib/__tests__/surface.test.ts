import { describe, expect, it } from 'vitest';
import { glassSurface, surface } from '../surface';

describe('surface', () => {
  it('combines the elevation ladder with no radius by default', () => {
    expect(surface(3)).toBe('bg-surface-3 shadow-elevated-3');
    expect(surface(6)).toBe('bg-surface-6 shadow-elevated-6');
  });

  it('prepends the radius token when one is given', () => {
    expect(surface(3, 'card')).toBe('rounded-card bg-surface-3 shadow-elevated-3');
    expect(surface(3, 'menu')).toBe('rounded-menu bg-surface-3 shadow-elevated-3');
    expect(surface(3, 'modal')).toBe('rounded-modal bg-surface-3 shadow-elevated-3');
  });

  it('maps elevation 0 to the flat resting surface', () => {
    expect(surface(0)).toBe('bg-surface-3');
    expect(surface(0, 'card')).toBe('rounded-card bg-surface-3');
  });

  it('swaps the ladder shadow for the input halo when floating', () => {
    expect(surface(3, undefined, true)).toBe('bg-surface-3 shadow-floating');
    expect(surface(6, 'card', true)).toBe('rounded-card bg-surface-6 shadow-floating');
  });
});

describe('glassSurface', () => {
  it('keeps the elevation shadow but drops the opaque fill', () => {
    expect(glassSurface(3)).toBe('shadow-elevated-3');
    expect(glassSurface(6, 'card')).toBe('rounded-card shadow-elevated-6');
  });

  it('carries only the radius at elevation 0 — the flat glass is the tint alone', () => {
    expect(glassSurface(0)).toBe('');
    expect(glassSurface(0, 'menu')).toBe('rounded-menu');
  });

  it('swaps the ladder shadow for the input halo when floating', () => {
    expect(glassSurface(3, undefined, true)).toBe('shadow-floating');
  });
});
