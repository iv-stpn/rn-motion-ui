// biome-ignore-all lint/style/noExcessiveLinesPerFile: stories + interaction tests for the whole browser kept together for easy editing
/** biome-ignore-all lint/style/useExportsLast: this a stories file */

import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { Choice, ControlRow, Controls, Note, Playground, Toggle } from '../../__stories__/story-harness';
import { cn } from '../../lib/cn';
import { Copy, FolderClosed, Link, Share2, Trash2 } from '../../lib/icons';
import { useThemeColors } from '../../theme/use-theme-color';
import { Button } from '../Button/button';
import { Text } from '../Text/text';
import { FileSystem } from './file-system';
import type {
  FileSystemContextMenuAction,
  FileSystemItem,
  FileSystemLoadChildrenArgs,
  FileSystemMoveEvent,
  FileSystemProps,
  FileSystemView,
  FileSystemViewerArgs,
} from './file-system.types';
import { FS_EMPTY_STATE_TEST_ID } from './file-system-body';
import { FS_HOVER_TEST_ID } from './file-system-hover';
import { FS_TILE_DROP_TARGET_TEST_ID } from './file-system-icons-tile';
import { FS_MARQUEE_TEST_ID } from './file-system-marquee';
import { FS_DRAG_CONTAINER_TEST_ID } from './use-file-system-drag';

// ─── Shared data ───────────────────────────────────────────────────────────────
// A small, deterministic manifest. Only files are listed at the top level —
// `Documents/` and `Photos/` are inferred from their paths — while `Archive/` is
// declared with `hasChildren` and no entries, so it only fills in through
// `loadChildren` (see LazyChildren below).

/**
 * Tiny (8–12px) PNGs as data URIs, upscaled by the tiles into abstract
 * gradients. Inline so the previews render identically on web and native, with
 * nothing to fetch and no fixture server in the test run.
 */
const PREVIEWS = {
  dunes:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAICAIAAABChommAAAASUlEQVR42mP4dqqLIGJ4u78RK/r/7RqczfB0cwVW9P/btf/frkHYDHdW5GNFEEUQNsOVOakEEcPpiTEEEcPh1mCCiGFXlRdBBAAh9rlFlMxWWwAAAABJRU5ErkJggg==',
  forest:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAICAIAAABChommAAAAN0lEQVR42mPYc20FQcSw/PAMgohh0oZOgoihdm4lQcSQ2Z1JEDGEVEQSRAz2qV4EEYNWkBVBBABKR40B+0IKAQAAAABJRU5ErkJggg==',
  harbour:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAICAIAAABChommAAAASUlEQVR42mOYdeoFQcTQufMmVvT/2zU4m6FyxWms6P+3a/+/XYOwGTKm78GKIIogbIaI9nUEEYN72XyCiME8dSJBxKAW0kQQAQDXyaIPabO+EAAAAABJRU5ErkJggg==',
  page: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAMCAIAAADQ/GvKAAAAUUlEQVR42mN49+4DVsTw5MkLrIjh1u37WBHD+YvXsSKGo8fPY0UMu/cdw4oYNm7ZhxUxLF+9FStimLtwLVbEMGn6UqyIoaNvDlbEUNcyBSsCAJYN0mFYbm40AAAAAElFTkSuQmCC',
};

/** Landscape photo proportions; documents keep the default portrait page. */
const PHOTO_RATIO = 1.5;

/** Fixed timestamps keep the Date Modified column and the date sorts stable. */
const DATES = {
  april: '2026-04-02T11:20:00.000Z',
  february: '2026-02-14T16:05:00.000Z',
  january: '2026-01-08T09:30:00.000Z',
  june: '2026-06-21T08:15:00.000Z',
  march: '2026-03-19T14:45:00.000Z',
  may: '2026-05-11T17:40:00.000Z',
};

const SAMPLE_ITEMS: FileSystemItem[] = [
  { hasChildren: true, kind: 'folder', path: 'Archive/', updatedAt: DATES.january },
  { createdAt: DATES.june, kind: 'file', path: 'README.md', size: 2480, updatedAt: DATES.june },
  { createdAt: DATES.may, kind: 'file', path: 'Invoice-0042.pdf', previewImageUrl: PREVIEWS.page, size: 84_120 },
  { createdAt: DATES.april, kind: 'file', path: 'Roadmap.pptx', size: 1_204_000, updatedAt: DATES.may },
  { createdAt: DATES.march, kind: 'file', path: 'Budget-2026.xlsx', size: 96_400, updatedAt: DATES.june },
  { createdAt: DATES.january, kind: 'file', path: 'Documents/Contract.docx', size: 48_900, updatedAt: DATES.february },
  { createdAt: DATES.february, kind: 'file', path: 'Documents/notes.txt', size: 1120, updatedAt: DATES.march },
  {
    createdAt: DATES.january,
    kind: 'file',
    path: 'Documents/Reports/Q1-report.pdf',
    // Three pages, two of them provided eagerly: the tile pager loads the third
    // through `loadPreviewImageUrl`.
    previewImageUrls: [PREVIEWS.page, PREVIEWS.page],
    previewPageCount: 3,
    size: 320_500,
    updatedAt: DATES.april,
  },
  {
    createdAt: DATES.april,
    kind: 'file',
    path: 'Documents/Reports/Q2-report.pdf',
    previewImageUrl: PREVIEWS.page,
    size: 298_100,
    updatedAt: DATES.june,
  },
  {
    createdAt: DATES.march,
    kind: 'file',
    path: 'Photos/dunes.jpg',
    previewAspectRatio: PHOTO_RATIO,
    previewImageUrl: PREVIEWS.dunes,
    size: 2_140_000,
    updatedAt: DATES.march,
    url: PREVIEWS.dunes,
  },
  {
    createdAt: DATES.may,
    kind: 'file',
    path: 'Photos/harbour.jpg',
    previewAspectRatio: PHOTO_RATIO,
    previewImageUrl: PREVIEWS.harbour,
    size: 1_880_000,
    updatedAt: DATES.may,
    url: PREVIEWS.harbour,
  },
  {
    createdAt: DATES.june,
    kind: 'file',
    path: 'Photos/forest.png',
    previewAspectRatio: PHOTO_RATIO,
    previewImageUrl: PREVIEWS.forest,
    size: 3_260_000,
    updatedAt: DATES.june,
    url: PREVIEWS.forest,
  },
];

/** What `Archive/` resolves to. Kept out of `items` so the load is observable. */
const ARCHIVE_ITEMS: FileSystemItem[] = [
  { createdAt: DATES.january, kind: 'file', path: 'Archive/2024-summary.pdf', previewImageUrl: PREVIEWS.page, size: 210_300 },
  { createdAt: DATES.january, kind: 'file', path: 'Archive/legacy.zip', size: 8_412_000 },
  { createdAt: DATES.january, kind: 'file', path: 'Archive/2024/minutes.docx', size: 22_600 },
];

/** Long enough for the loading placeholder to be observable, short enough to test. */
const LOAD_DELAY_MS = 120;

async function loadArchiveChildren() {
  await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));
  return { items: ARCHIVE_ITEMS };
}

/** Third page of the quarterly report, resolved on demand by the tile pager. */
async function loadPreviewImageUrl() {
  await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));
  return PREVIEWS.page;
}

// ─── Meta ─────────────────────────────────────────────────────────────────────
// 880px wide, which is above the tablet breakpoint: the four-tab view switcher
// and the inline search field are both shown. Narrower containers collapse them
// (see Compact) — the header reads the component's own width, not the window's.

const meta = {
  title: 'Components/FileSystem',
  component: FileSystem,
  decorators: [
    (Story) => (
      <View className="w-[880px] max-w-full">
        <Story />
      </View>
    ),
  ],
  args: {
    items: SAMPLE_ITEMS,
    title: 'Files',
    height: 460,
    loadChildren: fn(loadArchiveChildren),
    loadPreviewImageUrl,
    onSelectionChange: fn(),
    onViewChange: fn(),
  },
} satisfies Meta<typeof FileSystem>;

export default meta;

type Story = StoryObj<typeof meta>;

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
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function PlaygroundStatus({ message, onReset }: PlaygroundStatusProps) {
  return (
    <View className="mt-3 flex-row items-center gap-3">
      <Text className={cn('flex-1', message ? 'text-foreground' : 'text-muted-foreground')} size="xs">
        {message ?? PLAYGROUND_HINT}
      </Text>
      <Button onPress={onReset} size="sm" variant="secondary">
        {RESET_LABEL}
      </Button>
    </View>
  );
}

/** Which consumer-side features the playground wires up. Defaults to all of them. */
type PlaygroundOptions = { backgroundMenu: boolean; contextMenus: boolean; draggable: boolean; lazyChildren: boolean };

const ALL_FEATURES: PlaygroundOptions = { backgroundMenu: true, contextMenus: true, draggable: true, lazyChildren: true };

type FileSystemPlaygroundProps = FileSystemProps & { options?: PlaygroundOptions };

/**
 * Holds the manifest and applies both feature's events to it. Drag-and-drop and
 * the context menu are the two places where <FileSystem> asks the consumer to
 * change the data, so a playground for them has to own it.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
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
      <FileSystem
        {...args}
        draggable={options.draggable}
        getBackgroundContextMenuActions={options.backgroundMenu ? getBackgroundContextMenuActions : undefined}
        getContextMenuActions={options.contextMenus ? getContextMenuActions : undefined}
        items={state.items}
        loadChildren={options.lazyChildren ? loadChildren : undefined}
        onBackgroundContextMenuAction={handleBackgroundAction}
        onContextMenuAction={handleAction}
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
] as const satisfies readonly { value: FileSystemView; label: string }[];

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

/** Narrow enough to fold the view tabs into a dropdown and collapse the search field. */
const COMPACT_WIDTH = 420;
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
// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function FileSystemControls(args: FileSystemProps) {
  const [view, setView] = useState<FileSystemView>('icons');
  const [startKey, setStartKey] = useState<StartKey>('root');
  const [heightKey, setHeightKey] = useState<HeightKey>('460');
  const [compact, setCompact] = useState(false);
  const [draggable, setDraggable] = useState(true);
  const [multiSelect, setMultiSelect] = useState(true);
  const [contextMenus, setContextMenus] = useState(true);
  const [backgroundMenu, setBackgroundMenu] = useState(true);
  const [lazyChildren, setLazyChildren] = useState(true);
  const [withViewer, setWithViewer] = useState(true);

  const options = useMemo(
    () => ({ backgroundMenu, contextMenus, draggable, lazyChildren }),
    [backgroundMenu, contextMenus, draggable, lazyChildren],
  );

  return (
    <Playground>
      <Controls>
        <ControlRow>
          <Choice label="View" onChange={setView} options={VIEWS} value={view} />
          <Choice label="Start folder" onChange={setStartKey} options={START_OPTIONS} value={startKey} />
          <Choice label="Height" onChange={setHeightKey} options={HEIGHT_KEYS} value={heightKey} />
        </ControlRow>
        <ControlRow>
          <Toggle label="Compact width" onChange={setCompact} value={compact} />
          <Toggle label="Draggable" onChange={setDraggable} value={draggable} />
          <Toggle label="Multi-select" onChange={setMultiSelect} value={multiSelect} />
          <Toggle label="Entry menus" onChange={setContextMenus} value={contextMenus} />
          <Toggle label="Background menu" onChange={setBackgroundMenu} value={backgroundMenu} />
          <Toggle label="Lazy children" onChange={setLazyChildren} value={lazyChildren} />
          <Toggle label="Document viewer" onChange={setWithViewer} value={withViewer} />
        </ControlRow>
      </Controls>

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
          selectionMode={multiSelect ? 'multiple' : 'single'}
          view={view}
        />
      </View>
    </Playground>
  );
}

/** Every view, layout width and consumer-driven feature on one canvas. */
export const Interactive: Story = {
  render: (args) => <FileSystemControls {...args} />,
};

// ─── Views ─────────────────────────────────────────────────────────────────────

export const SwitchViews: Story = {
  name: 'Demo: Switch views',
  args: { testID: 'file-system-views' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Every entry answers to `<testID>-entry-<path>` whichever view is drawing
    // it, so one query holds across all four frames below.
    const readme = 'file-system-views-entry-README.md';

    // Grid is the default: tiles, no column headers.
    await canvas.findByText('README.md');
    await canvas.findByTestId(readme);
    expect(canvas.queryByText('Date Modified')).toBeNull();

    // List brings the sortable Name / Date Modified / Size header row.
    await userEvent.click(await canvas.findByLabelText('List view'));
    await canvas.findByText('Date Modified');
    await canvas.findByTestId(readme);
    await waitFor(() => expect(args.onViewChange).toHaveBeenCalledWith('list'));

    // Columns and Gallery keep the same entries, each in its own frame.
    await userEvent.click(await canvas.findByLabelText('Columns view'));
    await waitFor(() => expect(canvas.queryByText('Date Modified')).toBeNull());
    await canvas.findByText('README.md');
    await canvas.findByTestId(readme);

    await userEvent.click(await canvas.findByLabelText('Gallery view'));
    await waitFor(() => expect(args.onViewChange).toHaveBeenLastCalledWith('gallery'));
    await canvas.findByTestId(readme);
  },
};

// ─── Navigation ────────────────────────────────────────────────────────────────
// Activation is tap-to-select / tap-again-to-open, so a mouse double-click and a
// double tap take the same path. Opening a folder pushes it onto the history the
// Back and Forward buttons walk.

/**
 * Select an entry, then open it — two presses inside the double-tap window,
 * which is what a mouse double-click amounts to here.
 *
 * Deliberately not `userEvent.dblClick`: selecting re-renders the view and the
 * grid re-chunks its rows into fresh nodes, so the element captured before the
 * first press is detached by the time the second one would land on it. Querying
 * again in between is also the more faithful simulation — the component counts
 * two independent presses, not one double-click event.
 *
 * A file with a thumbnail labels its preview image with the file name too, so
 * the button role is what makes the tile itself unique.
 */
async function openTile(canvas: ReturnType<typeof within>, name: string): Promise<void> {
  await userEvent.click(await canvas.findByRole('button', { name }));
  await userEvent.click(await canvas.findByRole('button', { name }));
}

export const Navigate: Story = {
  name: 'Demo: Open a folder',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Photos');

    // Second press within the double-tap window opens instead of re-selecting.
    await openTile(canvas, 'Documents');

    // Inside `Documents/`: its own children, and nothing from the root.
    await canvas.findByText('Reports');
    await waitFor(() => expect(canvas.queryByText('Photos')).toBeNull());

    // The folder name lands in the header, and Back is now live.
    await canvas.findByText('Documents');
    await userEvent.click(await canvas.findByLabelText('Back'));
    await canvas.findByText('Photos');
  },
};

// ─── Search ────────────────────────────────────────────────────────────────────

export const Search: Story = {
  name: 'Demo: Search the folder',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('README.md');

    // Search spans the whole subtree, not just the open folder: a match keeps
    // the folders leading down to it, so `Documents/` stays for its reports.
    await userEvent.type(await canvas.findByLabelText('Search files'), 'report');
    await canvas.findByText('Documents');
    await waitFor(() => expect(canvas.queryByText('README.md')).toBeNull());

    // The status bar counts results rather than items while a query is active.
    await canvas.findByText('1 result');

    // Clearing restores the folder.
    await userEvent.click(await canvas.findByLabelText('Clear search'));
    await canvas.findByText('README.md');
  },
};

// ─── Filters ───────────────────────────────────────────────────────────────────
// The filter menu is a popover, so its rows are queried through `screen`; the
// resulting pill renders in the component itself.

export const Filter: Story = {
  name: 'Demo: Filter by file type',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Photos');

    await userEvent.click(await canvas.findByLabelText('Filter'));
    await userEvent.click(await screen.findByText('File type'));

    // Options come from the loaded manifest, labeled by MIME type.
    await userEvent.click(await screen.findByText('PDF'));

    // Only PDFs pass, so `Photos/` drops out while `Documents/` stays for its
    // reports. Folders are never filtered directly — they live through matches.
    await waitFor(() => expect(canvas.queryByText('Photos')).toBeNull());
    await canvas.findByText('Invoice-0042.pdf');

    // The applied filter reads back as a pill under the header.
    await canvas.findByLabelText('File types: PDF');
  },
};

/** Opens the toolbar filter menu on a date facet's preset panel. */
async function openDatePanel(canvas: ReturnType<typeof within>, facet: string) {
  await userEvent.click(await canvas.findByLabelText('Filter'));
  await userEvent.click(await screen.findByText(facet));
}

/**
 * A pill's value segment re-values the filter it stands for, rather than adding
 * another. Regression test: the pill's preset dropdown used to be handed the
 *facet* where its mutator matches on the filter's `id`, so nothing matched and
 * picking a preset was a silent no-op.
 */
export const FilterPillRevalue: Story = {
  name: 'Demo: Re-value a filter pill',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('README.md');

    await openDatePanel(canvas, 'Date modified');
    await userEvent.click(await screen.findByText('1 month ago'));

    // The pill reads back as `Date modified · after · 1 month ago`.
    await canvas.findByLabelText('Date: 1 month ago');

    // Re-valuing goes through the pill's own value segment, not the menu.
    await userEvent.click(await canvas.findByLabelText('Date: 1 month ago'));
    await userEvent.click(await screen.findByText('3 days ago'));

    await canvas.findByLabelText('Date: 3 days ago');
    // Re-valued in place: the older value is gone rather than sitting beside it.
    await waitFor(() => expect(canvas.queryByLabelText('Date: 1 month ago')).toBeNull());
  },
};

/**
 * The custom-range modal starts each visit from the filter's stored bounds.
 * Regression test: its draft used to live in a component mounted above the modal,
 * which outlived the request — so an abandoned draft came back on the next open.
 */
export const CustomRangeDraftIsPerVisit: Story = {
  name: 'Demo: Custom range starts fresh each visit',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('README.md');

    await openDatePanel(canvas, 'Date modified');
    await userEvent.click(await screen.findByText('Custom date range…'));

    // Type a draft, then abandon it.
    await userEvent.type(await screen.findByLabelText('From date'), '2026-03-01');
    await userEvent.click(await screen.findByText('Cancel'));
    await waitFor(() => expect(screen.queryByLabelText('From date')).toBeNull());

    // Reopening the same facet starts empty rather than resuming the draft.
    await openDatePanel(canvas, 'Date modified');
    await userEvent.click(await screen.findByText('Custom date range…'));
    await waitFor(() => expect(screen.getByLabelText('From date')).toHaveValue(''));
  },
};

// ─── Sort ──────────────────────────────────────────────────────────────────────

/** Matches a file name by its extension, so folder rows drop out of the order check. */
const FILE_NAME_PATTERN = /\.(docx|jpg|md|pdf|png|pptx|txt|xlsx|zip)$/;

/** Every rendered file name, in row order. */
function fileNames(canvas: ReturnType<typeof within>): string[] {
  const nodes: HTMLElement[] = canvas.getAllByText(FILE_NAME_PATTERN);
  return nodes.map((node) => node.textContent ?? '');
}

export const Sort: Story = {
  name: 'Demo: Sort by size',
  args: { defaultView: 'list' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('README.md');

    // Name ascending to begin with.
    expect(fileNames(canvas)[0]).toBe('Budget-2026.xlsx');

    // Size starts at its own default direction — largest first, like Finder.
    const sizeHeader = await canvas.findByText('Size');
    await userEvent.click(sizeHeader);
    await waitFor(() => expect(fileNames(canvas)[0]).toBe('Roadmap.pptx'));

    // Pressing the active column flips it.
    await userEvent.click(sizeHeader);
    await waitFor(() => expect(fileNames(canvas)[0]).toBe('README.md'));
  },
};

// ─── Selection ─────────────────────────────────────────────────────────────────

/** Long enough to clear RN's 500 ms `delayLongPress`. */
const LONG_PRESS_MS = 700;
/** The status bar's count clause, and its selection clause. */
const ITEM_COUNT_PATTERN = /items$/;
const SELECTION_CLAUSE_PATTERN = /selected$/;

function mouse(node: Element, type: string, init: MouseEventInit = {}) {
  node.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, cancelable: true, ...init }));
}

/**
 * Click `node` with Ctrl or Cmd held.
 *
 * A raw `click` rather than `userEvent.keyboard('{Control>}')` + `userEvent.click`:
 * the direct user-event API does not carry held-key state from one call into the
 * next, so the modifier never reaches the press. react-native-web derives
 * `onPress` from the native `click` (not from the responder system), so one
 * dispatched event is the whole gesture — and it is exactly what a browser sends.
 */
function modifierClick(node: Element, ...modifiers: ('ctrlKey' | 'metaKey' | 'shiftKey')[]) {
  mouse(node, 'click', Object.fromEntries(modifiers.map((key) => [key, true])));
}

/** The prefix `fileSystemEntryTestID` gives every row and tile. */
const ENTRY_TEST_ID_PREFIX = 'file-system-entry-';

/**
 * The paths currently painted as selected, in view order.
 *
 * Reads `aria-selected`, which every row and tile carries for assistive tech, so
 * the assertion is against what a screen reader is told rather than against a
 * class name. Identity comes from the entry test id — a list row's accessible
 * name is its cells run together, which is no way to name a file.
 */
function selectedPaths(canvas: ReturnType<typeof within>): string[] {
  const nodes: HTMLElement[] = canvas.getAllByRole('button');
  return nodes
    .filter((node) => node.getAttribute('aria-selected') === 'true')
    .map((node) => node.getAttribute('data-testid') ?? '')
    .filter((id) => id.startsWith(ENTRY_TEST_ID_PREFIX))
    .map((id) => id.slice(ENTRY_TEST_ID_PREFIX.length));
}

/**
 * Press and hold `node` until the long press resolves.
 *
 * Raw MouseEvents rather than `userEvent.pointer`: react-native-web's responder
 * system listens on `mousedown`/`mouseup`, and user-event's drag-select
 * emulation fires a `selectionchange` the responder reads as a terminated
 * gesture — which cancels the press before the long-press timer fires.
 */
async function longPress(node: Element): Promise<void> {
  mouse(node, 'mousedown');
  await new Promise((resolve) => setTimeout(resolve, LONG_PRESS_MS));
  mouse(node, 'mouseup');
  // RNW cancels the click that follows a dispatched long press; the gesture is
  // already delivered by then, so the event is sent for fidelity, not effect.
  mouse(node, 'click');
}

/**
 * `selectionMode="multiple"` adds the two gestures a file browser is expected to
 * have: Ctrl-click (Cmd-click on macOS) on web, and a long-press on touch. Both
 * toggle the entry under the pointer in or out of the selection; a plain press
 * still replaces it, and a press on the background still clears it.
 *
 * The selected set arrives through `onSelectedItemsChange`, in the order the
 * entries were picked. `onSelectionChange` keeps its single-entry shape and
 * follows the *lead* — the one added most recently — which is what the columns
 * trail, the gallery stage and the preview pane keep showing.
 *
 * Long-press is the entry context menu's trigger on touch, and multi-selection
 * takes it over; right-click still opens the menu on web.
 */
export const MultiSelect: Story = {
  name: 'Demo: Select several entries',
  args: { selectionMode: 'multiple', onSelectedItemsChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const footer = await canvas.findByText(ITEM_COUNT_PATTERN);

    // A plain press is still a plain selection.
    await userEvent.click(await canvas.findByRole('button', { name: 'Documents' }));
    await canvas.findByText('· “Documents” selected');

    // Ctrl held, the second press adds instead of replacing.
    modifierClick(await canvas.findByRole('button', { name: 'Photos' }), 'ctrlKey');
    await canvas.findByText('· 2 selected');
    await waitFor(() =>
      expect(args.onSelectedItemsChange).toHaveBeenLastCalledWith([
        expect.objectContaining({ name: 'Documents' }),
        expect.objectContaining({ name: 'Photos' }),
      ]),
    );
    // The lead follows the entry added last, so single-selection consumers still
    // get something coherent out of a multi-selection.
    expect(args.onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Photos' }));

    // Cmd is the same modifier on macOS, where Ctrl-click is a right-click.
    modifierClick(await canvas.findByRole('button', { name: 'Budget-2026.xlsx' }), 'metaKey');
    await canvas.findByText('· 3 selected');

    // A long press is the same toggle without a keyboard — the touch gesture.
    await longPress(await canvas.findByRole('button', { name: 'README.md' }));
    await canvas.findByText('· 4 selected');

    // And it takes back out again.
    await longPress(await canvas.findByRole('button', { name: 'README.md' }));
    await canvas.findByText('· 3 selected');

    // Clear is the way out where there is no background left to tap.
    await userEvent.click(await canvas.findByLabelText('Clear selection'));
    await waitFor(() => expect(args.onSelectedItemsChange).toHaveBeenLastCalledWith([]));
    expect(footer).toBeInTheDocument();
    await waitFor(() => expect(canvas.queryByText(SELECTION_CLAUSE_PATTERN)).toBeNull());
  },
};

/**
 * Shift-click takes the contiguous run from the *anchor* — the last entry picked
 * without Shift — to the entry pressed, in the order the surface you pressed
 * lays its entries out. The anchor deliberately stays put, so shift-clicking
 * around grows and shrinks one run from a fixed origin rather than accumulating.
 *
 * Hold Ctrl/Cmd as well and the run is added to what is already selected, which
 * is how a selection made of several separate runs gets built.
 *
 * The ordering comes from the view, not the store: the list view runs through
 * its rows as drawn (an expanded folder's children included, since they sit
 * between their parent and its next sibling), while the columns view keeps each
 * pane to itself.
 */
export const ShiftRange: Story = {
  name: 'Demo: Select a range',
  args: { defaultView: 'list', selectionMode: 'multiple', onSelectedItemsChange: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('README.md');

    // Rows sort by name alone, folders and files together:
    // Archive/, Budget-2026.xlsx, Documents/, Invoice-0042.pdf, Photos/, README.md, Roadmap.pptx.
    // The plain press sets the anchor the run will measure from.
    await userEvent.click(await listRow(canvas, 'Budget-2026.xlsx'));
    await canvas.findByText('· “Budget-2026.xlsx” selected');

    modifierClick(await listRow(canvas, 'Photos'), 'shiftKey');
    await canvas.findByText('· 4 selected');
    expect(selectedPaths(canvas)).toEqual(['Budget-2026.xlsx', 'Documents/', 'Invoice-0042.pdf', 'Photos/']);

    // The anchor held, so a second Shift-click re-measures rather than extends.
    modifierClick(await listRow(canvas, 'Documents'), 'shiftKey');
    await canvas.findByText('· 2 selected');
    expect(selectedPaths(canvas)).toEqual(['Budget-2026.xlsx', 'Documents/']);

    // Ctrl moves the anchor and keeps what is there; Shift then runs from it,
    // replacing — so the two rows added by Ctrl-then-Shift are all that is left.
    modifierClick(await listRow(canvas, 'Roadmap.pptx'), 'ctrlKey');
    await canvas.findByText('· 3 selected');
    modifierClick(await listRow(canvas, 'README.md'), 'shiftKey');
    await canvas.findByText('· 2 selected');
    expect(selectedPaths(canvas)).toEqual(['README.md', 'Roadmap.pptx']);

    // Shift with Ctrl adds a second run instead of replacing the first.
    modifierClick(await listRow(canvas, 'Archive'), 'ctrlKey');
    modifierClick(await listRow(canvas, 'Documents'), 'ctrlKey', 'shiftKey');
    await canvas.findByText('· 5 selected');
    expect(selectedPaths(canvas)).toEqual(['Archive/', 'Budget-2026.xlsx', 'Documents/', 'README.md', 'Roadmap.pptx']);
  },
};

// ─── Lazy children ─────────────────────────────────────────────────────────────

export const LazyChildren: Story = {
  name: 'Demo: Load a folder on demand',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // `Archive/` ships with `hasChildren` and no entries, so opening it is what
    // triggers `loadChildren` — cursor-paged, drained before the rows appear.
    await openTile(canvas, 'Archive');
    await waitFor(() => expect(args.loadChildren).toHaveBeenCalledWith({ cursor: null, path: 'Archive/' }));

    await canvas.findByText('legacy.zip');
    await canvas.findByText('2024');

    // Loaded children are kept, so a second visit costs nothing.
    await userEvent.click(await canvas.findByLabelText('Back'));
    await openTile(canvas, 'Archive');
    await canvas.findByText('legacy.zip');
    expect(args.loadChildren).toHaveBeenCalledTimes(1);
  },
};

// ─── Viewer ────────────────────────────────────────────────────────────────────

export const ImageViewer: Story = {
  name: 'Demo: Open an image',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await openTile(canvas, 'Photos');
    await canvas.findByText('dunes.jpg');

    // Images are the one kind the component views itself; everything else needs
    // `renderFileViewer` (see WithFileViewer) or falls through to `onFileOpen`.
    await openTile(canvas, 'dunes.jpg');
    await screen.findByLabelText('Close');
    await waitFor(() => expect(args.onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'dunes.jpg' })));

    await userEvent.click(await screen.findByLabelText('Close'));
  },
};

/**
 * `renderFileViewer` supplies the document body the package deliberately ships
 * without: hand back a PDF/DOCX/XLSX renderer and those kinds become openable in
 * place, alongside the built-in image viewer.
 */
export const WithFileViewer: Story = {
  name: 'Demo: Bring your own document viewer',
  args: { renderFileViewer: renderPlaceholderViewer },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await openTile(canvas, 'Invoice-0042.pdf');
    await screen.findByText(VIEWER_PLACEHOLDER);
    await userEvent.click(await screen.findByLabelText('Close'));
  },
};

// ─── Compact ───────────────────────────────────────────────────────────────────

/**
 * A narrow container. The view switcher becomes a dropdown, search collapses to
 * a button that reveals its field beneath the header, and the sort trigger drops
 * its label — all driven by the component's measured width, so this is what a
 * sidebar-width panel looks like on a desktop too.
 */
export const Compact: Story = {
  name: 'Demo: Compact layout',
  decorators: [
    (Story) => (
      <View className="w-[420px] max-w-full">
        <Story />
      </View>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The four tabs give way to a dropdown trigger. The header starts from the
    // window width and only knows its own after the first layout pass, so the
    // narrow arrangement lands a frame in.
    await waitFor(() => expect(canvas.queryByLabelText('Gallery view')).toBeNull());

    // Search is a toggle here, and the field arrives in its own row. Do this
    // before touching the view dropdown: react-native-web's Modal traps focus
    // for as long as it is mounted — the whole exit animation included — and
    // hands focus back to the trigger when the trap unmounts, so a field that
    // autofocuses in that window loses the caret twice over.
    await userEvent.click(await canvas.findByLabelText('Search'));
    await userEvent.type(await canvas.findByLabelText('Search files'), 'notes');
    await canvas.findByText('1 result');
    await userEvent.click(await canvas.findByLabelText('Clear search'));

    await userEvent.click(await canvas.findByLabelText('View'));
    await userEvent.click(await screen.findByText('List'));
    await canvas.findByText('Name');
  },
};

// ─── Context menu ──────────────────────────────────────────────────────────────

/** Actions vary by entry kind; folders expose fewer operations than files. */
function resolveContextMenuActions(item: FileSystemItem): FileSystemContextMenuAction[] {
  const common: FileSystemContextMenuAction[] = [
    { id: 'rename', label: 'Rename…' },
    { id: 'move', label: 'Move to…' },
    { id: 'delete', label: 'Delete', destructive: true },
  ];
  if (item.kind === 'file')
    return [
      { id: 'open', label: 'Open' },
      { id: 'download', label: 'Download' },
      { id: 'copy-link', label: 'Copy link' },
      ...common,
    ];
  return [{ id: 'open', label: 'Open' }, ...common];
}

/**
 * Right-click any entry (web) or long-press it (native) to see the context
 * menu. The chosen action is reported to `onContextMenuAction`.
 */
export const WithContextMenu: Story = {
  name: 'Demo: Context menu',
  args: {
    getContextMenuActions: resolveContextMenuActions,
    onContextMenuAction: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('README.md');

    // Right-click a file to open its context menu.
    const readmeTile = await canvas.findByRole('button', { name: 'README.md' });
    await userEvent.pointer({ target: readmeTile, keys: '[MouseRight]' });

    // The menu resolves async — wait for at least one action to appear.
    const openAction = await screen.findByText('Open');
    expect(screen.getByText('Download')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();

    // Selecting an action fires the callback and closes the menu.
    await userEvent.click(openAction);
    await waitFor(() =>
      expect(args.onContextMenuAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'open' }),
        expect.objectContaining({ path: 'README.md' }),
      ),
    );
  },
};

/**
 * Right-click (or long-press) an empty area of the file browser — not on any
 * entry — to open the background context menu. It carries folder-level actions
 * that make sense without a target: new folder, paste, and so on. Entry-level
 * right-clicks still open the per-entry menu; they stop propagation so the
 * background listener never fires.
 */
export const WithBackgroundContextMenu: Story = {
  name: 'Demo: Background context menu',
  args: {
    getBackgroundContextMenuActions: (): FileSystemContextMenuAction[] => [
      { id: 'new-folder', label: 'New folder' },
      { disabled: true, id: 'paste', label: 'Paste' },
    ],
    onBackgroundContextMenuAction: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('README.md');

    // Right-click an empty tile area — any part of the container that is not a
    // button. The drag container is the registered listener target.
    const container = await canvas.findByTestId(FS_DRAG_CONTAINER_TEST_ID.icons);
    await userEvent.pointer({ target: container, keys: '[MouseRight]' });

    // Both actions appear; Paste is disabled.
    await screen.findByText('New folder');
    await expect(await screen.findByRole('menuitem', { name: 'Paste' })).toHaveAttribute('aria-disabled', 'true');

    // Picking an enabled action fires the callback and closes the menu.
    await userEvent.click(await screen.findByText('New folder'));
    await waitFor(() =>
      expect(args.onBackgroundContextMenuAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-folder' })),
    );
  },
};

// ─── Drag and drop ─────────────────────────────────────────────────────────────
// The play tests drive the drag with real PointerEvents rather than `userEvent`:
// the web transport takes pointer capture, and capture only works for a pointer
// the browser considers active, so the ids and coordinates have to line up. Each
// call below is one event the browser itself would send.

type ClientPoint = { x: number; y: number };

const DRAG_POINTER_ID = 9;

/** Centre of `node`, in the client coordinates the pointer stream carries. */
function centreOf(node: Element): ClientPoint {
  const rect = node.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * The row carrying `name` in the list view. Its accessible name concatenates the
 * date and size cells, so the name text is the anchor and the row is the
 * Pressable above it — the element whose 30px box the resolver maps back to.
 */
async function listRow(canvas: ReturnType<typeof within>, name: string): Promise<Element> {
  const label = await canvas.findByText(name);
  const row = label.closest('[role="button"]');
  if (!row) throw new Error(`no row rendered for ${name}`);
  return row;
}

/** Dispatch one pointer event of `type` at a client point, as the browser would. */
function pointer(node: Element, type: string, point: ClientPoint) {
  node.dispatchEvent(
    new PointerEvent(type, {
      pointerId: DRAG_POINTER_ID,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: point.x,
      clientY: point.y,
      bubbles: true,
      cancelable: true,
    }),
  );
}

/**
 * Walk the pointer from `source` to `target` in steps, as a real stream would
 * arrive, and stop there — still pressed. Split from the release below so a test
 * can inspect the live drop feedback before the drag commits and it disappears.
 */
function dragOver(container: Element, source: ClientPoint, target: ClientPoint) {
  const steps = 6;
  for (let step = 1; step <= steps; step += 1) {
    const ratio = step / steps;
    pointer(container, 'pointermove', {
      x: source.x + (target.x - source.x) * ratio,
      y: source.y + (target.y - source.y) * ratio,
    });
  }
}

/** Walk the pointer to `target` and release it there, committing the drop. */
function dragTo(container: Element, source: ClientPoint, target: ClientPoint) {
  dragOver(container, source, target);
  pointer(container, 'pointerup', target);
}

/**
 * `draggable` enables pointer-capture drag on web and long-press pan on native.
 * Drag an entry onto a folder — an outline marks the live drop target — to fire
 * `onMove` with the dragged path and the destination folder path. The list and
 * grid views wire the gesture; columns and gallery accept the props silently.
 *
 * `onMove` reports; it does not mutate. Nothing appears to move here because the
 * story hands back the same `items` either way — see Interactive for the half
 * that owns the manifest.
 */
export const WithDragAndDrop: Story = {
  name: 'Demo: Drag and drop',
  args: {
    defaultView: 'list',
    draggable: true,
    onMove: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Roadmap.pptx');

    // The transport listens on the scroll container, which is also the frame the
    // drop outline is drawn in — the same node a real press bubbles up to.
    const container = await canvas.findByTestId(FS_DRAG_CONTAINER_TEST_ID.list);
    const row = await listRow(canvas, 'Roadmap.pptx');
    const source = centreOf(row);
    const target = centreOf(await listRow(canvas, 'Documents'));

    // Press and go straight into the drag: a mouse has nothing to disambiguate,
    // so movement past the slop is the whole arming signal.
    pointer(row, 'pointerdown', source);
    dragTo(container, source, target);
    await waitFor(() => expect(args.onMove).toHaveBeenCalledWith({ destination: 'Documents/', sources: ['Roadmap.pptx'] }));

    // The release also fires a click on whatever the drag ended on. It must not
    // land: letting it through would select or open the drop target. The
    // container swallows it in the capture phase, above the row, so the row's own
    // listeners never run — which is what this spy checks.
    const dropRow = await listRow(canvas, 'Documents');
    const clicked = fn();
    dropRow.addEventListener('click', clicked);
    dropRow.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await expect(clicked).not.toHaveBeenCalled();

    // Suppression is one-shot: the next click is a real one and gets through.
    dropRow.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await expect(clicked).toHaveBeenCalledTimes(1);
    dropRow.removeEventListener('click', clicked);
  },
};

/**
 * The same gesture in the grid, where the drop target is marked by the folder's
 * own name filling in under a hover-tinted glyph rather than a row highlight.
 * This is the view Interactive opens in.
 */
export const GridDragAndDrop: Story = {
  name: 'Demo: Drag a tile onto a folder',
  args: { draggable: true, onMove: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const container = await canvas.findByTestId(FS_DRAG_CONTAINER_TEST_ID.icons);
    // A tile's accessible name is just the entry name, so the button role is the
    // whole query — the tile box is what the 2-D resolver maps a point back to.
    const tile = await canvas.findByRole('button', { name: 'Roadmap.pptx' });
    const folderTile = await canvas.findByRole('button', { name: 'Documents' });
    const source = centreOf(tile);
    const target = centreOf(folderTile);

    pointer(tile, 'pointerdown', source);
    dragOver(container, source, target);

    // Hold the drag over the folder and read its two marks. The pending drop is
    // the folder's *name* lighting up, with the hover tint on the glyph above it
    // — so the drop mark sits below the highlight, not around it.
    const dropTarget = await canvas.findByTestId(FS_TILE_DROP_TARGET_TEST_ID);
    const highlight = await canvas.findByTestId(FS_HOVER_TEST_ID.icons);
    // The highlight glides between cells (MOVE_MS), so wait for it to land on
    // the folder's glyph box: narrower than the tile, centred, pinned to its top.
    const tileBox = folderTile.getBoundingClientRect();
    await waitFor(async () => {
      const highlightBox = highlight.getBoundingClientRect();
      await expect(highlightBox.width).toBeLessThan(tileBox.width);
      await expect(highlightBox.height).toBeLessThan(tileBox.height);
      await expect(highlightBox.left + highlightBox.width / 2).toBeCloseTo(tileBox.left + tileBox.width / 2, 0);
      await expect(highlightBox.top).toBeCloseTo(tileBox.top, 0);
    });

    // And the drop mark is the label chip under that glyph, inside the same tile.
    const targetBox = dropTarget.getBoundingClientRect();
    const highlightBox = highlight.getBoundingClientRect();
    await expect(targetBox.top).toBeGreaterThanOrEqual(highlightBox.bottom - 1);
    await expect(targetBox.bottom).toBeLessThanOrEqual(tileBox.bottom + 1);
    await expect(dropTarget).toHaveTextContent('Documents');

    pointer(container, 'pointerup', target);
    await waitFor(() => expect(args.onMove).toHaveBeenCalledWith({ destination: 'Documents/', sources: ['Roadmap.pptx'] }));
  },
};

/** A folder cannot land inside itself or its own subtree, so no drop is reported. */
export const DragIntoOwnSubtree: Story = {
  name: 'Demo: Rejected drop',
  args: { defaultView: 'list', draggable: true, onMove: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const container = await canvas.findByTestId(FS_DRAG_CONTAINER_TEST_ID.list);
    // Expand `Documents/` so its own child folder is a row beneath it.
    await userEvent.click(await canvas.findByLabelText('Expand Documents'));
    const row = await listRow(canvas, 'Documents');
    const source = centreOf(row);
    const target = centreOf(await listRow(canvas, 'Reports'));

    // `Documents/Reports/` is inside `Documents/`: a valid-looking folder row
    // that would make the path circular, so the drop finds no target at all.
    pointer(row, 'pointerdown', source);
    dragTo(container, source, target);
    await expect(args.onMove).not.toHaveBeenCalled();

    // The same folder, the same gesture, a destination outside its subtree: this
    // one reports. Without it the assertion above would also pass on a drag that
    // never armed at all.
    const sibling = centreOf(await listRow(canvas, 'Photos'));
    pointer(row, 'pointerdown', source);
    dragTo(container, source, sibling);
    await waitFor(() => expect(args.onMove).toHaveBeenCalledWith({ destination: 'Photos/', sources: ['Documents/'] }));
  },
};

/**
 * A drag lifted from a selected entry carries the whole selection: `onMove`
 * reports every path at once rather than firing once per entry. Members the drop
 * would not move — the destination itself, entries already inside it, a folder
 * dropped into its own subtree — are filtered out first, and nothing fires when
 * that leaves the list empty.
 *
 * Lifting an *unselected* entry is still a single-entry drag; the selection
 * elsewhere in the folder does not ride along.
 */
export const MultiSelectDrag: Story = {
  name: 'Demo: Drag a multi-selection',
  args: { defaultView: 'list', draggable: true, selectionMode: 'multiple', onMove: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const container = await canvas.findByTestId(FS_DRAG_CONTAINER_TEST_ID.list);

    await userEvent.click(await listRow(canvas, 'README.md'));
    modifierClick(await listRow(canvas, 'Roadmap.pptx'), 'ctrlKey');
    await canvas.findByText('· 2 selected');

    const row = await listRow(canvas, 'README.md');
    const source = centreOf(row);
    const target = centreOf(await listRow(canvas, 'Photos'));
    pointer(row, 'pointerdown', source);
    dragTo(container, source, target);

    await waitFor(() =>
      expect(args.onMove).toHaveBeenCalledWith({
        destination: 'Photos/',
        sources: expect.arrayContaining(['README.md', 'Roadmap.pptx']),
      }),
    );
  },
};

/**
 * The selection box: press on empty space in the grid and drag, and everything
 * the band touches is selected live as it is drawn. Web only — a finger dragged
 * across a grid scrolls it, and there is no modifier on a touchscreen to say
 * otherwise — and only under `selectionMode="multiple"`.
 *
 * It never fights the drag, because the two are cut from one hit test: a press
 * lands on a tile, where a drag lifts, or it does not, where the band starts.
 * That same strictness is why a press in the gutter *between* two tiles now
 * starts a band rather than lifting whichever tile was nearest.
 *
 * Hold Ctrl/Cmd as you start the band to add to the selection instead of
 * replacing it.
 */
export const SelectionBox: Story = {
  name: 'Demo: Drag a selection box',
  args: { selectionMode: 'multiple', draggable: true, onMove: fn(), onSelectedItemsChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const container = await canvas.findByTestId(FS_DRAG_CONTAINER_TEST_ID.icons);
    await canvas.findByText('Archive');

    // Tiles run in name order, so the first two are Archive/ and Budget-2026.xlsx.
    // Start below them — empty space, where no tile can lift — and sweep up.
    const bounds = container.getBoundingClientRect();
    const first = centreOf(await canvas.findByRole('button', { name: 'Archive' }));
    const second = centreOf(await canvas.findByRole('button', { name: 'Budget-2026.xlsx' }));
    const origin = { x: bounds.left + 4, y: bounds.top + bounds.height - 4 };

    pointer(container, 'pointerdown', origin);
    dragOver(container, origin, second);

    // The band is up and painting while the pointer is still down.
    expect(await canvas.findByTestId(FS_MARQUEE_TEST_ID)).toBeInTheDocument();
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['Archive/', 'Budget-2026.xlsx']));

    pointer(container, 'pointerup', second);
    // The click the browser sends after the release is swallowed: without that,
    // the container's background press would clear the band on the frame it ended.
    mouse(container, 'click');
    await canvas.findByText('· 2 selected');
    await waitFor(() =>
      expect(args.onSelectedItemsChange).toHaveBeenLastCalledWith([
        expect.objectContaining({ name: 'Archive' }),
        expect.objectContaining({ name: 'Budget-2026.xlsx' }),
      ]),
    );

    // A band is not a drag: nothing was moved by drawing one over the tiles.
    expect(args.onMove).not.toHaveBeenCalled();

    // A shorter sweep takes fewer tiles, so the band tracks the pointer rather
    // than latching onto whatever it first touched.
    pointer(container, 'pointerdown', origin);
    dragOver(container, origin, first);
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['Archive/']));
    pointer(container, 'pointerup', first);
    mouse(container, 'click');

    // And an ordinary click on the background still clears — the gate only ever
    // swallows the click that follows a band that actually drew.
    mouse(container, 'click');
    await waitFor(() => expect(canvas.queryByText(SELECTION_CLAUSE_PATTERN)).toBeNull());
  },
};

// ─── Playground ────────────────────────────────────────────────────────────────
// Interactive itself carries no play function — it is a playground, and a test
// would hand it to you already half-mutated. These two run the same component
// instead, so the manifest rewrites behind both features stay covered.

/**
 * The consumer half of a drop. `onMove` only reports; the row moves because the
 * story rewrites its own `items` — subtree included, which is why the entry is
 * found again inside the destination rather than merely gone from the root.
 */
export const PlaygroundDrop: Story = {
  name: 'Demo: Playground — a drop rewrites the list',
  args: { defaultView: 'list' },
  render: (args) => <FileSystemPlayground {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Roadmap.pptx');

    const container = await canvas.findByTestId(FS_DRAG_CONTAINER_TEST_ID.list);
    const row = await listRow(canvas, 'Roadmap.pptx');
    const source = centreOf(row);
    const target = centreOf(await listRow(canvas, 'Documents'));

    pointer(row, 'pointerdown', source);
    dragTo(container, source, target);

    // The status line names the move, and the root no longer lists the entry:
    // it is inside `Documents/`, which is still collapsed.
    await canvas.findByText('Moved Roadmap.pptx to Documents/');
    await waitFor(() => expect(canvas.queryByText('Roadmap.pptx')).toBeNull());

    // Expanding the destination finds it under its new parent.
    await userEvent.click(await canvas.findByLabelText('Expand Documents'));
    await canvas.findByText('Roadmap.pptx');

    // Reset restores the manifest and clears the status line back to the hint.
    await userEvent.click(await canvas.findByText('Reset'));
    await canvas.findByText(PLAYGROUND_HINT);
  },
};

/** Open the menu on the entry named `name` and wait for `action` to be pickable. */
async function pickMenuAction(canvas: ReturnType<typeof within>, name: string, action: string): Promise<void> {
  const tile = await canvas.findByRole('button', { name });
  await userEvent.pointer({ target: tile, keys: '[MouseRight]' });
  await userEvent.click(await screen.findByText(action));
}

/**
 * The consumer half of a menu pick: duplicate, delete and new-folder each rewrite
 * the manifest, so every action here changes the grid you are looking at.
 */
export const PlaygroundMenuActions: Story = {
  name: 'Demo: Playground — menu actions rewrite the list',
  render: (args) => <FileSystemPlayground {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('README.md');

    // A file's menu carries `Share…` disabled. A menuitem is a div, not a form
    // control, so the state it exposes is `aria-disabled` — the dimming alone
    // would leave a screen reader calling the row actionable.
    await userEvent.pointer({ target: await canvas.findByRole('button', { name: 'README.md' }), keys: '[MouseRight]' });
    await expect(await screen.findByRole('menuitem', { name: 'Share…' })).toHaveAttribute('aria-disabled', 'true');

    // Duplicate names the copy before the extension and puts it beside the file.
    await userEvent.click(await screen.findByText('Duplicate'));
    await canvas.findByText('Duplicated README.md');
    await canvas.findByText('README copy.md');

    // Delete drops it again.
    await pickMenuAction(canvas, 'README copy.md', 'Delete');
    await canvas.findByText('Deleted README copy.md');
    await waitFor(() => expect(canvas.queryByText('README copy.md')).toBeNull());

    // New folder lands in the clicked entry's parent — the root here — so the row
    // appears in the view you are already in, rather than behind a navigation.
    await pickMenuAction(canvas, 'README.md', 'New folder');
    await canvas.findByText(`Created ${NEW_FOLDER_NAME} in Files`);
    await canvas.findByText(NEW_FOLDER_NAME);

    // A folder's menu has no `Share…`, and its own actions still apply.
    await pickMenuAction(canvas, NEW_FOLDER_NAME, 'Delete');
    await canvas.findByText(`Deleted ${NEW_FOLDER_NAME}`);
    await waitFor(() => expect(canvas.queryByText(NEW_FOLDER_NAME)).toBeNull());
  },
};

// ─── Body wrapper ──────────────────────────────────────────────────────────────
// `renderBody` wraps the file area rather than replacing it: the active view (or
// the placeholder standing in for it) arrives as `content` and goes back into a
// tree of your own. The state that produced it comes along, so the wrapper reacts
// to the same selection, view and folder the views do without recomputing any of
// it — and because the slot is *called* rather than mounted as a component, the
// views underneath keep their scroll offset and panes across these re-renders.

const DROP_HINT = 'Drop files here to upload';
const NO_SELECTION = 'Nothing selected';

/** Sits over the file area whenever the folder has nothing in it. */
const dropHint = (
  <View className="absolute inset-x-0 bottom-0 items-center p-3">
    <Text className="text-muted-foreground" size="xs">
      {DROP_HINT}
    </Text>
  </View>
);

/** A details rail beside the views, driven entirely by the slot's own state. */
const renderBodyWithRail: FileSystemProps['renderBody'] = ({ content, currentPath, entries, isEmpty, selectedEntry, view }) => (
  <View className="flex-1 flex-row">
    <View className="min-h-0 flex-1">
      {content}
      {isEmpty ? dropHint : null}
    </View>
    <View className="w-48 gap-1 border-border border-l p-3">
      <Text size="xs" weight="medium">
        {selectedEntry?.name ?? NO_SELECTION}
      </Text>
      <Text className="text-muted-foreground" size="xs">
        {`${entries.length} in ${currentPath || 'Files'}`}
      </Text>
      <Text className="text-muted-foreground" size="xs">
        {`${view} view`}
      </Text>
    </View>
  </View>
);

export const WithBodyWrapper: Story = {
  name: 'Demo: Wrap the file area',
  args: { renderBody: renderBodyWithRail },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The default content still renders, and the rail reads the state it came from:
    // seven entries at the root — Archive/, Documents/, Photos/ and four files.
    await canvas.findByText('README.md');
    await canvas.findByText(NO_SELECTION);
    await canvas.findByText('7 in Files');
    await canvas.findByText('icons view');

    // Selecting shows the name twice over: once on the tile, once in the rail.
    await userEvent.click(await canvas.findByRole('button', { name: 'README.md' }));
    await waitFor(async () => expect(await canvas.findAllByText('README.md')).toHaveLength(2));
    await waitFor(() => expect(canvas.queryByText(NO_SELECTION)).toBeNull());

    // Navigating rewires both halves at once.
    await openTile(canvas, 'Documents');
    await canvas.findByText('3 in Documents/');

    // Switching views re-renders the wrapper with the view it switched to.
    await userEvent.click(await canvas.findByLabelText('List view'));
    await canvas.findByText('list view');
  },
};

/** The wrapper is still what fills the area when the placeholder is the content. */
export const BodyWrapperEmpty: Story = {
  name: 'Demo: Wrap an empty file area',
  args: {
    items: [],
    loadChildren: undefined,
    renderBody: ({ content, isEmpty }) => (
      <View className="flex-1">
        {content}
        {isEmpty ? dropHint : null}
      </View>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('This folder is empty');
    await canvas.findByText(DROP_HINT);
  },
};

// ─── Empty ─────────────────────────────────────────────────────────────────────

export const Empty: Story = {
  name: 'Demo: Empty state',
  args: { items: [], loadChildren: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('This folder is empty');
    await canvas.findByText('0 items');
  },
};

const EMPTY_CTA = 'Add your first file';
const onEmptyCtaPress = fn();

/**
 * `renderEmptyState` replaces the placeholder that stands in for the file area
 * when there is nothing to show. `reason` distinguishes the four cases — an empty
 * folder, a search with no hits, filters that match nothing, a folder still
 * loading — and `label` carries the copy the default would have used, so a slot
 * can restyle a message without rewriting it.
 *
 * Returning `undefined` keeps the built-in placeholder for that state. That's
 * what makes this per-reason rather than all-or-nothing: this story takes over
 * the empty folder and leaves the search and loading placeholders alone.
 */
export const WithCustomEmptyState: Story = {
  name: 'Demo: Custom empty state',
  args: {
    items: [],
    loadChildren: undefined,
    renderEmptyState: ({ folderName, reason }) =>
      reason === 'empty-folder' ? (
        <View className="flex-1 items-center justify-center gap-2">
          <Text size="sm" weight="semibold">
            {`${folderName} is ready`}
          </Text>
          <Button onPress={onEmptyCtaPress} size="sm" variant="secondary">
            {EMPTY_CTA}
          </Button>
        </View>
      ) : undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The slot draws the empty folder — `folderName` is the `title` at the root.
    await canvas.findByText('Files is ready');
    await canvas.findByRole('button', { name: EMPTY_CTA });
    expect(canvas.queryByText('This folder is empty')).toBeNull();

    // A search empties the folder for a different reason, and the slot declines
    // it by returning `undefined` — so the built-in copy is what shows.
    await userEvent.type(await canvas.findByLabelText('Search files'), 'invoice');
    await canvas.findByText('No results for “invoice”');
    await waitFor(() => expect(canvas.queryByText('Files is ready')).toBeNull());
  },
};

/**
 * The placeholder is mounted in the same background surface the list and icons
 * views use, so a right-click (or long-press) on an empty folder opens
 * `getBackgroundContextMenuActions` just as it does over a folder with entries.
 * An empty folder is where "New folder" matters most, and it holds for a custom
 * `renderEmptyState` too — the slot's tree goes inside that surface.
 */
export const EmptyStateBackgroundMenu: Story = {
  name: 'Demo: Background menu on an empty folder',
  args: {
    items: [],
    loadChildren: undefined,
    getBackgroundContextMenuActions: (): FileSystemContextMenuAction[] => [{ id: 'new-folder', label: 'New folder' }],
    onBackgroundContextMenuAction: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('This folder is empty');

    // No view to right-click, so the placeholder's own node is the listener target.
    const placeholder = await canvas.findByTestId(FS_EMPTY_STATE_TEST_ID);
    await userEvent.pointer({ target: placeholder, keys: '[MouseRight]' });

    await userEvent.click(await screen.findByText('New folder'));
    await waitFor(() =>
      expect(args.onBackgroundContextMenuAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-folder' })),
    );
  },
};
