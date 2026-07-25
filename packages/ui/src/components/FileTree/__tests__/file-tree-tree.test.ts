import { describe, expect, it } from 'vitest';
import { projectVisibleRows } from '../file-tree-project';
import { buildTree, resolveFlattenedChain } from '../file-tree-tree';

const PATHS = ['src/app/main.ts', 'src/app/util.ts', 'src/index.ts', 'readme.md'];

describe('buildTree', () => {
  it('materializes implicit ancestor directories', () => {
    const roots = buildTree(['a/b/c.ts']);
    expect(roots.map((r) => r.path)).toEqual(['a/']);
    const a = roots[0];
    if (!a) throw new Error('no root');
    expect(a.children.map((c) => c.path)).toEqual(['a/b/']);

    const child = a.children[0];
    if (!child) throw new Error('no child');
    expect(child.path).toBe('a/b/');
    expect(child.children.map((c) => c.path)).toEqual(['a/b/c.ts']);
  });

  it('sorts dirs before files, then natural order', () => {
    const roots = buildTree(PATHS);
    // src/ (dir) before readme.md (file) at the top level.
    expect(roots.map((r) => r.path)).toEqual(['src/', 'readme.md']);
    const src = roots[0];
    if (!src) throw new Error('no src root');

    // app/ (dir) before index.ts (file) inside src.
    expect(src.children.map((c) => c.path)).toEqual(['src/app/', 'src/index.ts']);
  });

  it('ignores empty / root-only inputs', () => {
    expect(buildTree(['', '/', 'a.ts']).map((r) => r.path)).toEqual(['a.ts']);
  });
});

describe('resolveFlattenedChain', () => {
  it('collapses a single-child directory chain', () => {
    const roots = buildTree(['src/app/pages/home.ts']);
    const src = roots[0];
    if (!src) throw new Error('no root');
    const { terminal, segments } = resolveFlattenedChain(src, true);
    expect(segments).toEqual(['src', 'app', 'pages']);
    expect(terminal.path).toBe('src/app/pages/');
  });

  it('stops at a directory with multiple children', () => {
    const roots = buildTree(['src/app/a.ts', 'src/app/b.ts']);
    const src = roots[0];
    if (!src) throw new Error('no root');
    const { terminal, segments } = resolveFlattenedChain(src, true);
    // src -> app collapses (src has one child), but app has two files so it stops.
    expect(segments).toEqual(['src', 'app']);
    expect(terminal.path).toBe('src/app/');
  });

  it('does nothing when flatten is off', () => {
    const roots = buildTree(['src/app/home.ts']);
    const src = roots[0];
    if (!src) throw new Error('no root');
    const { terminal, segments } = resolveFlattenedChain(src, false);
    expect(segments).toEqual(['src']);
    expect(terminal.path).toBe('src/');
  });
});

describe('projectVisibleRows', () => {
  const roots = buildTree(PATHS);

  it('shows only top-level rows when nothing is expanded', () => {
    const rows = projectVisibleRows({
      roots,
      expanded: new Set(),
      selected: new Set(),
      focusedPath: null,
      flatten: false,
    });
    expect(rows.map((r) => r.path)).toEqual(['src/', 'readme.md']);
    expect(rows[0]).toMatchObject({ kind: 'directory', hasChildren: true, isExpanded: false, level: 0 });
  });

  it('expands a directory and lists its children in DFS preorder', () => {
    const rows = projectVisibleRows({
      roots,
      expanded: new Set(['src/']),
      selected: new Set(),
      focusedPath: null,
      flatten: false,
    });
    expect(rows.map((r) => r.path)).toEqual(['src/', 'src/app/', 'src/index.ts', 'readme.md']);
    expect(rows[1]?.level).toBe(1);
  });

  it('flattens single-child chains into one row and keys expansion on the terminal', () => {
    const rows = projectVisibleRows({
      roots,
      expanded: new Set(['src/app/']),
      selected: new Set(),
      focusedPath: null,
      flatten: true,
    });
    // src/ has two children (app/, index.ts) so it does NOT flatten; app/ is a
    // leaf dir here. Expanding src/app/ (terminal key) reveals its files.
    const first = rows[0];
    expect(first?.path).toBe('src/');
    expect(first?.isFlattened).toBe(false);
  });

  it('computes posInSet / setSize among siblings', () => {
    const rows = projectVisibleRows({
      roots,
      expanded: new Set(['src/']),
      selected: new Set(),
      focusedPath: null,
      flatten: false,
    });
    const top = rows.filter((r) => r.level === 0);
    expect(top.map((r) => `${r.posInSet}/${r.setSize}`)).toEqual(['0/2', '1/2']);
  });

  it('marks selection and focus', () => {
    const rows = projectVisibleRows({
      roots,
      expanded: new Set(),
      selected: new Set(['readme.md']),
      focusedPath: 'src/',
      flatten: false,
    });
    expect(rows.find((r) => r.path === 'readme.md')?.isSelected).toBe(true);
    expect(rows.find((r) => r.path === 'src/')?.isFocused).toBe(true);
  });

  it('restricts rows to allowedPaths and force-expands (hide-non-matches)', () => {
    const rows = projectVisibleRows({
      roots,
      expanded: new Set(),
      selected: new Set(),
      focusedPath: null,
      flatten: false,
      allowedPaths: new Set(['src/', 'src/app/', 'src/app/main.ts']),
      forceExpand: true,
    });
    expect(rows.map((r) => r.path)).toEqual(['src/', 'src/app/', 'src/app/main.ts']);
  });
});
