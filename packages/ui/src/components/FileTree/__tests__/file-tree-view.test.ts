import { describe, expect, it } from 'vitest';
import type { FileTreeSearchMode } from '../file-tree.types';
import { buildTree } from '../file-tree-tree';
import { computeVisibleRows } from '../file-tree-view';

const PATHS = ['src/components/Button.tsx', 'src/components/Input.tsx', 'src/index.ts', 'src/utils/format.ts', 'README.md'];
const LAST_SEGMENT_REGEX = /\/$/;

type RunOptions = { expanded?: string[]; flatten?: boolean; query?: string; mode?: FileTreeSearchMode };
function run(options: RunOptions): string[] {
  const roots = buildTree(PATHS);
  const rows = computeVisibleRows({
    roots,
    allPaths: PATHS.flatMap((p) => [p, ...ancestorsOf(p)]),
    expanded: new Set(options.expanded ?? []),
    selected: new Set(),
    focusedPath: null,
    flatten: options.flatten ?? true,
    searchQuery: options.query ?? '',
    searchMode: options.mode ?? 'expand-matches',
  });
  return rows.map((r) => r.path);
}

// Local ancestor helper so the view test doesn't depend on the controller.
function ancestorsOf(path: string): string[] {
  const segs = path.replace(LAST_SEGMENT_REGEX, '').split('/');
  const out: string[] = [];
  let acc = '';
  for (let i = 0; i < segs.length - 1; i += 1) {
    acc += `${segs[i]}/`;
    out.push(acc);
  }
  return out;
}

describe('computeVisibleRows — no search', () => {
  it('shows only expanded subtrees', () => {
    expect(run({})).toEqual(['src/', 'README.md']);
    expect(run({ expanded: ['src/'] })).toEqual(['src/', 'src/components/', 'src/utils/', 'src/index.ts', 'README.md']);
  });
});

describe('computeVisibleRows — search modes', () => {
  it('hide-non-matches keeps only the path to matches', () => {
    expect(run({ query: 'button', mode: 'hide-non-matches' })).toEqual(['src/', 'src/components/', 'src/components/Button.tsx']);
  });

  it('expand-matches force-expands ancestors but keeps every row', () => {
    const rows = run({ query: 'format', mode: 'expand-matches' });
    expect(rows).toContain('src/utils/format.ts');
    expect(rows).toContain('README.md');
    expect(rows).toContain('src/components/');
  });

  it('collapse-non-matches expands only ancestors of matches', () => {
    const rows = run({ expanded: ['src/', 'src/components/'], query: 'format', mode: 'collapse-non-matches' });
    // components/ has no match inside → collapsed; utils/ on the match path → open.
    expect(rows).toContain('src/utils/format.ts');
    expect(rows).not.toContain('src/components/Button.tsx');
  });
});
