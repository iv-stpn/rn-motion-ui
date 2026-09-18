import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { renderWithFilterBar } from './__stories__/file-system-filter-bar';
import { FILE_SYSTEM_ARGS, FILE_SYSTEM_DECORATORS } from './__stories__/file-system-story-meta';
import { ENTRY_TEST_ID_PREFIX, openTile } from './__stories__/file-system-story-testing';
import { FileSystem } from './file-system';
import { FS_SEARCH_MATCH_TEST_ID } from './views/file-system-search-view';

const meta = {
  title: 'File System/FileSystem',
  component: FileSystem,
  parameters: { layout: 'centered' },
  decorators: FILE_SYSTEM_DECORATORS,
  args: FILE_SYSTEM_ARGS,
} satisfies Meta<typeof FileSystem>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Search ────────────────────────────────────────────────────────────────────

export const Search: Story = {
  name: 'Demo: Search the folder',
  args: { renderFilters: undefined },
  render: renderWithFilterBar,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('README.md');

    // Search spans the whole subtree, not just the open folder. A query swaps the
    // folder view for the flat results view, so every match at every depth shows
    // at once, each row naming the folder it came from. The query is debounced
    // 200ms, so the results land a beat after the typing.
    await userEvent.type(await canvas.findByLabelText('Search files'), 'report');
    await waitFor(() => expect(canvas.queryByText('README.md')).toBeNull());

    // Queried by entry test id, not by text: a result row marks the matched run
    // inside its name, which splits the name across nested nodes, and
    // `getByText` reads a single node's own text.
    //
    // Both reports, plus `Reports/` on its own name — but not `Documents/`, which
    // is visible only as their ancestor and so is not a match itself.
    await canvas.findAllByTestId(`${ENTRY_TEST_ID_PREFIX}Documents/Reports/Q1-report.pdf`);
    await canvas.findAllByTestId(`${ENTRY_TEST_ID_PREFIX}Documents/Reports/Q2-report.pdf`);
    await canvas.findAllByTestId(`${ENTRY_TEST_ID_PREFIX}Documents/Reports/`);
    expect(canvas.queryByTestId(`${ENTRY_TEST_ID_PREFIX}Documents/`)).toBeNull();

    // Each row names where it lives as a caret-separated trail under its name,
    // asserted through the row's whole text because both the trail separators and
    // the highlighted runs are nested nodes.
    expect((await canvas.findAllByTestId(`${ENTRY_TEST_ID_PREFIX}Documents/Reports/Q1-report.pdf`))[0]).toHaveTextContent(
      'Files › Documents › Reports',
    );

    // A hit at the root keeps the line rather than dropping it — the trail is
    // just the root label on its own. Clearing the field puts the folder view
    // back for the length of the debounce, and this entry has a tile there under
    // the same test id, so the wait for `README.md` to drop out is what pins the
    // assertion to the search row.
    await userEvent.clear(await canvas.findByLabelText('Search files'));
    await userEvent.type(await canvas.findByLabelText('Search files'), 'invoice');
    await waitFor(() => expect(canvas.queryByText('README.md')).toBeNull());
    const rootHit = (await canvas.findAllByTestId(`${ENTRY_TEST_ID_PREFIX}Invoice-0042.pdf`))[0];
    expect(rootHit).toHaveTextContent('Invoice-0042.pdf');
    expect(rootHit).toHaveTextContent('Files');

    // Clearing restores the folder.
    await userEvent.click(await canvas.findByLabelText('Clear search'));
    await canvas.findAllByText('README.md');
  },
};

/**
 * Whatever the query matched is marked in place — in the name, in the trail, or
 * in both — and a label the query matches end to end is marked whole rather than
 * left as the one plain row in a list of highlighted ones.
 */
export const SearchHighlight: Story = {
  name: 'Demo: Highlight the match',
  args: { renderFilters: undefined },
  render: renderWithFilterBar,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('README.md');

    // A partial hit marks only the matched run, leaving the rest of the name plain.
    await userEvent.type(await canvas.findByLabelText('Search files'), 'repo');
    await waitFor(() => expect(canvas.queryByText('README.md')).toBeNull());
    const partial = await canvas.findAllByTestId(FS_SEARCH_MATCH_TEST_ID);
    expect(partial.every((mark) => (mark.textContent ?? '').toLowerCase() === 'repo')).toBe(true);

    // `Reports/` is here on its own name, and is also the folder the two reports
    // live in — so the query is marked in that row's trail as well as in its name.
    const q1 = (await canvas.findAllByTestId(`${ENTRY_TEST_ID_PREFIX}Documents/Reports/Q1-report.pdf`))[0];
    if (!q1) throw new Error('no Q1-report.pdf row rendered');
    expect(within(q1).getAllByTestId(FS_SEARCH_MATCH_TEST_ID)).toHaveLength(2);

    // A query that is the whole name is one single matched run: the mark covers
    // the label end to end rather than the row rendering unmarked.
    await userEvent.clear(await canvas.findByLabelText('Search files'));
    await userEvent.type(await canvas.findByLabelText('Search files'), 'notes.txt');
    await waitFor(() => expect(canvas.queryByText('README.md')).toBeNull());
    const fullHit = (await canvas.findAllByTestId(`${ENTRY_TEST_ID_PREFIX}Documents/notes.txt`))[0];
    if (!fullHit) throw new Error('no notes.txt row rendered');
    const marks = within(fullHit).getAllByTestId(FS_SEARCH_MATCH_TEST_ID);
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent('notes.txt');
  },
};

/** The folder chip's label, whatever folder is open — absent at the root. */
const FOLDER_SCOPE_LABEL_PATTERN = /^Search only /;

/**
 * `searchScope` chooses what a query reaches: the open folder's subtree, or the
 * whole manifest. The slot renders it as the two chips beside the count — the
 * count is what the scope changes, so they read together.
 *
 * Only a query widens. Filters stay scoped to the folder they are shown against
 * whatever the scope says, and the scope survives navigation while the query
 * does not.
 */
export const SearchScope: Story = {
  name: 'Demo: Scope the search',
  render: renderWithFilterBar,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('Photos');

    // At the root the two scopes are the same tree, so only the root chip shows.
    await canvas.findByLabelText('Search all of Files');
    expect(canvas.queryByLabelText(FOLDER_SCOPE_LABEL_PATTERN)).toBeNull();

    // Inside a folder both are offered, and the folder one is active by default.
    await openTile(canvas, 'Documents');
    await canvas.findAllByText('Contract.docx');
    const folderChip = await canvas.findByLabelText('Search only Documents');
    const rootChip = await canvas.findByLabelText('Search all of Files');
    expect(folderChip).toHaveAttribute('aria-checked', 'true');
    expect(rootChip).toHaveAttribute('aria-checked', 'false');

    // Folder-scoped, a hit that lives outside `Documents/` is not reachable.
    await userEvent.type(await canvas.findByLabelText('Search files'), 'invoice');
    await canvas.findByText('No results for “invoice”');
    expect(canvas.queryByTestId(`${ENTRY_TEST_ID_PREFIX}Invoice-0042.pdf`)).toBeNull();

    // Widening to the root surfaces it, without leaving the folder: the trail
    // under the hit says it came from the root, and the breadcrumb bar still
    // has `Documents` open behind the results.
    await userEvent.click(rootChip);
    expect((await canvas.findAllByTestId(`${ENTRY_TEST_ID_PREFIX}Invoice-0042.pdf`))[0]).toHaveTextContent('Files');
    await canvas.findByLabelText('Go to Files');
    expect(rootChip).toHaveAttribute('aria-checked', 'true');

    // The count reports the widened list, so the chips and the number agree.
    await canvas.findByText('Showing 1 result');

    // Narrowing back drops it again — the same query, a smaller reach.
    await userEvent.click(folderChip);
    await canvas.findByText('No results for “invoice”');

    // Scope outlives the query: widening, then clearing the field, leaves the
    // folder view behind with the root scope still armed for the next query.
    await userEvent.click(rootChip);
    await canvas.findAllByTestId(`${ENTRY_TEST_ID_PREFIX}Invoice-0042.pdf`);
    await userEvent.click(await canvas.findByLabelText('Clear search'));
    await canvas.findAllByText('Contract.docx');
    await userEvent.type(await canvas.findByLabelText('Search files'), 'roadmap');
    await canvas.findAllByTestId(`${ENTRY_TEST_ID_PREFIX}Roadmap.pptx`);
  },
};
