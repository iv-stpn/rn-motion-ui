/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the composed component + its render hooks live together */
// The <FileTree> component: the declarative render layer over the controller.
// Resolves the palette + density metrics once, subscribes to just the slices it
// draws (rows, density, search), and hands the uniform-height rows to
// FileTreeScrollBody, which owns the virtualized list plus the sticky-header and
// drag-and-drop overlays. Interactions converge on useSyncedFileTree's handlers;
// web-only right-click / double-click / keyboard are bound by
// useFileTreeWebInteractions.

import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { useThemeColors } from '../../theme/use-theme-color';
import { Text } from '../Text/text';
import type { FileTreeVisibleRow } from './file-tree.types';
import type { ClickModifiers } from './file-tree-click-plan';
import { resolveDensityMetrics } from './file-tree-density';
import type { FileTreeProps } from './file-tree-props';
import { FileTreeRow, type FileTreeRowColors } from './file-tree-row';
import { FileTreeScrollBody } from './file-tree-scroll-body';
import { FileTreeSearchInput } from './file-tree-search-input';
import { type SyncedFileTree, useSyncedFileTree } from './use-file-tree';
import { useFileTreeDensity, useFileTreeRows, useFileTreeSearch } from './use-file-tree-selector';
import { useFileTreeWebInteractions } from './use-file-tree-web';

/** Height of the built-in search input (matches file-tree-search-input.tsx). */
const SEARCH_INPUT_HEIGHT = 40;
/** Default viewport height when the consumer doesn't fix one. */
const DEFAULT_HEIGHT = 360;

/** Resolve the shared row palette once per render from the active theme. */
function useRowColors(): FileTreeRowColors {
  const colors = useThemeColors();
  return useMemo(
    () => ({
      icon: colors['muted-foreground'],
      folder: colors.foreground,
      chevron: colors['muted-foreground'],
      placeholder: colors['muted-foreground'],
    }),
    [colors],
  );
}

/** The row/web callbacks plus the inline-rename target this component owns. */
type FileTreeRowHandlers = {
  renamingPath: string | null;
  onActivate: (row: FileTreeVisibleRow, modifiers: ClickModifiers, x?: number, y?: number) => void;
  onToggleExpand: (path: string) => void;
  onLongPress: (row: FileTreeVisibleRow, x?: number, y?: number) => void;
  onRenameSubmit: (path: string, nextName: string) => void;
  onRenameCancel: () => void;
  onStartRename: (path: string) => void;
};

/**
 * Bind the presentational row callbacks to the synced-tree handlers and own the
 * single inline-rename target. A tap activates (selection/expansion/open); a
 * long-press maps to a secondary activation (select + open context actions,
 * mirroring web right-click); rename commit/cancel clears the target.
 */
function useFileTreeRowHandlers(synced: SyncedFileTree): FileTreeRowHandlers {
  const { activate, toggleExpand, commitRename } = synced;
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  const onActivate = useCallback(
    (row: FileTreeVisibleRow, modifiers: ClickModifiers, x?: number, y?: number) => activate(row, { modifiers, x, y }),
    [activate],
  );
  const onLongPress = useCallback(
    (row: FileTreeVisibleRow, x?: number, y?: number) => activate(row, { modifiers: { secondary: true }, x, y }),
    [activate],
  );
  const onRenameSubmit = useCallback(
    (path: string, nextName: string) => {
      commitRename(path, nextName);
      setRenamingPath(null);
    },
    [commitRename],
  );
  const onRenameCancel = useCallback(() => setRenamingPath(null), []);
  const onStartRename = useCallback((path: string) => setRenamingPath(path), []);

  return { renamingPath, onActivate, onToggleExpand: toggleExpand, onLongPress, onRenameSubmit, onRenameCancel, onStartRename };
}

/** Everything the per-row renderer closes over, resolved once per render. */
type RenderRowContext = {
  synced: SyncedFileTree;
  metrics: ReturnType<typeof resolveDensityMetrics>;
  colors: FileTreeRowColors;
  handlers: FileTreeRowHandlers;
  showIcons: boolean;
  showIndentGuides: boolean;
  reduce: boolean;
  rowClassName?: string;
  testID?: string;
};

/**
 * Build the bare-row renderer shared by the FlatList and the sticky-header stack.
 * The controller supplies each row's git code + dimmed (ignored) flag;
 * selection/focus already live on the row object (the controller rebuilds rows on
 * every version bump). Memoized on the whole context so `extraData` can point at
 * this function and force the list to re-render when the context shifts. Drop /
 * drag feedback is drawn as overlays by the scroll body, so rows stay neutral.
 */
function useRenderRow(ctx: RenderRowContext) {
  const { synced, metrics, colors, handlers, showIcons, showIndentGuides, reduce, rowClassName, testID } = ctx;
  const { controller } = synced;
  const { renamingPath, onActivate, onToggleExpand, onLongPress, onRenameSubmit, onRenameCancel } = handlers;

  return useCallback(
    (row: FileTreeVisibleRow) => (
      <FileTreeRow
        row={row}
        metrics={metrics}
        colors={colors}
        gitCode={controller.gitStatusFor(row.path)}
        dimmed={controller.isIgnored(row.path)}
        showIcons={showIcons}
        showIndentGuides={showIndentGuides}
        reduce={reduce}
        renaming={renamingPath === row.path}
        dropTarget={false}
        dragging={false}
        rowClassName={rowClassName}
        testID={testID ? `${testID}-row` : undefined}
        onActivate={onActivate}
        onToggleExpand={onToggleExpand}
        onLongPress={onLongPress}
        onRenameSubmit={onRenameSubmit}
        onRenameCancel={onRenameCancel}
      />
    ),
    [
      controller,
      metrics,
      colors,
      showIcons,
      showIndentGuides,
      reduce,
      renamingPath,
      rowClassName,
      testID,
      onActivate,
      onToggleExpand,
      onLongPress,
      onRenameSubmit,
      onRenameCancel,
    ],
  );
}

/** The view shown when the projected row set is empty (string or custom node). */
type FileTreeEmptyProps = { emptyState: FileTreeProps['emptyState'] };
function FileTreeEmpty({ emptyState }: FileTreeEmptyProps) {
  if (emptyState !== undefined && emptyState !== null && typeof emptyState !== 'string') return <>{emptyState}</>;
  return (
    <View className="items-center justify-center p-10">
      <Text className="text-center text-muted-foreground text-sm">{emptyState ?? 'No files'}</Text>
    </View>
  );
}

/**
 * Path-first file tree. Declarative-first (`paths` + controlled state + callbacks,
 * mirroring `<Table>`) with an imperative escape hatch (`model` from `useFileTree`).
 * Renders uniform-height rows in a FlatList; taps/long-presses drive selection,
 * expansion and context actions, and on web right-click / double-click / keyboard
 * are wired through `useFileTreeWebInteractions`.
 */
export function FileTree(props: FileTreeProps) {
  const synced = useSyncedFileTree(props);
  const { controller } = synced;
  const rows = useFileTreeRows(controller);
  const density = useFileTreeDensity(controller);
  const search = useFileTreeSearch(controller);
  const metrics = useMemo(() => resolveDensityMetrics(density), [density]);
  const colors = useRowColors();
  const reduce = useReducedMotion();
  const handlers = useFileTreeRowHandlers(synced);

  const {
    showIcons = true,
    showIndentGuides = true,
    showSearch = false,
    height = DEFAULT_HEIGHT,
    rowClassName,
    className,
    style,
    emptyState,
    testID,
  } = props;

  const containerRef = useRef<View | null>(null);
  useFileTreeWebInteractions(containerRef, {
    controller,
    activate: synced.activate,
    toggleExpand: synced.toggleExpand,
    onStartRename: handlers.onStartRename,
    renamable: Boolean(props.renamable),
  });

  const renderRow = useRenderRow({
    synced,
    metrics,
    colors,
    handlers,
    showIcons,
    showIndentGuides,
    reduce,
    rowClassName,
    testID,
  });
  const keyExtractor = useCallback((row: FileTreeVisibleRow) => row.path, []);
  const getItemLayout = useCallback(
    (_data: ArrayLike<FileTreeVisibleRow> | null | undefined, index: number) => ({
      length: metrics.itemHeight,
      offset: metrics.itemHeight * index,
      index,
    }),
    [metrics.itemHeight],
  );
  const getSelected = useCallback(() => new Set(controller.getSelectedPaths()), [controller]);
  const bodyHeight = showSearch ? Math.max(0, height - SEARCH_INPUT_HEIGHT) : height;

  return (
    <View
      ref={containerRef}
      role="tree"
      className={cn('overflow-hidden border border-border bg-surface-2', className)}
      style={[{ height }, style]}
      testID={testID}
    >
      {showSearch ? <FileTreeSearchInput query={search.query} onChangeQuery={synced.setSearchQuery} testID={testID} /> : null}
      <FileTreeScrollBody
        rows={rows}
        itemHeight={metrics.itemHeight}
        bodyHeight={bodyHeight}
        renderRow={renderRow}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        stickyEnabled={props.stickyHeaders ?? true}
        draggable={Boolean(props.draggable)}
        getSelected={getSelected}
        commitMove={synced.commitMove}
        emptyState={<FileTreeEmpty emptyState={emptyState} />}
        testID={testID}
      />
    </View>
  );
}

// ── Public surface ─────────────────────────────────────────────────────────
// `file-tree.tsx` is the package entry point (see package.json → "./file-tree"),
// so it re-exports the imperative escape hatch and every public type consumers
// need. Internal modules (controller internals, the render sub-components, the
// web/drag/selector hooks) stay unexported — reach them via the `model` from
// `useFileTree()` or the callbacks.
export type {
  FileTreeDensity,
  FileTreeGitStatus,
  FileTreeGitStatusCode,
  FileTreeGitStatusMap,
  FileTreeInitialExpansion,
  FileTreeKind,
  FileTreeSearchMode,
  FileTreeSelectionMode,
  FileTreeVisibleRow,
} from './file-tree.types';
export type { FileTreeController } from './file-tree-controller';
export type { FileTreeContextMenuEvent, FileTreeMoveEvent, FileTreeProps, FileTreeRenameEvent } from './file-tree-props';
// biome-ignore lint/performance/noBarrelFile: this IS the package entry point — one value re-export (the imperative hook) beside the component
export { type UseFileTreeConfig, useFileTree } from './use-file-tree';
