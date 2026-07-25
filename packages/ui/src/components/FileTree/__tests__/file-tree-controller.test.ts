import { describe, expect, it, vi } from 'vitest';
import { FileTreeController } from '../file-tree-controller';

const PATHS = ['src/components/Button.tsx', 'src/components/Input.tsx', 'src/index.ts', 'src/utils/format.ts', 'README.md'];

function pathsOf(c: FileTreeController): string[] {
  return c.getVisibleRows().map((r) => r.path);
}

describe('FileTreeController construction + expansion seeding', () => {
  it('defaults to closed: only top-level rows show', () => {
    const c = new FileTreeController({ paths: PATHS });
    // flatten default true; src/ has >1 child so it is not flattened away.
    expect(pathsOf(c)).toEqual(['src/', 'README.md']);
  });

  it("initialExpansion 'open' expands every directory", () => {
    const c = new FileTreeController({ paths: PATHS, initialExpansion: 'open' });
    expect(pathsOf(c)).toEqual([
      'src/',
      'src/components/',
      'src/components/Button.tsx',
      'src/components/Input.tsx',
      'src/utils/',
      'src/utils/format.ts',
      'src/index.ts',
      'README.md',
    ]);
  });

  it('numeric initialExpansion expands directories shallower than N', () => {
    const c = new FileTreeController({ paths: PATHS, initialExpansion: 1 });
    // depth 0 dirs (src/) expand; depth 1 dirs (src/components/) do not.
    expect(pathsOf(c)).toEqual(['src/', 'src/components/', 'src/utils/', 'src/index.ts', 'README.md']);
  });
});

describe('FileTreeController expansion mutations', () => {
  it('expand / collapse / toggle emit and change rows', () => {
    const c = new FileTreeController({ paths: PATHS });
    c.expand('src/');
    expect(pathsOf(c)).toContain('src/components/');
    c.collapse('src/');
    expect(pathsOf(c)).toEqual(['src/', 'README.md']);
    c.toggleExpanded('src/');
    expect(pathsOf(c)).toContain('src/index.ts');
  });

  it('expandAll / collapseAll', () => {
    const c = new FileTreeController({ paths: PATHS });
    c.expandAll();
    expect(pathsOf(c).length).toBeGreaterThan(2);
    c.collapseAll();
    expect(pathsOf(c)).toEqual(['src/', 'README.md']);
  });

  it('revealPath expands all ancestors of a deep path', () => {
    const c = new FileTreeController({ paths: PATHS });
    c.revealPath('src/components/Button.tsx');
    expect(pathsOf(c)).toContain('src/components/Button.tsx');
  });
});

describe('FileTreeController selection', () => {
  it('single mode replaces selection and moves focus', () => {
    const c = new FileTreeController({ paths: PATHS, selectionMode: 'single', initialExpansion: 'open' });
    c.applySelection('src/index.ts');
    c.applySelection('README.md');
    expect(c.getSelectedPaths()).toEqual(['README.md']);
    expect(c.getFocusedPath()).toBe('README.md');
  });

  it('multiple mode: additive toggles, range selects a run', () => {
    const c = new FileTreeController({ paths: PATHS, selectionMode: 'multiple', initialExpansion: 'open' });
    c.applySelection('src/components/Button.tsx');
    c.applySelection('src/components/Input.tsx', { additive: true });
    expect(new Set(c.getSelectedPaths())).toEqual(new Set(['src/components/Button.tsx', 'src/components/Input.tsx']));
    // toggle off — additive click moves the anchor to Input even on deselect
    c.applySelection('src/components/Input.tsx', { additive: true });
    expect(c.getSelectedPaths()).toEqual(['src/components/Button.tsx']);
    // range from the current anchor (Input) down to utils/format; range-select
    // replaces the selection with the contiguous run.
    c.applySelection('src/utils/format.ts', { range: true });
    expect(c.getSelectedPaths()).toEqual(['src/components/Input.tsx', 'src/utils/', 'src/utils/format.ts']);
  });

  it('none mode ignores selection but still moves focus', () => {
    const c = new FileTreeController({ paths: PATHS, selectionMode: 'none' });
    c.applySelection('README.md');
    expect(c.getSelectedPaths()).toEqual([]);
    expect(c.getFocusedPath()).toBe('README.md');
  });

  it('narrowing to single mode collapses a multi-selection', () => {
    const c = new FileTreeController({ paths: PATHS, selectionMode: 'multiple', initialExpansion: 'open' });
    c.applySelection('src/index.ts');
    c.applySelection('README.md', { additive: true });
    c.setSelectionMode('single');
    expect(c.getSelectedPaths().length).toBe(1);
  });

  it('setSelection / clearSelection filter to live paths', () => {
    const c = new FileTreeController({ paths: PATHS, selectionMode: 'multiple' });
    c.setSelection(['README.md', 'does/not/exist.ts']);
    expect(c.getSelectedPaths()).toEqual(['README.md']);
    c.clearSelection();
    expect(c.getSelectedPaths()).toEqual([]);
  });
});

describe('FileTreeController focus movement', () => {
  it('moveFocus walks the visible list and clamps at the ends', () => {
    const c = new FileTreeController({ paths: PATHS, initialExpansion: 'open' });
    const rows = pathsOf(c);
    expect(c.moveFocus(1)).toBe(rows[0]);
    expect(c.moveFocus(1)).toBe(rows[1]);
    expect(c.moveFocus(-5)).toBe(rows[0]);
    expect(c.moveFocus(999)).toBe(rows.at(-1));
  });
});

describe('FileTreeController search', () => {
  it('hide-non-matches removes non-matching rows', () => {
    const c = new FileTreeController({ paths: PATHS });
    c.setSearch('button', 'hide-non-matches');
    expect(pathsOf(c)).toEqual(['src/', 'src/components/', 'src/components/Button.tsx']);
  });

  it('expand-matches reveals matches without removing rows', () => {
    const c = new FileTreeController({ paths: PATHS });
    c.setSearch('format', 'expand-matches');
    const rows = pathsOf(c);
    expect(rows).toContain('src/utils/format.ts');
    expect(rows).toContain('README.md');
  });

  it('clearing the query restores the pre-search view', () => {
    const c = new FileTreeController({ paths: PATHS });
    c.setSearch('button', 'hide-non-matches');
    c.setSearch('', 'hide-non-matches');
    expect(pathsOf(c)).toEqual(['src/', 'README.md']);
  });
});

describe('FileTreeController git rollups', () => {
  it('rolls a file status up into its ancestor directories', () => {
    const c = new FileTreeController({
      paths: PATHS,
      gitStatus: { 'src/components/Button.tsx': 'M', 'README.md': 'A' },
    });
    expect(c.gitStatusFor('src/components/Button.tsx')).toBe('M');
    expect(c.gitStatusFor('src/components/')).toBe('M');
    expect(c.gitStatusFor('src/')).toBe('M');
    expect(c.gitStatusFor('README.md')).toBe('A');
    expect(c.gitStatusFor('src/index.ts')).toBeNull();
  });
});

describe('FileTreeController subscription', () => {
  it('bumps version and notifies listeners on mutation', () => {
    const c = new FileTreeController({ paths: PATHS });
    const listener = vi.fn();
    const unsub = c.subscribe(listener);
    const v0 = c.getVersion();
    c.expand('src/');
    expect(c.getVersion()).toBe(v0 + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    c.collapse('src/');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('getVisibleRows is referentially stable within a version', () => {
    const c = new FileTreeController({ paths: PATHS });
    const a = c.getVisibleRows();
    const b = c.getVisibleRows();
    expect(a).toBe(b);
    c.expand('src/');
    expect(c.getVisibleRows()).not.toBe(a);
  });
});

describe('FileTreeController setPaths', () => {
  it('rebuilds the tree and prunes stale expansion/selection', () => {
    const c = new FileTreeController({ paths: PATHS, selectionMode: 'multiple' });
    c.expand('src/');
    c.setSelection(['README.md']);
    c.setPaths(['docs/guide.md']);
    // Old expansion + selection referenced paths that no longer exist → pruned.
    expect(pathsOf(c)).toEqual(['docs/']);
    expect(c.getSelectedPaths()).toEqual([]);
    expect(c.getExpandedPaths()).toEqual([]);
  });
});
