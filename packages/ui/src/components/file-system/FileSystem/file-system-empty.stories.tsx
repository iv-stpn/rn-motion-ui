import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../../buttons/Button/button';
import { Text } from '../../typography/Text/text';
import { renderWithFilterBar } from './__stories__/file-system-filter-bar';
import { renderViewSwitcherHeader } from './__stories__/file-system-playground';
import { FILE_SYSTEM_ARGS, FILE_SYSTEM_DECORATORS } from './__stories__/file-system-story-meta';
import { openTile } from './__stories__/file-system-story-testing';
import { FileSystem } from './file-system';
import type { FileSystemContextMenuAction, FileSystemProps } from './types/file-system.types';
import { FS_EMPTY_STATE_TEST_ID } from './views/file-system-body';

const meta = {
  title: 'File System/FileSystem',
  component: FileSystem,
  parameters: { layout: 'centered' },
  decorators: FILE_SYSTEM_DECORATORS,
  args: FILE_SYSTEM_ARGS,
} satisfies Meta<typeof FileSystem>;

export default meta;

type Story = StoryObj<typeof meta>;

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
    <View className="hairline-l w-48 gap-1 border-border p-3">
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
  args: { renderBody: renderBodyWithRail, renderHeader: renderViewSwitcherHeader },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The default content still renders, and the rail reads the state it came from:
    // nineteen entries at the root — Archive/, Documents/, Photos/ and sixteen files.
    await canvas.findAllByText('README.md');
    await canvas.findByText(NO_SELECTION);
    await canvas.findByText('19 in Files');
    await canvas.findByText('icons view');

    // Selecting shows the name twice: the tile and the rail. The `HoldItem`
    // twin only mounts its portal copy while the hold menu is open, so at rest
    // there is no third copy.
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
          <Button onPress={onEmptyCtaPress} size="sm" variant="neutral">
            {EMPTY_CTA}
          </Button>
        </View>
      ) : undefined,
  },
  render: renderWithFilterBar,
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
