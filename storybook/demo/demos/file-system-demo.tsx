import { useCallback, useState } from 'react';
import { View } from 'react-native';
import type {
  FileSystemContextMenuAction,
  FileSystemItem,
  FileSystemLoadChildrenArgs,
  FileSystemMoveEvent,
  FileSystemViewerArgs,
} from 'rn-motion-ui/file-system';
import { FileSystem } from 'rn-motion-ui/file-system';
import { GlossyButton } from 'rn-motion-ui/glossy-button';
import { Text } from 'rn-motion-ui/text';
import { useThemeColors } from 'rn-motion-ui/theme/use-theme-color';
import { Copy2Line } from 'rn-motion-ui-icons/icons/copy-2-line';
import { Delete2Line } from 'rn-motion-ui-icons/icons/delete-2-line';
import { Link3Line } from 'rn-motion-ui-icons/icons/link-3-line';
import { NewFolderLine } from 'rn-motion-ui-icons/icons/new-folder-line';
import { ShareForwardLine } from 'rn-motion-ui-icons/icons/share-forward-line';
import { Caption, Panel } from './demo-chrome';
import {
  ARCHIVE_ITEMS,
  applyDelete,
  applyDuplicate,
  applyMove,
  applyNewFolder,
  baseName,
  folderLabel,
  LOAD_DELAY_MS,
  parentPrefix,
  SAMPLE_ITEMS,
} from './file-system-manifest';

const HINT =
  'Tap to select, tap again to open. Drag an entry onto a folder to move it. Right-click (or long-press) an entry for its menu, or empty space for folder actions. Archive/ loads its children on first visit.';
const IDLE_STATUS = 'Nothing rewritten yet.';
const RESET_LABEL = 'Reset';
const VIEWER_PLACEHOLDER = 'Your PDF renderer goes here';
const FS_HEIGHT = 460;

const ACTION = { copyPath: 'copy-path', delete: 'delete', duplicate: 'duplicate', newFolder: 'new-folder', share: 'share' };

type DemoState = { items: FileSystemItem[]; status: string | null };

const INITIAL_STATE: DemoState = { items: SAMPLE_ITEMS, status: null };

/**
 * One menu pick against the manifest. Pure, so the rewrite and the line that
 * describes it are decided together — the numbering `applyNewFolder` resolves has
 * to see the very list the folder is added to.
 */
function applyAction(state: DemoState, actionId: string, path: string): DemoState {
  const { items } = state;
  const name = baseName(path);
  switch (actionId) {
    case ACTION.duplicate:
      return { items: applyDuplicate(items, path), status: `Duplicated ${name}` };
    case ACTION.delete:
      return { items: applyDelete(items, path), status: `Deleted ${name}` };
    case ACTION.newFolder: {
      const parent = parentPrefix(path);
      const created = applyNewFolder(items, parent);
      return { items: created.items, status: `Created ${baseName(created.path)} in ${folderLabel(parent)}` };
    }
    case ACTION.copyPath:
      return { ...state, status: `Copied path ${path}` };
    default:
      return state;
  }
}

/** Menus differ by kind, and `Share…` is disabled to show that state. */
function menuActionsFor(item: FileSystemItem, tint: string, danger: string): FileSystemContextMenuAction[] {
  const shared: FileSystemContextMenuAction[] = [
    { icon: <Copy2Line color={tint} size={16} />, id: ACTION.duplicate, label: 'Duplicate' },
    { icon: <Link3Line color={tint} size={16} />, id: ACTION.copyPath, label: 'Copy path' },
    { icon: <NewFolderLine color={tint} size={16} />, id: ACTION.newFolder, label: 'New folder' },
  ];
  const remove: FileSystemContextMenuAction = {
    destructive: true,
    icon: <Delete2Line color={danger} size={16} />,
    id: ACTION.delete,
    label: 'Delete',
  };
  if (item.kind === 'folder') return [...shared, remove];
  return [
    ...shared,
    { disabled: true, icon: <ShareForwardLine color={tint} size={16} />, id: ACTION.share, label: 'Share…' },
    remove,
  ];
}

/** Stand-in for the document renderer the package leaves to the consumer. */
function renderPlaceholderViewer({ file }: FileSystemViewerArgs) {
  return (
    <View className="flex-1 items-center justify-center gap-1 rounded-lg bg-surface-2 p-6">
      <Text size="sm" weight="semibold">
        {file.name}
      </Text>
      <Text className="text-muted-foreground" size="xs">
        {VIEWER_PLACEHOLDER}
      </Text>
    </View>
  );
}

/**
 * The Finder-style browser over a flat manifest. The demo owns the list, because
 * <FileSystem> reports what the user did and leaves the rewrite to its consumer:
 * a drop fires `onMove`, a menu pick fires `onContextMenuAction`, and the status
 * line below names whichever one landed last.
 */
export function FileSystemDemo() {
  const [state, setState] = useState<DemoState>(INITIAL_STATE);
  const colors = useThemeColors();

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  // The component keeps its own copy of whatever `loadChildren` resolves to, and
  // that copy would survive a delete here — so the demo takes the children into
  // its own state and hands back an empty page. One manifest, one owner.
  const loadChildren = useCallback(async ({ path }: FileSystemLoadChildrenArgs) => {
    await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));
    if (path === 'Archive/') setState((previous) => ({ ...previous, items: [...previous.items, ...ARCHIVE_ITEMS] }));
    return { items: [] };
  }, []);

  const handleMove = useCallback(({ sources, destination }: FileSystemMoveEvent) => {
    const source = sources[0];
    if (source === undefined) return;
    setState((previous) => ({
      items: applyMove(previous.items, source, destination),
      status: `Moved ${baseName(source)} to ${folderLabel(destination)}`,
    }));
  }, []);

  const handleAction = useCallback((action: FileSystemContextMenuAction, item: FileSystemItem) => {
    setState((previous) => applyAction(previous, action.id, item.path));
  }, []);

  const getContextMenuActions = useCallback(
    (item: FileSystemItem) => menuActionsFor(item, colors.foreground, colors.danger),
    [colors],
  );

  // Background actions carry no path, so `newFolder` creates in the root here.
  const getBackgroundContextMenuActions = useCallback(
    (): FileSystemContextMenuAction[] => [
      { icon: <NewFolderLine color={colors.foreground} size={16} />, id: ACTION.newFolder, label: 'New folder' },
    ],
    [colors],
  );
  const handleBackgroundAction = useCallback((action: FileSystemContextMenuAction) => {
    setState((previous) => applyAction(previous, action.id, ''));
  }, []);

  return (
    <Panel>
      <Caption>{HINT}</Caption>
      <FileSystem
        draggable={true}
        getBackgroundContextMenuActions={getBackgroundContextMenuActions}
        getContextMenuActions={getContextMenuActions}
        height={FS_HEIGHT}
        items={state.items}
        loadChildren={loadChildren}
        onBackgroundContextMenuAction={handleBackgroundAction}
        onContextMenuAction={handleAction}
        onMove={handleMove}
        renderFileViewer={renderPlaceholderViewer}
        title="Files"
      />
      <View className="flex-row items-center gap-3">
        <Text className={state.status ? 'flex-1 text-foreground' : 'flex-1 text-muted-foreground'} size="xs">
          {state.status ?? IDLE_STATUS}
        </Text>
        <GlossyButton onPress={reset} size="sm" variant="neutral">
          {RESET_LABEL}
        </GlossyButton>
      </View>
    </Panel>
  );
}
