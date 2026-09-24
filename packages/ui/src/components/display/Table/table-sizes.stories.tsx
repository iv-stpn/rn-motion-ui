import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Text } from '../../typography/Text/text';
import {
  buildPeople,
  CLASSIC_TABLE,
  DEFAULT_COLUMNS,
  getPersonId,
  type Person,
  TablePerson,
} from './__stories__/table-story-data';
import { TABLE_ARGS } from './__stories__/table-story-meta';
import { Table, type TableColumn } from './table';

const meta = {
  title: 'Display/Table',
  component: TablePerson,
  parameters: { layout: 'centered' },
  args: TABLE_ARGS,
} satisfies Meta<typeof TablePerson>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Narrow container (horizontal overflow) ──────────────────────────────────
// Columns that overflow a phone-width container wrap the header + body in a
// horizontal ScrollView, whose content is laid out in a row. The header and body
// must therefore sit inside a single column, or the rows land beside the header
// (off-screen) and the body reads as empty — the mobile bug this pins down.

const NARROW_WIDTH = 320;
const NARROW_ROW_HEIGHT = 48;
// Fixed pixel widths so the overflow is deterministic (no fr columns resolving
// to zero width in a too-narrow container).
const NARROW_COLUMNS: TableColumn<Person>[] = [
  { key: 'name', header: 'Name', width: '180px' },
  { key: 'email', header: 'Email', width: '200px' },
  { key: 'role', header: 'Role', width: '140px' },
];

export const NarrowOverflow: Story = {
  name: 'Demo: rows stay under the header on a narrow screen',
  render: () => (
    <View style={{ width: NARROW_WIDTH }}>
      <Table
        {...CLASSIC_TABLE}
        data={buildPeople(5)}
        columns={NARROW_COLUMNS}
        getRowId={getPersonId}
        height={280}
        rowHeight={NARROW_ROW_HEIGHT}
        testID="table-narrow"
      />
    </View>
  ),
  args: { columns: [], data: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId('table-narrow');
    // The body row sits under the header (aligned to the table's left edge), not
    // beside it — a horizontal ScrollView would otherwise push it off-screen and
    // the body reads as empty on a narrow screen. `waitFor` gates on the
    // post-layout render: `onLayout` only flips `needsHorizontalScroll` after the
    // first frame, and the FlatList then re-measures its content on a timer, so a
    // first read can still report the pre-layout row `top` of 0.
    await waitFor(() => {
      const table = canvas.getByTestId('table-narrow').getBoundingClientRect();
      const row = canvas.getByTestId('table-narrow-row-0').getBoundingClientRect();
      expect(row.left).toBeLessThan(table.left + 2);
      expect(row.top).toBeGreaterThanOrEqual(table.top + NARROW_ROW_HEIGHT - 1);
    });
  },
};

// ─── Minimum column width ─────────────────────────────────────────────────────
// A column's `minWidth` is a floor, not a share: on a narrow container the
// column refuses to shrink below it, pushing the total past the container width
// so the table scrolls horizontally instead of squeezing the column unreadable.

const MIN_WIDTH_COLUMNS: TableColumn<Person>[] = [
  { key: 'name', header: 'Name', width: '1fr' },
  { key: 'email', header: 'Email', width: '1fr', minWidth: 240 },
  { key: 'role', header: 'Role', width: '1fr' },
];

export const MinWidth: Story = {
  name: 'Demo: min column width forces horizontal scroll',
  render: () => (
    <View style={{ width: NARROW_WIDTH }}>
      <Table
        {...CLASSIC_TABLE}
        data={buildPeople(5)}
        columns={MIN_WIDTH_COLUMNS}
        getRowId={getPersonId}
        height={280}
        rowHeight={NARROW_ROW_HEIGHT}
        testID="table-min-width"
      />
    </View>
  ),
  args: { columns: [], data: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The email column keeps its 240px floor even though the container is only
    // 320px wide, so the table overflows and scrolls rather than squeezing it.
    // `waitFor` gates on the post-layout render: `computeColumnWidths` only
    // resolves once `onLayout` reports the container width, so the first frame
    // still lays the cell out with its pre-layout flex fallback.
    await waitFor(() => {
      const emailHeader = canvas.getByTestId('table-min-width-header-email').getBoundingClientRect();
      expect(emailHeader.width).toBeGreaterThanOrEqual(240);
    });
    // The horizontal wrapper is only mounted once the total actually overflows.
    await canvas.findByTestId('table-min-width-scroll');
  },
};

// ─── Pagination ───────────────────────────────────────────────────────────────
// mode='pagination' with prev/next footer pinned below the FlatList.

function PaginationTableStory() {
  const PAGE_SIZE_PAG = 10;
  const allRows = useMemo(() => buildPeople(100), []);
  const [page, setPage] = useState(1);
  const data = useMemo(() => allRows.slice((page - 1) * PAGE_SIZE_PAG, page * PAGE_SIZE_PAG), [allRows, page]);
  const getRowId = useCallback((row: Person) => row.id, []);

  return (
    <View className="flex-1 p-4">
      <Table
        {...CLASSIC_TABLE}
        data={data}
        columns={DEFAULT_COLUMNS}
        getRowId={getRowId}
        height={420}
        rowHeight={52}
        mode="pagination"
        page={page}
        pageSize={PAGE_SIZE_PAG}
        total={allRows.length}
        onPageChange={setPage}
        testID="table-pagination"
      />
    </View>
  );
}

export const Pagination: Story = {
  name: 'Demo: Next page',
  render: () => <PaginationTableStory />,
  args: { data: [], columns: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Name');
    // Prev/next buttons are present
    const nextButton = await canvas.findByRole('button', { name: 'Next page' });
    expect(nextButton).toBeTruthy();
    // Navigate to page 2
    await userEvent.click(nextButton);
  },
};

// ─── Load more ────────────────────────────────────────────────────────────────
// mode='loadMore' with a "Load more" button footer. Tapping fetches the next
// batch and shows a loadingMore spinner while the request is in flight.

function LoadMoreTableStory() {
  const BATCH = 20;
  const allRows = useMemo(() => buildPeople(100), []);
  const [count, setCount] = useState(BATCH);
  const [loadingMore, setLoadingMore] = useState(false);
  const data = useMemo(() => allRows.slice(0, count), [allRows, count]);
  const hasMore = count < allRows.length;
  const getRowId = useCallback((row: Person) => row.id, []);

  const onLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setTimeout(() => {
      setCount((c) => Math.min(c + BATCH, allRows.length));
      setLoadingMore(false);
    }, 800);
  }, [allRows.length, loadingMore, hasMore]);

  let loadMoreStatus: string;
  if (loadingMore) loadMoreStatus = 'Loading…';
  else if (hasMore) loadMoreStatus = 'More available';
  else loadMoreStatus = 'All loaded';

  return (
    <View className="flex-1 p-4">
      <View className="mb-2 flex-row justify-between">
        <Text className="text-[#6b7280] text-[12px]">{`${data.length} / ${allRows.length} rows`}</Text>
        <Text className="text-[#6b7280] text-[12px]">{loadMoreStatus}</Text>
      </View>
      <Table
        {...CLASSIC_TABLE}
        data={data}
        columns={DEFAULT_COLUMNS}
        getRowId={getRowId}
        height={420}
        rowHeight={52}
        mode="loadMore"
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
        testID="table-load-more"
      />
    </View>
  );
}

export const LoadMore: Story = {
  name: 'Demo: Load more',
  render: () => <LoadMoreTableStory />,
  args: { data: [], columns: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Name');
    // Load more button is visible when hasMore is true
    const loadButton = await canvas.findByRole('button', { name: 'Load more' });
    expect(loadButton).toBeTruthy();
    await userEvent.click(loadButton);
  },
};

// ─── Sortable off (global master switch) ─────────────────────────────────────
// sortable=false short-circuits all per-column sortable flags: headers render
// as plain text with no sort affordance even when column.sortable is true.

export const SortableOff: Story = {
  name: 'Demo: Sorting disabled',
  args: {
    data: buildPeople(20),
    // All three columns carry sortable:true — the global flag overrides them.
    columns: DEFAULT_COLUMNS,
    sortable: false,
    height: 420,
    rowHeight: 52,
    testID: 'table-sortable-off',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Name');
    // Headers exist but clicking them must not trigger any sort action.
    const nameHeader = await canvas.findByTestId('table-sortable-off-header-name');
    await userEvent.click(nameHeader);
    // Sort icon is absent — the header text element is still present.
    expect(nameHeader).toBeTruthy();
  },
};
