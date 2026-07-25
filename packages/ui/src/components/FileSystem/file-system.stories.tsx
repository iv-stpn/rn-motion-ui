// biome-ignore-all lint/style/noExcessiveLinesPerFile: stories + interaction tests for the whole browser kept together for easy editing
/** biome-ignore-all lint/style/useExportsLast: this a stories file */

import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { Text } from '../Text/text';
import { FileSystem } from './file-system';
import type { FileSystemContextMenuAction, FileSystemItem, FileSystemViewerArgs } from './file-system.types';

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
      <View style={{ maxWidth: '100%', width: 880 }}>
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

/**
 * The full playground. Tap an entry to select it, tap again to open it — folders
 * navigate, images open in the viewer modal. `Archive/` loads its children on
 * first visit, and the quarterly report's third page loads when the tile pager
 * reaches it.
 */
export const Interactive: Story = {};

// ─── Views ─────────────────────────────────────────────────────────────────────

export const SwitchViews: Story = {
  name: 'Demo: Switch views',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Grid is the default: tiles, no column headers.
    await canvas.findByText('README.md');
    expect(canvas.queryByText('Date Modified')).toBeNull();

    // List brings the sortable Name / Date Modified / Size header row.
    await userEvent.click(await canvas.findByLabelText('List view'));
    await canvas.findByText('Date Modified');
    await waitFor(() => expect(args.onViewChange).toHaveBeenCalledWith('list'));

    // Columns and Gallery keep the same entries, each in its own frame.
    await userEvent.click(await canvas.findByLabelText('Columns view'));
    await waitFor(() => expect(canvas.queryByText('Date Modified')).toBeNull());
    await canvas.findByText('README.md');

    await userEvent.click(await canvas.findByLabelText('Gallery view'));
    await waitFor(() => expect(args.onViewChange).toHaveBeenLastCalledWith('gallery'));
  },
};

/** Column panes, Finder-style: each selection opens the next pane to its right. */
export const Columns: Story = { args: { defaultView: 'columns' } };

/** One large preview over a filmstrip of the folder's entries. */
export const Gallery: Story = { args: { defaultView: 'gallery' } };

/** The disclosure list, with sortable Name / Date Modified / Size columns. */
export const List: Story = { args: { defaultView: 'list' } };

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

const VIEWER_PLACEHOLDER = 'Your PDF renderer goes here';

/**
 * `renderFileViewer` supplies the document body the package deliberately ships
 * without: hand back a PDF/DOCX/XLSX renderer and those kinds become openable in
 * place, alongside the built-in image viewer.
 */
export const WithFileViewer: Story = {
  name: 'Demo: Bring your own document viewer',
  args: {
    renderFileViewer: ({ file }: FileSystemViewerArgs) => (
      <View className="flex-1 items-center justify-center gap-1 rounded-lg bg-surface-2 p-6">
        <Text size="sm" weight="semibold">
          {file.name}
        </Text>
        <Text className="text-muted-foreground" size="xs">
          {VIEWER_PLACEHOLDER}
        </Text>
      </View>
    ),
  },
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
      <View style={{ maxWidth: '100%', width: 420 }}>
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
