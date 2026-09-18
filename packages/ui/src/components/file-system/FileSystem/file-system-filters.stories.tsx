import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { renderWithFilterBar } from './__stories__/file-system-filter-bar';
import { FILE_SYSTEM_ARGS, FILE_SYSTEM_DECORATORS } from './__stories__/file-system-story-meta';
import { ENTRY_TEST_ID_PREFIX } from './__stories__/file-system-story-testing';
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

// ─── Filters ───────────────────────────────────────────────────────────────────
// Filtering is headless: the component runs the pipeline and `renderFilters`
// supplies the controls. These stories drive the story-local `FilterBar` (in
// `__stories__/file-system-filter-bar.tsx`), which reads each active filter back
// as `type operator value` text.

/** Matches a readback row by its facet, so the row's value need not be spelled out. */
const DATE_RANGE_READBACK_PATTERN = /^dateModified in-range/;
const FILE_TYPE_READBACK_PATTERN = /^fileType /;

export const Filter: Story = {
  name: 'Demo: Filter by file type',
  render: renderWithFilterBar,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('Photos');

    // Chip options come from the loaded manifest, labeled by MIME type.
    await userEvent.click(await canvas.findByLabelText('Filter by PDF'));

    // Only PDFs pass, so `Photos/` drops out while `Documents/` stays for its
    // reports. Folders are never filtered directly — they live through matches.
    await waitFor(() => expect(canvas.queryByText('Photos')).toBeNull());
    await canvas.findAllByText('Invoice-0042.pdf');

    // The chip reports itself checked, and the slot reads the filter back.
    expect(await canvas.findByLabelText('Filter by PDF')).toHaveAttribute('aria-checked', 'true');
    // One MIME reads back with `is`; a second would widen it to `is-any-of`.
    await canvas.findByText('fileType is application/pdf');
  },
};

/**
 * Picking a date preset re-values the existing filter of that type rather than
 * stacking another beside it. Regression test: the value mutator matches on the
 * filter's `type`, so a second preset replaces the first.
 */
export const DatePresetRevalue: Story = {
  name: 'Demo: Re-value a date filter',
  render: renderWithFilterBar,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('README.md');

    await userEvent.click(await canvas.findByLabelText('Modified after 1 month ago'));
    await canvas.findByText('dateModified after 1 month ago');

    // A second preset re-values in place: the older value is gone rather than
    // sitting beside it as a second `dateModified` filter.
    await userEvent.click(await canvas.findByLabelText('Modified after 3 days ago'));
    await canvas.findByText('dateModified after 3 days ago');
    await waitFor(() => expect(canvas.queryByText('dateModified after 1 month ago')).toBeNull());
  },
};

/**
 * A custom range is applied by the consumer's own picker: `applyCustomRange`
 * takes the two ends and stores them as an `in-range` filter, replacing whatever
 * filter that facet held. The component ships no date picker of its own.
 */
export const CustomDateRange: Story = {
  name: 'Demo: Apply a custom date range',
  render: renderWithFilterBar,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('README.md');

    // A preset first, so the range has something to replace.
    await userEvent.click(await canvas.findByLabelText('Modified after 1 month ago'));
    await canvas.findByText('dateModified after 1 month ago');

    // The story bar hands over two fixed dates, standing in for a real picker.
    await userEvent.click(await canvas.findByLabelText('Modified in Q1 2026'));
    await canvas.findByText(DATE_RANGE_READBACK_PATTERN);

    // Replaced in place rather than stacked beside the preset.
    await waitFor(() => expect(canvas.queryByText('dateModified after 1 month ago')).toBeNull());

    // The range is a real cutoff, not just stored state: README.md is a June
    // file, so it falls outside Q1 and drops out of the view.
    await waitFor(() => expect(canvas.queryByText('README.md')).toBeNull());
  },
};

/**
 * The row-addressed actions: every active filter carries an `id`, so a pill UI
 * can negate one row or drop it without disturbing the others.
 */
export const FilterRowActions: Story = {
  name: 'Demo: Negate and remove one filter row',
  render: renderWithFilterBar,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('Photos');

    await userEvent.click(await canvas.findByLabelText('Filter by PDF'));
    await canvas.findByText('fileType is application/pdf');
    await waitFor(() => expect(canvas.queryByText('Photos')).toBeNull());

    // `setFilterOperator` flips the row to `is-not`, so everything *but* PDFs
    // passes — the folders come back and the PDFs go.
    await userEvent.click(await canvas.findByLabelText('Negate fileType filter'));
    await canvas.findByText('fileType is-not application/pdf');
    await waitFor(() => expect(canvas.queryByText('Invoice-0042.pdf')).toBeNull());
    await canvas.findAllByText('Photos');

    // `removeFilter` drops that row alone, leaving no filters active.
    await userEvent.click(await canvas.findByLabelText('Remove fileType filter'));
    await waitFor(() => expect(canvas.queryByText(FILE_TYPE_READBACK_PATTERN)).toBeNull());
    await canvas.findAllByText('Invoice-0042.pdf');
  },
};

/**
 * A fully headless filter bar: a search field and per-MIME-type toggle chips,
 * all wired up through `renderFilters`. The component runs its normal
 * search/filter pipeline; only the UI driving it is custom.
 */
export const WithFiltersAndSearch: Story = {
  name: 'Demo: Headless filters and search',
  render: renderWithFilterBar,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('README.md');

    // Search is debounced 200 ms — wait for the results to update.
    await userEvent.type(await canvas.findByLabelText('Search files'), 'report');
    await waitFor(() => expect(canvas.queryByText('README.md')).toBeNull(), { timeout: 1000 });
    // The results view names the folder each hit came from, so `Documents`
    // appears in the matched rows' trails. Asserted through the row's whole text:
    // the trail's separators and its highlighted runs are both nested nodes, and
    // `getByText` reads a single node's own text.
    expect((await canvas.findAllByTestId(`${ENTRY_TEST_ID_PREFIX}Documents/Reports/Q1-report.pdf`))[0]).toHaveTextContent(
      'Files › Documents › Reports',
    );

    // Clearing the search field restores the full list.
    await userEvent.click(await canvas.findByLabelText('Clear search'));
    await canvas.findAllByText('README.md');

    // A file-type chip filters immediately.
    await userEvent.click(await canvas.findByLabelText('Filter by PDF'));
    await waitFor(() => expect(canvas.queryByText('README.md')).toBeNull());
    await canvas.findAllByText('Invoice-0042.pdf');

    // Clear all removes both search and filters.
    await userEvent.click(await canvas.findByText('Clear'));
    await canvas.findAllByText('README.md');
  },
};

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
    await canvas.findAllByText('README.md');

    // Pinned items sort first; name ascending within each group.
    // README.md and Roadmap.pptx are pinned, so README.md leads.
    expect(fileNames(canvas)[0]).toBe('README.md');

    // Size starts at its own default direction — largest first, like Finder.
    const sizeHeader = await canvas.findByText('Size');
    await userEvent.click(sizeHeader);
    await waitFor(() => expect(fileNames(canvas)[0]).toBe('Roadmap.pptx'));

    // Pressing the active column flips it.
    await userEvent.click(sizeHeader);
    await waitFor(() => expect(fileNames(canvas)[0]).toBe('README.md'));
  },
};
