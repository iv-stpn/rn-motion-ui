import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { renderPlaceholderViewer, renderViewSwitcherHeader, VIEWER_PLACEHOLDER } from './__stories__/file-system-playground';
import { FILE_SYSTEM_ARGS, FILE_SYSTEM_DECORATORS } from './__stories__/file-system-story-meta';
import { openTile } from './__stories__/file-system-story-testing';
import { FileSystem } from './file-system';
import { FS_DRAG_CONTAINER_TEST_ID } from './logic/file-system-test-id';
import type { FileSystemContextMenuAction, FileSystemItem } from './types/file-system.types';

const meta = {
  title: 'File System/FileSystem',
  component: FileSystem,
  parameters: { layout: 'centered' },
  decorators: FILE_SYSTEM_DECORATORS,
  args: FILE_SYSTEM_ARGS,
} satisfies Meta<typeof FileSystem>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Viewer ────────────────────────────────────────────────────────────────────

export const ImageViewer: Story = {
  name: 'Demo: Open an image',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await openTile(canvas, 'Photos');
    await canvas.findAllByText('dunes.jpg');

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
 * A narrow container. The consumer's own switcher (supplied via `renderHeader`)
 * becomes a dropdown once the component measures itself below the tablet
 * breakpoint — `isCompact` in the header state, the same hint the removed
 * built-in switcher keyed off. Search and filters are also the consumer's UI
 * now (see `renderFilters`), so how they collapse is up to the bar you supply.
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
  args: { renderHeader: renderViewSwitcherHeader },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The four tabs give way to a dropdown trigger. The header starts from the
    // window width and only knows its own after the first layout pass, so the
    // narrow arrangement lands a frame in.
    await waitFor(() => expect(canvas.queryByLabelText('Gallery view')).toBeNull());

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
    await canvas.findAllByText('README.md');

    // Right-click a file to open its context menu.
    const readmeTile = await canvas.findByRole('button', { name: 'README.md' });
    await userEvent.pointer({ target: readmeTile, keys: '[MouseRight]' });

    // The menu resolves async — wait for at least one action to appear. Roles,
    // not text: `HoldMenu` keeps an `aria-hidden` measurement copy of every
    // entry's rows off-screen, and `getByText` matches those too.
    const openAction = await screen.findByRole('menuitem', { name: 'Open' });
    expect(screen.getByRole('menuitem', { name: 'Download' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy();

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
    await canvas.findAllByText('README.md');

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
