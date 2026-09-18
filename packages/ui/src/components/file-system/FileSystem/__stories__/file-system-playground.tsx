import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CopyLine as Copy } from 'rn-motion-ui-icons/icons/copy-line';
import { Delete2Line as Trash2 } from 'rn-motion-ui-icons/icons/delete-2-line';
import { FileLine as FileText } from 'rn-motion-ui-icons/icons/file-line';
import { FolderLine as FolderClosed } from 'rn-motion-ui-icons/icons/folder-line';
import { LinkLine as Link } from 'rn-motion-ui-icons/icons/link-line';
import { ShareForwardLine as Share2 } from 'rn-motion-ui-icons/icons/share-forward-line';
import { Choice, ControlCard, Note, Playground, Toggle } from '../../../../__stories__/story-harness';
import { cn } from '../../../../lib/cn';
import { useThemeColors } from '../../../../theme/use-theme-color';
import { Button } from '../../../buttons/Button/button';
import { Draggable } from '../../../gestures/Draggable/draggable';
import { Text } from '../../../typography/Text/text';
import { FileSystem } from '../file-system';
import type {
  FileSystemContextMenuAction,
  FileSystemExternalDropEvent,
  FileSystemHeaderState,
  FileSystemItem,
  FileSystemLoadChildrenArgs,
  FileSystemMoveEvent,
  FileSystemProps,
  FileSystemView,
  FileSystemViewerArgs,
} from '../types/file-system.types';
import { FilterBar } from './file-system-filter-bar';
import { ARCHIVE_ITEMS, DATES, LOAD_DELAY_MS, SAMPLE_ITEMS } from './file-system-story-data';

// ─── External-drop tray ───────────────────────────────────────────────────────

const EXTERNAL_DROP_MIME = 'application/x-fs-item';

/** Draggable items that live outside the FileSystem and can be dropped into it. */
const TRAY_ITEMS: FileSystemItem[] = [
  { kind: 'file', name: 'invoice.pdf', path: 'invoice.pdf' },
  { kind: 'file', name: 'photo.jpg', path: 'photo.jpg' },
  { kind: 'file', name: 'notes.txt', path: 'notes.txt' },
];

type DraggableChipProps = { item: FileSystemItem };

/**
 * A tray chip, dragged by `Draggable`.
 *
 * The payload is the whole point: `data` writes the item under the same MIME
 * `handleExternalDrop` reads it back from, so the drop side of this story needs to
 * know nothing about where the drag came from. On web that is a real HTML5 drag
 * and `dataTransfer` is the browser's own; on native the same payload reaches the
 * FileSystem through the drag registry.
 */
function DraggableChip({ item }: DraggableChipProps) {
  return (
    <Draggable
      accessibilityLabel={`Drag ${item.name} into the file browser`}
      accessibilityRole="button"
      data={{ [EXTERNAL_DROP_MIME]: JSON.stringify(item) }}
      effectAllowed="copy"
    >
      <View className="hairline flex-row items-center gap-1.5 rounded-md border-border bg-surface-2 px-3 py-1.5">
        <FileText size={14} />
        <Text size="sm">{item.name}</Text>
      </View>
    </Draggable>
  );
}

function ExternalFileTray() {
  return (
    <View className="mb-3 flex-row flex-wrap gap-2">
      {TRAY_ITEMS.map((item) => (
        <DraggableChip key={item.path} item={item} />
      ))}
    </View>
  );
}

// ─── Interactive ───────────────────────────────────────────────────────────────
// The playground owns the manifest, because <FileSystem> never mutates `items`:
// a drop reports `onMove` and a menu pick reports `onContextMenuAction`, and
// what happens next is the consumer's. The helpers below are what that consumer
// side looks like — plain rewrites over the flat path list, no tree to rebuild.

/** Everything up to and including the last slash: the entry's parent prefix. */
function parentPrefix(path: string): string {
  const body = path.endsWith('/') ? path.slice(0, -1) : path;
  const cut = body.lastIndexOf('/');
  return cut === -1 ? '' : body.slice(0, cut + 1);
}

/** Last path segment, without the folder's trailing slash. */
function baseName(path: string): string {
  const body = path.endsWith('/') ? path.slice(0, -1) : path;
  return body.slice(body.lastIndexOf('/') + 1);
}

/**
 * `path` rewritten to sit under `destination`. Folder paths keep their trailing
 * slash, so a prefix test is a subtree test: every descendant is rewritten by
 * swapping the same leading run of characters.
 */
function movePath(path: string, source: string, destination: string): string {
  const moved = destination + baseName(source) + (source.endsWith('/') ? '/' : '');
  return path === source ? moved : moved + path.slice(source.length);
}

/**
 * True for the entry itself and everything beneath it. Folder paths end in `/`,
 * so `startsWith` on a folder path can only match its own descendants.
 */
function isInSubtree(path: string, root: string): boolean {
  return path === root || path.startsWith(root);
}

/** Apply a drop: the dragged entry and its whole subtree land under `destination`. */
function applyMove(items: FileSystemItem[], source: string, destination: string): FileSystemItem[] {
  return items.map((item) =>
    isInSubtree(item.path, source) ? { ...item, path: movePath(item.path, source, destination) } : item,
  );
}

/** ` copy` before the extension for files, `Name copy/` for folders. */
function copyName(path: string): string {
  if (path.endsWith('/')) return `${path.slice(0, -1)} copy/`;
  const dot = path.lastIndexOf('.');
  const cut = dot > path.lastIndexOf('/') ? dot : path.length;
  return `${path.slice(0, cut)} copy${path.slice(cut)}`;
}

/** Duplicate an entry, subtree included, beside the original. */
function applyDuplicate(items: FileSystemItem[], source: string): FileSystemItem[] {
  const target = copyName(source);
  const copies = items
    .filter((item) => isInSubtree(item.path, source))
    .map((item) => ({ ...item, path: target + item.path.slice(source.length) }));
  // An inferred folder has no entry of its own, so declare the copy explicitly.
  if (source.endsWith('/') && !copies.some((item) => item.path === target))
    copies.unshift({ kind: 'folder', path: target, updatedAt: DATES.june });
  return [...items, ...copies];
}

/** Drop an entry and everything beneath it. */
function applyDelete(items: FileSystemItem[], source: string): FileSystemItem[] {
  return items.filter((item) => !isInSubtree(item.path, source));
}

const NEW_FOLDER_NAME = 'untitled folder';

type NewFolderResult = { items: FileSystemItem[]; path: string };

/** An `untitled folder` in `parent`, numbered until the name is free. */
function applyNewFolder(items: FileSystemItem[], parent: string): NewFolderResult {
  const taken = (candidate: string) => items.some((item) => isInSubtree(item.path, candidate));
  let path = `${parent}${NEW_FOLDER_NAME}/`;
  for (let n = 2; taken(path); n += 1) path = `${parent}${NEW_FOLDER_NAME} ${n}/`;
  return { items: [...items, { kind: 'folder', path, updatedAt: DATES.june }], path };
}

const ACTION = {
  copyPath: 'copy-path',
  delete: 'delete',
  duplicate: 'duplicate',
  newFolder: 'new-folder',
  paste: 'paste',
  share: 'share',
};

/** The root is the empty path; name it after the title the header shows. */
function folderLabel(path: string): string {
  return path === '' ? 'Files' : path;
}

type PlaygroundState = { items: FileSystemItem[]; status: string | null };

const INITIAL_STATE: PlaygroundState = { items: SAMPLE_ITEMS, status: null };

/**
 * One menu pick against the manifest. Pure, so the rewrite and the line that
 * describes it are decided together — the numbering `applyNewFolder` resolves
 * has to see the very list the folder is added to.
 */
function applyAction(state: PlaygroundState, actionId: string, path: string): PlaygroundState {
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

const PLAYGROUND_HINT =
  'Drag an entry onto a folder to move it. Right-click (or long-press) any entry for its menu, or right-click empty space for folder actions.';
const RESET_LABEL = 'Reset';

type PlaygroundStatusProps = { message: string | null; onReset: () => void };

/** Reads back the last mutation, so a move or a delete is legible without diffing rows. */
function PlaygroundStatus({ message, onReset }: PlaygroundStatusProps) {
  return (
    <View className="mt-3 flex-row items-center gap-3">
      <Text className={cn('flex-1', message ? 'text-foreground' : 'text-muted-foreground')} size="xs">
        {message ?? PLAYGROUND_HINT}
      </Text>
      <Button onPress={onReset} size="sm" variant="neutral">
        {RESET_LABEL}
      </Button>
    </View>
  );
}

/** Which consumer-side features the playground wires up. Defaults to all of them. */
type PlaygroundOptions = {
  backgroundMenu: boolean;
  contextMenus: boolean;
  draggable: boolean;
  externalDrop: boolean;
  lazyChildren: boolean;
};

const ALL_FEATURES: PlaygroundOptions = {
  backgroundMenu: true,
  contextMenus: true,
  draggable: true,
  externalDrop: false,
  lazyChildren: true,
};

/** The same playground with the tray showing — see PlaygroundExternalDrop. */
const EXTERNAL_DROP_FEATURES: PlaygroundOptions = { ...ALL_FEATURES, externalDrop: true };

type FileSystemPlaygroundProps = FileSystemProps & { options?: PlaygroundOptions };

/**
 * Holds the manifest and applies both feature's events to it. Drag-and-drop and
 * the context menu are the two places where <FileSystem> asks the consumer to
 * change the data, so a playground for them has to own it.
 */
function FileSystemPlayground({ options = ALL_FEATURES, ...args }: FileSystemPlaygroundProps) {
  // One state, so each handler is a single pure rewrite: the status line always
  // describes the list rendered beside it, and nothing needs a second setState.
  const [state, setState] = useState<PlaygroundState>(INITIAL_STATE);
  const colors = useThemeColors();

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  // The component keeps its own copy of whatever `loadChildren` resolves to, and
  // that copy would survive a delete here — so the playground takes the children
  // into its own state and hands back an empty page. One manifest, one owner.
  const loadChildren = useCallback(async ({ path }: FileSystemLoadChildrenArgs) => {
    await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));
    if (path === 'Archive/') setState((previous) => ({ ...previous, items: [...previous.items, ...ARCHIVE_ITEMS] }));
    return { items: [] };
  }, []);

  const handleExternalDrop = useCallback(({ destination, dataTransfer }: FileSystemExternalDropEvent) => {
    const raw = dataTransfer.getData(EXTERNAL_DROP_MIME);
    if (!raw) return;
    const item: FileSystemItem = JSON.parse(raw);
    const destLabel = folderLabel(destination);
    setState((previous) => ({
      items: [...previous.items, { ...item, path: destination + item.name }],
      status: `Added ${item.name} to ${destLabel}`,
    }));
  }, []);

  const handleMove = useCallback(({ sources, destination }: FileSystemMoveEvent) => {
    if (sources.length === 0) return;
    setState((previous) => {
      let items = previous.items;
      for (const source of sources) items = applyMove(items, source, destination);
      const firstName = sources[0];
      const label = sources.length === 1 && firstName ? baseName(firstName) : `${sources.length} items`;
      return { items, status: `Moved ${label} to ${folderLabel(destination)}` };
    });
  }, []);

  const handleAction = useCallback((action: FileSystemContextMenuAction, item: FileSystemItem) => {
    setState((previous) => applyAction(previous, action.id, item.path));
  }, []);

  const getBackgroundContextMenuActions = useCallback((): FileSystemContextMenuAction[] => {
    const tint = colors.foreground;
    return [
      { icon: <FolderClosed color={tint} size={16} />, id: ACTION.newFolder, label: 'New folder' },
      { disabled: true, icon: <Copy color={tint} size={16} />, id: ACTION.paste, label: 'Paste' },
    ];
  }, [colors]);

  // Background actions don't carry a path — `newFolder` creates in the root here
  // because the playground has no navigation hook to track the current folder.
  const handleBackgroundAction = useCallback((action: FileSystemContextMenuAction) => {
    setState((previous) => applyAction(previous, action.id, ''));
  }, []);

  // Menus differ by kind, and `Share…` is disabled to show that state. The new
  // folder lands beside the entry you clicked rather than inside it, so the row
  // appears where you are instead of behind a navigation.
  const getContextMenuActions = useCallback(
    (item: FileSystemItem): FileSystemContextMenuAction[] => {
      const tint = colors.foreground;
      const shared: FileSystemContextMenuAction[] = [
        { icon: <Copy color={tint} size={16} />, id: ACTION.duplicate, label: 'Duplicate' },
        { icon: <Link color={tint} size={16} />, id: ACTION.copyPath, label: 'Copy path' },
        { icon: <FolderClosed color={tint} size={16} />, id: ACTION.newFolder, label: 'New folder' },
      ];
      const remove: FileSystemContextMenuAction = {
        destructive: true,
        icon: <Trash2 color={colors.danger} size={16} />,
        id: ACTION.delete,
        label: 'Delete',
      };
      if (item.kind === 'folder') return [...shared, remove];
      return [...shared, { disabled: true, icon: <Share2 color={tint} size={16} />, id: ACTION.share, label: 'Share…' }, remove];
    },
    [colors],
  );

  return (
    <View>
      {options.externalDrop ? <ExternalFileTray /> : null}
      <FileSystem
        {...args}
        draggable={options.draggable}
        getBackgroundContextMenuActions={options.backgroundMenu ? getBackgroundContextMenuActions : undefined}
        getContextMenuActions={options.contextMenus ? getContextMenuActions : undefined}
        items={state.items}
        loadChildren={options.lazyChildren ? loadChildren : undefined}
        onBackgroundContextMenuAction={handleBackgroundAction}
        onContextMenuAction={handleAction}
        onExternalDrop={options.externalDrop ? handleExternalDrop : undefined}
        onMove={handleMove}
      />
      <PlaygroundStatus message={state.status} onReset={reset} />
    </View>
  );
}

const VIEWS = [
  { value: 'icons', label: 'Grid' },
  { value: 'list', label: 'List' },
  { value: 'columns', label: 'Columns' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'mobile-grid', label: 'Grid (mobile)' },
  { value: 'mobile-list', label: 'List (mobile)' },
] as const satisfies readonly { value: FileSystemView; label: string }[];

// A consumer-built view switcher. The built-in switcher was removed in favour of
// the headless `renderHeader` slot, so the stories that exercise switching hand
// their own header back: tabs at full width, a dropdown once `isCompact` flips —
// the same responsive hint the store still computes.
function ViewSwitcherHeader({ isCompact, setView, view }: Pick<FileSystemHeaderState, 'isCompact' | 'setView' | 'view'>) {
  const [open, setOpen] = useState(false);
  return isCompact ? (
    <View>
      <Pressable
        accessibilityLabel="View"
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}
        className="rounded-md px-2.5 py-1"
      >
        <Text size="sm">View</Text>
      </Pressable>
      {open ? (
        <View className="hairline absolute right-2 z-10 mt-1 rounded-md border-border bg-surface-2 p-1">
          {VIEWS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                setView(option.value);
                setOpen(false);
              }}
              className="rounded-sm px-3 py-1"
            >
              <Text size="sm">{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  ) : (
    <View accessibilityRole="tablist" className="flex-row items-center gap-1">
      {VIEWS.map((option) => (
        <Pressable
          accessibilityLabel={`${option.label} view`}
          accessibilityRole="tab"
          accessibilityState={{ selected: option.value === view }}
          key={option.value}
          onPress={() => setView(option.value)}
          className={cn('rounded-md px-2.5 py-1', option.value === view && 'bg-surface-3')}
        >
          <Text size="sm">{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const renderViewSwitcherHeader = (state: FileSystemHeaderState) => (
  <ViewSwitcherHeader isCompact={state.isCompact} setView={state.setView} view={state.view} />
);

// `defaultPath` seeds the history on mount, so switching the start folder remounts
// the browser rather than navigating it.
const START_PATHS = { root: '', documents: 'Documents/', photos: 'Photos/' } as const;
type StartKey = keyof typeof START_PATHS;

const START_OPTIONS = [
  { value: 'root', label: 'Root' },
  { value: 'documents', label: 'Documents/' },
  { value: 'photos', label: 'Photos/' },
] as const satisfies readonly { value: StartKey; label: string }[];

const HEIGHTS = { '380': 380, '460': 460, '560': 560 } as const;
type HeightKey = keyof typeof HEIGHTS;
const HEIGHT_KEYS = ['380', '460', '560'] as const satisfies readonly HeightKey[];

/** Narrow enough to flip the `isCompact` hint the consumer's own switcher keys off. */
const COMPACT_WIDTH = 420;
/** A phone-width container for the two mobile views. */
const MOBILE_WIDTH = 360;
/** A tablet-width container, to show the mobile grid packing past two columns. */
const TABLET_WIDTH = 768;
const VIEWER_NOTE = 'Only images open in place without a viewer — everything else needs `renderFileViewer`.';

const VIEWER_PLACEHOLDER = 'Your PDF renderer goes here';

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
 * The full playground. Drag an entry onto a folder — the outline marks the live
 * target — and it moves, subtree included; a folder cannot be dropped into itself
 * or its own descendant, so those drags simply find no target. Right-click
 * (long-press on touch) any entry for a menu that duplicates, deletes or adds a
 * folder beside it. Both report to the story, which rewrites the manifest and
 * names what it did below.
 *
 * Everything else is live too: tap to select, tap again to open, `Archive/` loads
 * its children on first visit, and the quarterly report's third page loads when
 * the tile pager reaches it.
 */
function FileSystemControls(args: FileSystemProps) {
  const [view, setView] = useState<FileSystemView>('icons');
  const [startKey, setStartKey] = useState<StartKey>('root');
  const [heightKey, setHeightKey] = useState<HeightKey>('460');
  const [compact, setCompact] = useState(false);
  const [draggable, setDraggable] = useState(true);
  const [externalDrop, setExternalDrop] = useState(false);
  const [multiSelect, setMultiSelect] = useState(true);
  const [contextMenus, setContextMenus] = useState(true);
  const [backgroundMenu, setBackgroundMenu] = useState(true);
  const [lazyChildren, setLazyChildren] = useState(true);
  const [withViewer, setWithViewer] = useState(true);
  const [withFilters, setWithFilters] = useState(false);

  const options = useMemo(
    () => ({ backgroundMenu, contextMenus, draggable, externalDrop, lazyChildren }),
    [backgroundMenu, contextMenus, draggable, externalDrop, lazyChildren],
  );

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="View" onChange={setView} options={VIEWS} value={view} />
        <Choice label="Start folder" onChange={setStartKey} options={START_OPTIONS} value={startKey} />
        <Choice label="Height" onChange={setHeightKey} options={HEIGHT_KEYS} value={heightKey} />
        <Toggle label="Compact width" onChange={setCompact} value={compact} />
        <Toggle label="Draggable" onChange={setDraggable} value={draggable} />
        <Toggle label="External drop" onChange={setExternalDrop} value={externalDrop} />
        <Toggle label="Multi-select" onChange={setMultiSelect} value={multiSelect} />
        <Toggle label="Entry menus" onChange={setContextMenus} value={contextMenus} />
        <Toggle label="Background menu" onChange={setBackgroundMenu} value={backgroundMenu} />
        <Toggle label="Lazy children" onChange={setLazyChildren} value={lazyChildren} />
        <Toggle label="Document viewer" onChange={setWithViewer} value={withViewer} />
        <Toggle label="Filters & search" onChange={setWithFilters} value={withFilters} />
      </ControlCard>

      <Note>{VIEWER_NOTE}</Note>

      <View style={compact ? { width: COMPACT_WIDTH } : undefined}>
        <FileSystemPlayground
          {...args}
          defaultPath={START_PATHS[startKey]}
          height={HEIGHTS[heightKey]}
          key={startKey}
          onViewChange={setView}
          options={options}
          renderFileViewer={withViewer ? renderPlaceholderViewer : undefined}
          renderFilters={withFilters ? (state) => <FilterBar {...state} /> : undefined}
          selectionMode={multiSelect ? 'multiple' : 'single'}
          view={view}
        />
      </View>
    </Playground>
  );
}

export {
  EXTERNAL_DROP_FEATURES,
  FileSystemControls,
  FileSystemPlayground,
  MOBILE_WIDTH,
  NEW_FOLDER_NAME,
  PLAYGROUND_HINT,
  renderPlaceholderViewer,
  renderViewSwitcherHeader,
  TABLET_WIDTH,
  VIEWER_PLACEHOLDER,
};
