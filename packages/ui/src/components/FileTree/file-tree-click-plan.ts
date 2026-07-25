// Pure interaction planner. Translates one row activation — from a web pointer
// (with Ctrl/Cmd/Shift/right-click), a keyboard, or a touch gesture (tap /
// long-press, pre-mapped to modifiers by the render layer) — into the selection
// and expansion intents the controller should apply. RN-free + tested.
//
// Keeping this pure means the touch model and the web modifier model converge on
// a single, verifiable decision table instead of branching inside the view.

import type { FileTreeSelectionMode } from './file-tree.types';

/** Raw modifiers captured at activation time. */
export type ClickModifiers = {
  /** Ctrl (Win/Linux) — additive toggle. */
  ctrl?: boolean;
  /** Cmd (macOS) — additive toggle. */
  meta?: boolean;
  /** Shift — contiguous range from the anchor. */
  shift?: boolean;
  /** Right-click / secondary — open context actions. */
  secondary?: boolean;
  /** The hit landed on the disclosure chevron, not the row body. */
  viaChevron?: boolean;
};

export type ClickPlanInput = {
  path: string;
  hasChildren: boolean;
  isSelected: boolean;
  selectionMode: FileTreeSelectionMode;
  modifiers?: ClickModifiers;
  /** Whether activating a directory row body also toggles its expansion. */
  toggleExpandOnActivate?: boolean;
};

export type SelectionIntent =
  | { kind: 'none' }
  | { kind: 'replace'; path: string }
  | { kind: 'toggle'; path: string }
  | { kind: 'range'; path: string };

export type ExpansionIntent = { kind: 'none' } | { kind: 'toggle'; path: string };

export type ClickPlan = {
  selection: SelectionIntent;
  expansion: ExpansionIntent;
  /** Focus always resolves to a concrete path on activation. */
  focusPath: string;
  /** Open the context menu after applying the plan. */
  openContextMenu: boolean;
};

/**
 * Compute the plan for one row activation. Decision order (first match wins):
 *  1. chevron hit on a parent → expansion toggle only, selection untouched.
 *  2. secondary (right-click) → ensure the row is selected (replace only when it
 *     wasn't), open the context menu, never toggle expansion.
 *  3. selectionMode 'none' → no selection; a plain activate still toggles a
 *     directory (so folders open) and focus still moves.
 *  4. shift (multiple) → range selection.
 *  5. ctrl/meta (multiple) → toggle selection.
 *  6. plain → replace selection; if the row is a directory and
 *     toggleExpandOnActivate, also toggle expansion.
 */
export function computeClickPlan(input: ClickPlanInput): ClickPlan {
  const { path, hasChildren, isSelected, selectionMode } = input;
  const mods = input.modifiers ?? {};
  const toggleExpandOnActivate = input.toggleExpandOnActivate ?? true;
  const additive = Boolean(mods.ctrl || mods.meta);
  const canMulti = selectionMode === 'multiple';

  const expandToggle: ExpansionIntent = { kind: 'toggle', path };
  const noExpand: ExpansionIntent = { kind: 'none' };

  // 1. Chevron is pure disclosure.
  if (mods.viaChevron && hasChildren)
    return { selection: { kind: 'none' }, expansion: expandToggle, focusPath: path, openContextMenu: false };

  // 2. Right-click: select if not already, then open the menu.
  if (mods.secondary) {
    const selection: SelectionIntent = selectionMode === 'none' || isSelected ? { kind: 'none' } : { kind: 'replace', path };
    return { selection, expansion: noExpand, focusPath: path, openContextMenu: true };
  }

  const wantExpand = hasChildren && toggleExpandOnActivate ? expandToggle : noExpand;

  // 3. No-selection tree: still open folders + move focus.
  if (selectionMode === 'none')
    return { selection: { kind: 'none' }, expansion: wantExpand, focusPath: path, openContextMenu: false };

  // 4. Range.
  if (mods.shift && canMulti)
    return { selection: { kind: 'range', path }, expansion: noExpand, focusPath: path, openContextMenu: false };

  // 5. Additive toggle.
  if (additive && canMulti)
    return { selection: { kind: 'toggle', path }, expansion: noExpand, focusPath: path, openContextMenu: false };

  // 6. Plain activation.
  return { selection: { kind: 'replace', path }, expansion: wantExpand, focusPath: path, openContextMenu: false };
}
