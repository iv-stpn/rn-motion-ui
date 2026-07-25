import { describe, expect, it } from 'vitest';
import { FILE_TREE_SELECTION_MODES } from '../file-tree.types';
import { computeClickPlan } from '../file-tree-click-plan';

const base = (over: Partial<Parameters<typeof computeClickPlan>[0]> = {}) => ({
  path: 'src/index.ts',
  hasChildren: false,
  isSelected: false,
  selectionMode: FILE_TREE_SELECTION_MODES.Multiple,
  ...over,
});

describe('computeClickPlan', () => {
  it('chevron hit on a parent toggles expansion only, selection untouched', () => {
    const plan = computeClickPlan(base({ path: 'src/', hasChildren: true, modifiers: { viaChevron: true } }));
    expect(plan.selection).toEqual({ kind: 'none' });
    expect(plan.expansion).toEqual({ kind: 'toggle', path: 'src/' });
    expect(plan.focusPath).toBe('src/');
    expect(plan.openContextMenu).toBe(false);
  });

  it('chevron on a leaf falls through (no children to disclose)', () => {
    const plan = computeClickPlan(base({ modifiers: { viaChevron: true } }));
    expect(plan.selection).toEqual({ kind: 'replace', path: 'src/index.ts' });
  });

  it('right-click selects an unselected row then opens the menu', () => {
    const plan = computeClickPlan(base({ modifiers: { secondary: true } }));
    expect(plan.selection).toEqual({ kind: 'replace', path: 'src/index.ts' });
    expect(plan.expansion).toEqual({ kind: 'none' });
    expect(plan.openContextMenu).toBe(true);
  });

  it('right-click on an already-selected row keeps selection and opens the menu', () => {
    const plan = computeClickPlan(base({ isSelected: true, modifiers: { secondary: true } }));
    expect(plan.selection).toEqual({ kind: 'none' });
    expect(plan.openContextMenu).toBe(true);
  });

  it('selectionMode none still opens folders and moves focus, never selects', () => {
    const plan = computeClickPlan(base({ path: 'src/', hasChildren: true, selectionMode: 'none' }));
    expect(plan.selection).toEqual({ kind: 'none' });
    expect(plan.expansion).toEqual({ kind: 'toggle', path: 'src/' });
    expect(plan.focusPath).toBe('src/');
  });

  it('shift range only applies in multiple mode', () => {
    expect(computeClickPlan(base({ modifiers: { shift: true } })).selection).toEqual({
      kind: 'range',
      path: 'src/index.ts',
    });
    // single mode: shift degrades to a plain replace
    expect(computeClickPlan(base({ selectionMode: 'single', modifiers: { shift: true } })).selection).toEqual({
      kind: 'replace',
      path: 'src/index.ts',
    });
  });

  it('ctrl/meta toggle only applies in multiple mode', () => {
    expect(computeClickPlan(base({ modifiers: { ctrl: true } })).selection).toEqual({
      kind: 'toggle',
      path: 'src/index.ts',
    });
    expect(computeClickPlan(base({ modifiers: { meta: true } })).selection).toEqual({
      kind: 'toggle',
      path: 'src/index.ts',
    });
    expect(computeClickPlan(base({ selectionMode: 'single', modifiers: { ctrl: true } })).selection).toEqual({
      kind: 'replace',
      path: 'src/index.ts',
    });
  });

  it('plain activation replaces selection and toggles a directory when allowed', () => {
    const dir = computeClickPlan(base({ path: 'src/', hasChildren: true }));
    expect(dir.selection).toEqual({ kind: 'replace', path: 'src/' });
    expect(dir.expansion).toEqual({ kind: 'toggle', path: 'src/' });

    const noToggle = computeClickPlan(base({ path: 'src/', hasChildren: true, toggleExpandOnActivate: false }));
    expect(noToggle.expansion).toEqual({ kind: 'none' });

    const file = computeClickPlan(base());
    expect(file.expansion).toEqual({ kind: 'none' });
  });
});
