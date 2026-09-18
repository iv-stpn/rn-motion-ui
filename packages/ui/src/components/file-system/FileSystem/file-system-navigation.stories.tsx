import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { renderWithFilterBar } from './__stories__/file-system-filter-bar';
import { FILE_SYSTEM_ARGS, FILE_SYSTEM_DECORATORS } from './__stories__/file-system-story-meta';
import { ENTRY_TEST_ID_PREFIX, openTile } from './__stories__/file-system-story-testing';
import { FileSystem } from './file-system';

const meta = {
  title: 'File System/FileSystem',
  component: FileSystem,
  parameters: { layout: 'centered' },
  decorators: FILE_SYSTEM_DECORATORS,
  args: FILE_SYSTEM_ARGS,
} satisfies Meta<typeof FileSystem>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Navigation ────────────────────────────────────────────────────────────────
// Activation is tap-to-select / tap-again-to-open, so a mouse double-click and a
// double tap take the same path. Opening a folder pushes it onto the history the
// Back and Forward buttons walk.

export const Navigate: Story = {
  name: 'Demo: Open a folder',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('Photos');

    // Second press within the double-tap window opens instead of re-selecting.
    await openTile(canvas, 'Documents');

    // Inside `Documents/`: its own children, and nothing from the root.
    await canvas.findAllByText('Reports');
    await waitFor(() => expect(canvas.queryByText('Photos')).toBeNull());

    // The folder name lands in the header — and in the breadcrumb trail too, so
    // the trail's root link is what identifies the row rather than the name.
    await canvas.findByLabelText('Go to Files');
    await userEvent.click(await canvas.findByLabelText('Back'));
    await canvas.findAllByText('Photos');
  },
};

/**
 * The breadcrumb trail under the header names every folder on the way to the
 * current one, and each is a way back. It appears only below the root, where
 * there is somewhere to go back to; the trail's first segment is `rootLabel`,
 * which falls back to the `title`.
 */
export const Breadcrumbs: Story = {
  name: 'Demo: Breadcrumb trail',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('Photos');

    // At the root there is no trail — the folder name is in the header alone.
    expect(canvas.queryByLabelText('Go to Files')).toBeNull();

    await openTile(canvas, 'Documents');
    await canvas.findByLabelText('Go to Files');

    // Two levels down, the trail holds the folder in between as its own link.
    await openTile(canvas, 'Reports');
    await canvas.findAllByText('Q1-report.pdf');
    await canvas.findByLabelText('Go to Documents');

    // A segment jumps straight there rather than stepping back one folder.
    await userEvent.click(await canvas.findByLabelText('Go to Files'));
    await canvas.findAllByText('Photos');
    await waitFor(() => expect(canvas.queryByLabelText('Go to Files')).toBeNull());
  },
};

/**
 * `rootLabel` names the root wherever a trail leads back to it — the breadcrumb
 * bar's first segment, and the folder line under every search result. It defaults
 * to `title`, so setting it is how the root reads in a trail (`'My Drive'`)
 * without changing what the header calls the folder (`'Files'`).
 */
export const RootLabel: Story = {
  name: 'Demo: Name the root in trails',
  args: { rootLabel: 'My Drive', renderFilters: undefined },
  render: renderWithFilterBar,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('Photos');

    // The header still calls the root by its `title`.
    await canvas.findByText('Files');

    // The trail calls it `rootLabel` instead, and that is the link back.
    await openTile(canvas, 'Documents');
    await canvas.findByLabelText('Go to My Drive');
    expect(canvas.queryByLabelText('Go to Files')).toBeNull();

    // Back to the root: a search runs over the open folder's subtree, and the hit
    // below sits at the top level.
    await userEvent.click(await canvas.findByLabelText('Go to My Drive'));
    await canvas.findAllByText('Photos');

    // The same label leads the trail under a search result — here a hit at the
    // root, whose trail is that label on its own. An entry keeps one test id in
    // every view, so the wait for the folder view to drop out is what makes the
    // row below the search row rather than the grid tile it was a moment ago.
    await userEvent.type(await canvas.findByLabelText('Search files'), 'invoice');
    await waitFor(() => expect(canvas.queryByText('README.md')).toBeNull());
    expect((await canvas.findAllByTestId(`${ENTRY_TEST_ID_PREFIX}Invoice-0042.pdf`))[0]).toHaveTextContent('My Drive');
  },
};
