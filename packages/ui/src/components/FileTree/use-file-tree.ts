/** biome-ignore-all lint/style/useExportsLast: exports and defines multiple utils */
// React glue for the FileTree. Two hooks:
//  - useFileTree(config): create a stable FileTreeController for the imperative
//    escape hatch (`<FileTree model={...} />`) or standalone use.
//  - useSyncedFileTree(props): the component-internal hook that resolves the
//    controller (props-driven or the passed `model`), reconciles the declarative
//    + controlled props onto it each render, and returns the interaction handlers
//    the render layer calls. Controlled slices (selection/expansion/search) fire
//    callbacks only; the sync effects write the parent's prop value back in.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FileTreeVisibleRow } from './file-tree.types';
import type { ClickModifiers, SelectionIntent } from './file-tree-click-plan';
import { computeClickPlan } from './file-tree-click-plan';
import { FileTreeController, type FileTreeControllerConfig } from './file-tree-controller';
import { buildDropOperations } from './file-tree-dnd';
import type { FileTreeProps } from './file-tree-props';
import { renameFileTreePaths } from './file-tree-rename';

/** Config accepted by `useFileTree` (mirrors the controller's constructor). */
export type UseFileTreeConfig = FileTreeControllerConfig;

/**
 * Create a stable `FileTreeController`. The controller is built once (from the
 * first `config`); later config changes are ignored here — drive updates through
 * the returned controller's methods or via `<FileTree>`'s declarative props. Pass
 * the returned controller to `<FileTree model={...} />` for imperative control.
 */
export function useFileTree(config: UseFileTreeConfig = {}): FileTreeController {
  const ref = useRef<FileTreeController | null>(null);
  if (ref.current === null) ref.current = new FileTreeController(config);
  return ref.current;
}

/** Apply a click-plan selection intent to the controller; returns the next selection (null = untouched). */
function applySelectionIntent(controller: FileTreeController, intent: SelectionIntent): string[] | null {
  switch (intent.kind) {
    case 'replace':
      return controller.applySelection(intent.path);
    case 'toggle':
      return controller.applySelection(intent.path, { additive: true });
    case 'range':
      return controller.applySelection(intent.path, { range: true });
    default:
      return null;
  }
}

/** Remap a path list through an old→new map, keeping unmoved entries. */
function remapList(paths: readonly string[], remap: Map<string, string>): string[] {
  return paths.map((path) => remap.get(path) ?? path);
}

/** A rename/move remap Map rendered as the plain record the public events expose. */
function remapObject(remap: Map<string, string>): Record<string, string> {
  return Object.fromEntries(remap);
}

/** Order-sensitive string-list equality (both come from ordered controller getters). */
function sameOrderedList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** Change callbacks fired after a structural remap so controlled parents resync. */
type RemapCallbacks = { onSelectionChange?: (paths: string[]) => void; onExpandedChange?: (paths: string[]) => void };

/**
 * Apply a rename/move `remap` to the controller, then fire the selection /
 * expansion callbacks only when that slice actually moved. Shared by rename and
 * move: both remap the canonical set the same way (unmoved paths kept), and the
 * controller's `remapState` carries expansion/selection/focus across the edit.
 */
function commitRemap(controller: FileTreeController, remap: Map<string, string>, callbacks: RemapCallbacks) {
  const prevSelected = controller.getSelectedPaths();
  const prevExpanded = controller.getExpandedPaths();
  controller.remapState(remap, remapList(controller.getPaths(), remap));
  const nextSelected = controller.getSelectedPaths();
  const nextExpanded = controller.getExpandedPaths();
  if (callbacks.onSelectionChange && !sameOrderedList(prevSelected, nextSelected)) callbacks.onSelectionChange(nextSelected);
  if (callbacks.onExpandedChange && !sameOrderedList(prevExpanded, nextExpanded)) callbacks.onExpandedChange(nextExpanded);
}

/** Options the render layer passes when a row is activated. */
export type FileTreeActivateOptions = {
  /** Raw modifiers captured at the pointer/gesture (web + touch converge here). */
  modifiers?: ClickModifiers;
  /** Screen coordinates of the trigger, forwarded to `onContextMenu`. */
  x?: number;
  y?: number;
};

/** The interaction API the render layer drives, plus the resolved controller. */
export type SyncedFileTree = {
  controller: FileTreeController;
  /** Handle a row body / chevron activation (see `computeClickPlan`). */
  activate: (row: FileTreeVisibleRow, options?: FileTreeActivateOptions) => void;
  /** Toggle a directory's expansion (chevron / keyboard). */
  toggleExpand: (path: string) => void;
  /** Commit an inline rename; no-ops on an invalid/unchanged name. */
  commitRename: (path: string, nextName: string) => void;
  /** Commit a drag-and-drop move of `dragged` onto `targetPath` (null = root). */
  commitMove: (dragged: Iterable<string>, targetPath: string | null) => void;
  /** Update the search query (fires the callback; controlled parents own it). */
  setSearchQuery: (query: string) => void;
};

/** What `useResolvedController` returns: the live controller + whether it's external. */
type ResolvedController = { controller: FileTreeController; isExternal: boolean };

/**
 * Resolve the controller for this render: the passed `model` (escape hatch) or a
 * lazily-created internal one seeded from the declarative props. The internal
 * controller is created once; prop changes reconcile onto it via effects.
 */
function useResolvedController(props: FileTreeProps): ResolvedController {
  const internal = useRef<FileTreeController | null>(null);
  if (!props.model && internal.current === null) {
    internal.current = new FileTreeController({
      paths: props.paths,
      initialExpansion: props.initialExpansion,
      flattenEmptyDirectories: props.flattenEmptyDirectories,
      selectionMode: props.selectionMode,
      gitStatus: props.gitStatus,
      searchQuery: props.searchQuery ?? props.defaultSearchQuery,
      searchMode: props.searchMode,
      density: props.density,
    });
    const seed = props.selectedPaths ?? props.defaultSelectedPaths;
    if (seed?.length) internal.current.setSelection(seed);
    const expandedSeed = props.expandedPaths ?? props.defaultExpandedPaths;
    if (expandedSeed) internal.current.setExpanded(expandedSeed);
  }
  // biome-ignore lint/style/noNonNullAssertion: exactly one branch is set per render.
  const controller = props.model ?? internal.current!;
  return { controller, isExternal: Boolean(props.model) };
}

/**
 * Reconcile the declarative + controlled props onto the internal controller each
 * render. No-op when a `model` is supplied (it owns its own state). Controlled
 * slices are written straight in (the parent's value is the source of truth);
 * plain config setters early-return when unchanged so redundant props are cheap.
 *
 * These are genuine external-store-sync effects (React's blessed useEffect use):
 * the controller is a mutable store outside React, so props are pushed in via
 * effects rather than read in render (that would emit + bump version mid-render).
 * Each effect lists every reactive dep, so only `react/no-use-effect` is silenced.
 */
function useControllerReconciliation(controller: FileTreeController, isExternal: boolean, props: FileTreeProps) {
  const selectionControlled = props.selectedPaths !== undefined;
  const expansionControlled = props.expandedPaths !== undefined;
  const searchControlled = props.searchQuery !== undefined;
  const { paths, gitStatus, selectionMode, flattenEmptyDirectories, density, selectedPaths, expandedPaths } = props;
  const { searchQuery, searchMode } = props;

  // biome-ignore lint/plugin: external-store sync — mark which slices props control
  useEffect(() => {
    if (!isExternal) controller.setControlledFlags({ selection: selectionControlled, expansion: expansionControlled });
  }, [controller, isExternal, selectionControlled, expansionControlled]);

  // biome-ignore lint/plugin: external-store sync — guarded config setters (all no-op when unchanged)
  useEffect(() => {
    if (isExternal) return;
    if (paths) controller.setPaths(paths);
    if (selectionMode) controller.setSelectionMode(selectionMode);
    if (flattenEmptyDirectories !== undefined) controller.setFlatten(flattenEmptyDirectories);
    if (density) controller.setDensity(density);
  }, [controller, isExternal, paths, selectionMode, flattenEmptyDirectories, density]);

  // biome-ignore lint/plugin: external-store sync — git status keyed on its own prop
  useEffect(() => {
    if (!isExternal) controller.setGitStatus(gitStatus);
  }, [controller, isExternal, gitStatus]);

  // biome-ignore lint/plugin: external-store sync — controlled selection (parent owns the set)
  useEffect(() => {
    if (!isExternal && selectionControlled && selectedPaths) controller.setSelection(selectedPaths);
  }, [controller, isExternal, selectionControlled, selectedPaths]);

  // biome-ignore lint/plugin: external-store sync — controlled expansion (parent owns the set)
  useEffect(() => {
    if (!isExternal && expansionControlled && expandedPaths) controller.setExpanded(expandedPaths);
  }, [controller, isExternal, expansionControlled, expandedPaths]);

  // biome-ignore lint/plugin: external-store sync — controlled query + filtering mode
  useEffect(() => {
    if (!isExternal && (searchControlled || searchMode))
      controller.setSearch(searchControlled ? (searchQuery ?? '') : controller.getSearchQuery(), searchMode);
  }, [controller, isExternal, searchControlled, searchQuery, searchMode]);
}

/**
 * Build the interaction handlers the render layer drives. Each handler runs a
 * pure planner/edit (click-plan, rename, drop) against the controller, then fires
 * the matching public callback. Callbacks fire whether or not a slice is
 * prop-controlled — that is how a controlled parent learns what to write back.
 */
function useFileTreeHandlers(controller: FileTreeController, props: FileTreeProps): SyncedFileTree {
  const { onSelectionChange, onExpandedChange, onActivate, onContextMenu, onRename, onMove, onSearchQueryChange } = props;

  const activate = useCallback(
    (row: FileTreeVisibleRow, options: FileTreeActivateOptions = {}) => {
      const mods = options.modifiers ?? {};
      const plan = computeClickPlan({
        path: row.path,
        hasChildren: row.hasChildren,
        isSelected: controller.isSelected(row.path),
        selectionMode: controller.getSelectionMode(),
        modifiers: mods,
      });
      const nextSelection = applySelectionIntent(controller, plan.selection);
      if (nextSelection && onSelectionChange) onSelectionChange(nextSelection);
      // Focus only moves here when no selection gesture already moved it.
      if (plan.selection.kind === 'none') controller.setFocus(plan.focusPath);
      if (plan.expansion.kind === 'toggle') {
        const expanded = controller.toggleExpanded(plan.expansion.path);
        onExpandedChange?.(expanded);
      }
      if (plan.openContextMenu) {
        const selectedPaths = nextSelection ?? controller.getSelectedPaths();
        onContextMenu?.({ path: row.path, selectedPaths, x: options.x, y: options.y });
      }
      // A plain primary activation (no modifiers, no chevron) is an "open".
      const plain = !(mods.secondary || mods.viaChevron || mods.shift || mods.ctrl || mods.meta);
      if (plain) onActivate?.(row);
    },
    [controller, onSelectionChange, onExpandedChange, onActivate, onContextMenu],
  );
  const toggleExpand = useCallback(
    (path: string) => {
      const expanded = controller.toggleExpanded(path);
      onExpandedChange?.(expanded);
    },
    [controller, onExpandedChange],
  );

  const commitRename = useCallback(
    (path: string, nextName: string) => {
      const result = renameFileTreePaths(controller.getAllPaths(), path, nextName);
      if (!result) return;
      commitRemap(controller, result.remap, { onSelectionChange, onExpandedChange });
      onRename?.({ path, newPath: result.newPath, remap: remapObject(result.remap), paths: controller.getPaths() });
    },
    [controller, onSelectionChange, onExpandedChange, onRename],
  );

  const commitMove = useCallback(
    (dragged: Iterable<string>, targetPath: string | null) => {
      const drop = buildDropOperations(controller.getAllPaths(), dragged, targetPath);
      if (!drop) return;
      commitRemap(controller, drop.remap, { onSelectionChange, onExpandedChange });
      const sources = drop.operations.map((op) => op.from);
      onMove?.({ sources, destination: drop.destination, remap: remapObject(drop.remap), paths: controller.getPaths() });
    },
    [controller, onSelectionChange, onExpandedChange, onMove],
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      // Controlled search: the parent owns the query, so only signal the change.
      if (props.searchQuery === undefined) controller.setSearch(query);
      onSearchQueryChange?.(query);
    },
    [controller, props.searchQuery, onSearchQueryChange],
  );

  return useMemo(
    () => ({ controller, activate, toggleExpand, commitRename, commitMove, setSearchQuery }),
    [controller, activate, toggleExpand, commitRename, commitMove, setSearchQuery],
  );
}

/**
 * The component-internal hook. Resolves the controller (declarative props or the
 * passed `model`), reconciles the controlled/config props onto it, and returns
 * the interaction handlers `<FileTree>`'s render layer drives. This is where the
 * declarative surface and the imperative escape hatch converge onto one store.
 */
export function useSyncedFileTree(props: FileTreeProps): SyncedFileTree {
  const { controller, isExternal } = useResolvedController(props);
  useControllerReconciliation(controller, isExternal, props);
  return useFileTreeHandlers(controller, props);
}
