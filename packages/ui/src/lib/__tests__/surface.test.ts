import { describe, expect, it } from 'vitest';
import { surface } from '../surface';

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
});
