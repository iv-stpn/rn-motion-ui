import { describe, expect, it } from 'vitest';
import { FILE_TREE_DEFAULT_ITEM_HEIGHT, indentForLevel, resolveDensityMetrics } from '../file-tree-density';

describe('resolveDensityMetrics', () => {
  it('maps each density to its row height', () => {
    expect(resolveDensityMetrics('compact').itemHeight).toBe(24);
    expect(resolveDensityMetrics('default').itemHeight).toBe(30);
    expect(resolveDensityMetrics('relaxed').itemHeight).toBe(36);
  });

  it('default height matches the exported constant', () => {
    expect(resolveDensityMetrics('default').itemHeight).toBe(FILE_TREE_DEFAULT_ITEM_HEIGHT);
  });
});

describe('indentForLevel', () => {
  it('scales indent by level and clamps negatives to zero', () => {
    const m = resolveDensityMetrics('default');
    expect(indentForLevel(0, m)).toBe(0);
    expect(indentForLevel(2, m)).toBe(2 * m.indentPerLevel);
    expect(indentForLevel(-3, m)).toBe(0);
  });
});
