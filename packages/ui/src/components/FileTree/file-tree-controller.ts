/** biome-ignore-all lint/style/useExportsLast: exports and defines multiple utils */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: exports and defines multiple complex utils */
// Stateful controller/model for the file tree. Holds the canonical path set,
// the derived node tree, and all mutable UI state (expansion, selection, focus,
// search, git). Exposes a subscribe/getVersion pair so React can bind via
// useSyncExternalStore, plus getVisibleRows() to obtain the projected rows.
// RN-free so the whole model is unit-testable in jsdom.

import type {
  FileTreeDensity,
  FileTreeGitStatusCode,
  FileTreeGitStatusMap,
  FileTreeInitialExpansion,
  FileTreeSearchMode,
  FileTreeSelectionMode,
  FileTreeVisibleRow,
} from './file-tree.types';
import { computeGitRollups, computeIgnoredPaths } from './file-tree-git';
import { ancestorPaths, canonicalizePath } from './file-tree-paths';
import { remapPathSet } from './file-tree-rename';
import { buildTree, type TreeNode } from './file-tree-tree';
import { computeVisibleRows } from './file-tree-view';

export type FileTreeControllerConfig = {
  paths?: Iterable<string>;
  initialExpansion?: FileTreeInitialExpansion;
  flattenEmptyDirectories?: boolean;
  selectionMode?: FileTreeSelectionMode;
  gitStatus?: FileTreeGitStatusMap;
  searchQuery?: string;
  searchMode?: FileTreeSearchMode;
  density?: FileTreeDensity;
};

/** Flags describing how a selection gesture should mutate the selection set. */
export type SelectionModifiers = { additive?: boolean; range?: boolean };

/** Which state slices are prop-controlled (see `setControlledFlags`). */
export type FileTreeControlledFlags = { selection?: boolean; expansion?: boolean };

export class FileTreeController {
  private canonicalPaths: string[] = [];
  private roots: TreeNode[] = [];
  /** All canonical paths including implicit ancestor directories. */
  private allPaths: string[] = [];
  /** Directory paths only (for expand-all / depth expansion). */
  private directoryDepths: Map<string, number> = new Map();

  private expanded = new Set<string>();
  private selected = new Set<string>();
  private focusedPath: string | null = null;
  /** Anchor for shift/range selection. */
  private anchorPath: string | null = null;

  private gitRollups = new Map<string, FileTreeGitStatusCode>();
  /** Paths explicitly marked ignored (`null` in the git map) — rendered dimmed. */
  private ignoredPaths = new Set<string>();
  private searchQuery = '';
  private searchMode: FileTreeSearchMode = 'expand-matches';

  private readonly initialExpansion: FileTreeInitialExpansion;
  private flatten: boolean;
  private selectionMode: FileTreeSelectionMode;
  private density: FileTreeDensity;

  // When a slice is controlled by props, interactions compute the next value and
  // return it (for the callback) WITHOUT committing, so the parent's prop stays
  // the single source of truth (a rejecting parent snaps the UI back). The sync
  // effect writes the prop value in via setSelection / setExpanded.
  private selectionControlled: boolean;
  private expansionControlled: boolean;

  private version = 0;
  private seeded: boolean;
  private readonly listeners = new Set<() => void>();
  private rowCache: FileTreeVisibleRow[] | null = null;
  private rowCacheVersion = -1;

  constructor(config: FileTreeControllerConfig = {}) {
    this.selectionControlled = false;
    this.expansionControlled = false;
    this.seeded = false;
    this.initialExpansion = config.initialExpansion ?? 'closed';
    this.flatten = config.flattenEmptyDirectories ?? true;
    this.selectionMode = config.selectionMode ?? 'single';
    this.density = config.density ?? 'default';
    this.searchQuery = config.searchQuery ?? '';
    this.searchMode = config.searchMode ?? 'expand-matches';
    this.gitRollups = computeGitRollups(config.gitStatus);
    this.ignoredPaths = computeIgnoredPaths(config.gitStatus);
    this.reset(config.paths ?? []);
  }

  // ── Subscription (useSyncExternalStore) ────────────────────────────────────

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = (): number => this.version;

  private emit() {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  // ── Paths / tree rebuild ───────────────────────────────────────────────────

  /**
   * Replace the whole path set, rebuild the tree, prune stale state. Early-returns
   * when the canonical path set is unchanged so a parent that passes an inline
   * `paths` array (new identity, same content) every render stays cheap.
   */
  setPaths(paths: Iterable<string>) {
    const next = canonicalizePathList(paths);
    if (samePathList(this.canonicalPaths, next)) return;
    this.reset(next);
    this.emit();
  }

  /**
   * Carry expansion/selection/focus/anchor across a rename or move. Rewrites the
   * mutable UI state through `remap` (old path → new path) so a renamed directory
   * stays expanded and a moved file stays selected, then swaps in the new path set.
   * Emits once. Unlike a selection gesture, a structural edit ALWAYS remaps the
   * committed sets (even when a slice is prop-controlled) so the tree never drops
   * state mid-edit; the caller fires the change callbacks so a controlled parent's
   * props catch up on the next render.
   */
  remapState(remap: Map<string, string>, paths: Iterable<string>) {
    this.expanded = remapPathSet(this.expanded, remap);
    this.selected = remapPathSet(this.selected, remap);
    if (this.focusedPath) this.focusedPath = remap.get(this.focusedPath) ?? this.focusedPath;
    if (this.anchorPath) this.anchorPath = remap.get(this.anchorPath) ?? this.anchorPath;
    this.reset(paths);
    this.emit();
  }

  private reset(paths: Iterable<string>) {
    this.canonicalPaths = canonicalizePathList(paths);
    this.roots = buildTree(this.canonicalPaths);
    this.reindexTree();
    this.pruneState();
    this.applyInitialExpansion();
    this.rowCache = null;
  }

  /** Walk the built tree to collect every path + directory depth. */
  private reindexTree() {
    this.allPaths = [];
    this.directoryDepths = new Map();
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        this.allPaths.push(node.path);
        if (node.kind === 'directory') this.directoryDepths.set(node.path, node.depth);
        if (node.children.length > 0) walk(node.children);
      }
    };
    walk(this.roots);
  }

  /** Drop expanded/selected/focus entries that no longer exist. */
  private pruneState() {
    const live = new Set(this.allPaths);
    this.expanded = new Set([...this.expanded].filter((p) => live.has(p)));
    this.selected = new Set([...this.selected].filter((p) => live.has(p)));
    if (this.focusedPath && !live.has(this.focusedPath)) this.focusedPath = null;
    if (this.anchorPath && !live.has(this.anchorPath)) this.anchorPath = null;
  }

  private applyInitialExpansion() {
    // Seed expansion once, on first construction. Later setPaths() calls keep
    // whatever the user has expanded/collapsed rather than re-seeding.
    if (this.seeded) return;
    this.seeded = true;
    const mode = this.initialExpansion;
    if (mode === 'closed') return;
    for (const [dir, depth] of this.directoryDepths) {
      if (mode === 'open' || depth < mode) this.expanded.add(dir);
    }
  }

  // ── Config setters ─────────────────────────────────────────────────────────

  setGitStatus(gitStatus: FileTreeGitStatusMap | undefined) {
    this.gitRollups = computeGitRollups(gitStatus);
    this.ignoredPaths = computeIgnoredPaths(gitStatus);
    this.emit();
  }

  /** True when `path` was explicitly marked ignored (`null` in the git map). */
  isIgnored(path: string): boolean {
    return this.ignoredPaths.has(path);
  }

  setFlatten(flatten: boolean) {
    if (this.flatten === flatten) return;
    this.flatten = flatten;
    this.emit();
  }

  setDensity(density: FileTreeDensity) {
    if (this.density === density) return;
    this.density = density;
    this.emit();
  }

  setSelectionMode(mode: FileTreeSelectionMode) {
    if (this.selectionMode === mode) return;
    this.selectionMode = mode;
    if (mode === 'none') {
      this.selected.clear();
      this.anchorPath = null;
    } else if (mode === 'single' && this.selected.size > 1) {
      // Collapse to the focused entry (or the first selected) when narrowing.
      const keep = this.focusedPath && this.selected.has(this.focusedPath) ? this.focusedPath : [...this.selected][0];
      this.selected = keep ? new Set([keep]) : new Set();
    }
    this.emit();
  }

  setSearch(query: string, mode?: FileTreeSearchMode) {
    const nextMode = mode ?? this.searchMode;
    if (this.searchQuery === query && this.searchMode === nextMode) return;
    this.searchQuery = query;
    this.searchMode = nextMode;
    this.emit();
  }

  /**
   * Mark selection / expansion as prop-controlled. When controlled, the matching
   * interaction methods compute + return the next state and emit (so callbacks
   * fire and focus/anchor still move) but do NOT mutate the committed set — the
   * sync effect writes the prop value in via setSelection / setExpanded.
   */
  setControlledFlags(flags: FileTreeControlledFlags) {
    if (flags.selection !== undefined) this.selectionControlled = flags.selection;
    if (flags.expansion !== undefined) this.expansionControlled = flags.expansion;
  }

  // ── Expansion ──────────────────────────────────────────────────────────────

  isExpanded(path: string): boolean {
    return this.expanded.has(path);
  }

  /**
   * Commit a computed expanded set. When expansion is prop-controlled the set is
   * NOT written (the sync effect writes the prop value via setExpanded); either
   * way we emit and return the next set as an array for the change callback.
   */
  private commitExpansion(next: Set<string>): string[] {
    if (!this.expansionControlled) this.expanded = next;
    this.emit();
    return [...next];
  }

  expand(path: string): string[] {
    if (this.expanded.has(path)) return [...this.expanded];
    return this.commitExpansion(new Set(this.expanded).add(path));
  }

  collapse(path: string): string[] {
    if (!this.expanded.has(path)) return [...this.expanded];
    const next = new Set(this.expanded);
    next.delete(path);
    return this.commitExpansion(next);
  }

  toggleExpanded(path: string): string[] {
    const next = new Set(this.expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return this.commitExpansion(next);
  }

  /** Replace the whole expanded-directory set (drives controlled expansion). */
  setExpanded(paths: Iterable<string>) {
    const next = new Set<string>();
    for (const path of paths) if (this.directoryDepths.has(path)) next.add(path);
    if (next.size === this.expanded.size && [...next].every((p) => this.expanded.has(p))) return;
    this.expanded = next;
    this.emit();
  }

  expandAll(): string[] {
    return this.commitExpansion(new Set(this.directoryDepths.keys()));
  }

  collapseAll(): string[] {
    if (this.expanded.size === 0) return [];
    return this.commitExpansion(new Set());
  }

  /** Expand every ancestor directory of `path` so it becomes visible. */
  revealPath(path: string): string[] {
    const next = new Set(this.expanded);
    let changed = false;
    for (const anc of ancestorPaths(path)) {
      if (!next.has(anc)) {
        next.add(anc);
        changed = true;
      }
    }
    if (!changed) return [...this.expanded];
    return this.commitExpansion(next);
  }

  // ── Selection ────────────────────────────────────────────────────────────

  isSelected(path: string): boolean {
    return this.selected.has(path);
  }

  getSelectedPaths(): string[] {
    return [...this.selected];
  }

  /** Replace the whole selection (respecting the current selection mode). */
  setSelection(paths: Iterable<string>) {
    if (this.selectionMode === 'none') return;
    const live = new Set(this.allPaths);
    let next = [...paths].filter((p) => live.has(p));
    if (this.selectionMode === 'single' && next.length > 1) next = next.slice(0, 1);
    this.selected = new Set(next);
    this.anchorPath = next.length > 0 ? (next.at(-1) ?? null) : null;
    this.emit();
  }

  clearSelection() {
    if (this.selected.size === 0) return;
    this.selected.clear();
    this.anchorPath = null;
    this.emit();
  }

  /**
   * Apply a selection gesture at `path`. Focus always moves to `path` (focus is
   * never prop-controlled). Returns the resulting selection so a controlled
   * component can forward it to `onSelectionChange`.
   *  - `range` (shift): select the contiguous visible run from the anchor.
   *  - `additive` (ctrl/cmd): toggle `path`, keep the rest.
   *  - plain: select only `path`.
   * In `single` mode modifiers are ignored (always single); in `none` mode only
   * focus moves. When selection is prop-controlled the committed set is left for
   * the sync effect to write; the computed next selection is still returned.
   */
  applySelection(path: string, modifiers: SelectionModifiers = {}): string[] {
    this.focusedPath = path;
    if (this.selectionMode === 'none') {
      this.emit();
      return [...this.selected];
    }
    let next: string[];
    if (this.selectionMode === 'single') {
      next = [path];
      this.anchorPath = path;
    } else if (modifiers.range && this.anchorPath) {
      next = this.pathsBetween(this.anchorPath, path);
      // Range keeps the existing anchor so shift can be re-extended.
    } else if (modifiers.additive) {
      next = this.selected.has(path) ? [...this.selected].filter((p) => p !== path) : [...this.selected, path];
      this.anchorPath = path;
    } else {
      next = [path];
      this.anchorPath = path;
    }
    if (!this.selectionControlled) this.selected = new Set(next);
    this.emit();
    return next;
  }

  /** Inclusive run of visible paths between two anchors (order-independent). */
  private pathsBetween(a: string, b: string): string[] {
    const rows = this.getVisibleRows();
    const ia = rows.findIndex((r) => r.path === a);
    const ib = rows.findIndex((r) => r.path === b);
    if (ia === -1 || ib === -1) return [b];
    const [lo, hi] = ia <= ib ? [ia, ib] : [ib, ia];
    return rows.slice(lo, hi + 1).map((r) => r.path);
  }

  // ── Focus ────────────────────────────────────────────────────────────────

  getFocusedPath(): string | null {
    return this.focusedPath;
  }

  setFocus(path: string | null) {
    if (this.focusedPath === path) return;
    this.focusedPath = path;
    this.emit();
  }

  /** Move focus by `delta` rows within the current visible list (clamped). */
  moveFocus(delta: number): string | null {
    const rows = this.getVisibleRows();
    if (rows.length === 0) return null;
    const current = this.focusedPath ? rows.findIndex((r) => r.path === this.focusedPath) : -1;
    let nextIndex: number;
    if (current === -1) nextIndex = delta > 0 ? 0 : rows.length - 1;
    else nextIndex = Math.max(0, Math.min(rows.length - 1, current + delta));
    const next = rows[nextIndex]?.path ?? null;
    this.setFocus(next);
    return next;
  }

  // ── Git ──────────────────────────────────────────────────────────────────

  gitStatusFor(path: string): FileTreeGitStatusCode | null {
    return this.gitRollups.get(path) ?? null;
  }

  // ── Snapshot getters (for selectors) ───────────────────────────────────────

  getPaths(): string[] {
    return this.canonicalPaths;
  }

  /** Every path including implicit ancestor directories (for complete remaps). */
  getAllPaths(): string[] {
    return this.allPaths;
  }

  getExpandedPaths(): string[] {
    return [...this.expanded];
  }

  getDensity(): FileTreeDensity {
    return this.density;
  }

  getFlatten(): boolean {
    return this.flatten;
  }

  getSelectionMode(): FileTreeSelectionMode {
    return this.selectionMode;
  }

  getSearchQuery(): string {
    return this.searchQuery;
  }

  getSearchMode(): FileTreeSearchMode {
    return this.searchMode;
  }

  // ── Visible rows (memoized per version) ─────────────────────────────────────

  getVisibleRows = (): FileTreeVisibleRow[] => {
    if (this.rowCache && this.rowCacheVersion === this.version) return this.rowCache;
    this.rowCache = computeVisibleRows({
      roots: this.roots,
      allPaths: this.allPaths,
      expanded: this.expanded,
      selected: this.selected,
      focusedPath: this.focusedPath,
      flatten: this.flatten,
      searchQuery: this.searchQuery,
      searchMode: this.searchMode,
    });
    this.rowCacheVersion = this.version;
    return this.rowCache;
  };
}

/** Canonicalize + de-duplicate a raw path iterable, preserving first-seen order. */
function canonicalizePathList(paths: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of paths) {
    const path = canonicalizePath(raw);
    if (path && !seen.has(path)) {
      seen.add(path);
      out.push(path);
    }
  }
  return out;
}

/** Order-sensitive equality for two canonical path lists. */
function samePathList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
