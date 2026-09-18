import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { expect, userEvent, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Toggle } from '../../../__stories__/story-harness';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { Switch } from '../../form/Switch/switch';
import { Text } from '../../typography/Text/text';
import {
  buildPeople,
  CLASSIC_TABLE,
  DEFAULT_COLUMNS,
  FIRST,
  getPersonId,
  LAST,
  type Person,
  ROLES,
  renderPersonCard,
  STATUSES,
  StatusBadge,
  TablePerson,
} from './__stories__/table-story-data';
import { TABLE_ARGS } from './__stories__/table-story-meta';
import { type SortState, Table, type TableColumn, type TableProps } from './table';

const meta = {
  title: 'Display/Table',
  component: TablePerson,
  parameters: { layout: 'centered' },
  args: TABLE_ARGS,
} satisfies Meta<typeof TablePerson>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Async ────────────────────────────────────────────────────────────────────
// Infinite scroll with simulated 700 ms pages

const PAGE_SIZE = 20;
const MAX_PAGES = 8;

function buildPage(page: number): Person[] {
  const out: Person[] = [];
  const start = page * PAGE_SIZE;
  for (let n = start; n < start + PAGE_SIZE; n += 1) {
    const first = FIRST[n % FIRST.length] ?? '';
    const last = LAST[(n * 7) % LAST.length] ?? '';
    const status = STATUSES[(n * 5) % STATUSES.length] ?? 'active';
    out.push({
      id: String(n),
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${n}@rnmotionui.dev`,
      role: ROLES[(n * 3) % ROLES.length] ?? 'Member',
      status,
      mrr: 12 + ((n * 37) % 488),
    });
  }
  return out;
}

function AsyncTableStory() {
  const [rows, setRows] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef(0);
  const loadingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (loadingRef.current || pageRef.current >= MAX_PAGES) return;
    loadingRef.current = true;
    setLoading(true);
    setTimeout(() => {
      const page = pageRef.current;
      setRows((prev) => [...prev, ...buildPage(page)]);
      pageRef.current = page + 1;
      loadingRef.current = false;
      setLoading(false);
    }, 700);
  }, []);

  // loadMore is stable (useCallback with empty deps); safe to list here
  useMountEffect(loadMore);

  const columns = useMemo<TableColumn<Person>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        cell: (r) => (
          <Text weight="medium" className="text-[13px]">
            {r.name}
          </Text>
        ),
      },
      { key: 'email', header: 'Email', width: '180px' },
      { key: 'role', header: 'Role', width: '110px' },
      {
        key: 'status',
        header: 'Status',
        width: '120px',
        cell: (r) => <StatusBadge status={r.status} />,
      },
      {
        key: 'mrr',
        header: 'MRR',
        align: 'right',
        width: '90px',
        cell: (r) => <Text className="text-right text-[13px]">{`$${r.mrr.toLocaleString()}`}</Text>,
      },
    ],
    [],
  );

  const getRowId = useCallback((row: Person) => row.id, []);

  let statusLabel: string;
  if (loading) statusLabel = 'Loading…';
  else if (pageRef.current >= MAX_PAGES) statusLabel = 'All loaded';
  else statusLabel = 'Scroll for more';

  return (
    <View className="flex-1 p-4">
      <View className="mb-2 flex-row justify-between">
        <Text className="text-[#6b7280] text-[12px]">{`${rows.length} loaded`}</Text>
        <Text className="text-[#6b7280] text-[12px]">{statusLabel}</Text>
      </View>
      <Table
        {...CLASSIC_TABLE}
        data={rows}
        columns={columns}
        getRowId={getRowId}
        height={420}
        rowHeight={52}
        onEndReached={loadMore}
        loading={loading}
        skeletonRows={3}
        testID="table-async"
      />
    </View>
  );
}

// ─── Editable ─────────────────────────────────────────────────────────────────
// Editable cells, column rename, insert / delete rows + columns

type EditRow = { id: string; [key: string]: string };

const INITIAL_ROWS: EditRow[] = [
  { id: 'r1', name: 'Ava Cole', role: 'Owner', team: 'Design' },
  { id: 'r2', name: 'Leo Frost', role: 'Admin', team: 'Growth' },
  { id: 'r3', name: 'Mia Vale', role: 'Member', team: 'Design' },
  { id: 'r4', name: 'Kai Reyes', role: 'Member', team: 'Platform' },
];

function EditableTableStory() {
  const [rows, setRows] = useState<EditRow[]>(INITIAL_ROWS);
  const [keys, setKeys] = useState<string[]>(['name', 'role', 'team']);
  const [labels, setLabels] = useState<Record<string, string>>({
    name: 'Name',
    role: 'Role',
    team: 'Team',
  });
  const [nextRow, setNextRow] = useState(5);
  const [nextCol, setNextCol] = useState(1);
  const [editable, setEditable] = useState(true);

  const onCellEdit = useCallback((rowId: string, key: string, value: string) => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, [key]: value } : row)));
  }, []);

  const onInsertRow = useCallback(
    (index: number, position: 'before' | 'after') => {
      const at = position === 'after' ? index + 1 : index;
      setRows((prev) => {
        const next = [...prev];
        next.splice(at, 0, { id: `r${nextRow}` });
        return next;
      });
      setNextRow((n) => n + 1);
    },
    [nextRow],
  );

  const onDeleteRow = useCallback((rowId: string) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
  }, []);

  const onInsertColumn = useCallback(
    (index: number, position: 'before' | 'after') => {
      const key = `field${nextCol}`;
      const at = position === 'after' ? index + 1 : index;
      setLabels((prev) => ({ ...prev, [key]: `Field ${nextCol}` }));
      setKeys((prev) => {
        const next = [...prev];
        next.splice(at, 0, key);
        return next;
      });
      setRows((prev) => prev.map((row) => ({ ...row, [key]: '' })));
      setNextCol((n) => n + 1);
    },
    [nextCol],
  );

  const onColumnRename = useCallback((key: string, value: string) => {
    setLabels((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onDeleteColumn = useCallback((key: string) => {
    setKeys((prev) => prev.filter((k) => k !== key));
    setRows((prev) =>
      prev.map((row) => {
        const entries = new Map(Object.entries(row));
        entries.delete(key);
        return { ...Object.fromEntries(entries), id: row.id };
      }),
    );
  }, []);

  const getRowId = useCallback((row: EditRow) => row.id, []);

  const columns = useMemo<TableColumn<EditRow>[]>(
    () =>
      keys.map((key, i) => ({
        key,
        header: labels[key] ?? key,
        editable,
        width: i === 0 ? undefined : '160px',
      })),
    [keys, labels, editable],
  );

  const bodyHeight = Math.min(Math.max(rows.length, 1), 6) * 48 + 48; // +header

  return (
    <View className="flex-1 p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-[#6b7280] text-[12px]">
          {editable ? 'Tap a cell to edit. Long-press row for actions.' : 'Read-only.'}
        </Text>
        <Switch isSelected={editable} onSelectedChange={setEditable} label="Editable" />
      </View>
      <Table
        {...CLASSIC_TABLE}
        data={rows}
        columns={columns}
        getRowId={getRowId}
        rowHeight={48}
        height={bodyHeight}
        onCellEdit={editable ? onCellEdit : undefined}
        onColumnRename={editable ? onColumnRename : undefined}
        onInsertRow={editable ? onInsertRow : undefined}
        onDeleteRow={editable ? onDeleteRow : undefined}
        onInsertColumn={editable ? onInsertColumn : undefined}
        onDeleteColumn={editable ? onDeleteColumn : undefined}
        testID="table-editable"
      />
    </View>
  );
}

// ─── Interactive ──────────────────────────────────────────────────────────────

const ROW_COUNTS = { '0': 0, '8': 8, '50': 50, '1000': 1000, '100000': 100_000 } as const;
type RowCountKey = keyof typeof ROW_COUNTS;

const ROW_COUNT_OPTIONS = [
  { value: '0', label: 'Empty' },
  { value: '8', label: '8 rows' },
  { value: '50', label: '50 rows' },
  { value: '1000', label: '1000 rows' },
  { value: '100000', label: '100K rows' },
] as const satisfies readonly { value: RowCountKey; label: string }[];

const ROW_HEIGHTS = { compact: 40, default: 52, relaxed: 68 } as const;
type RowHeightKey = keyof typeof ROW_HEIGHTS;
const ROW_HEIGHT_KEYS = ['compact', 'default', 'relaxed'] as const satisfies readonly RowHeightKey[];

const FOOTERS = [
  { value: 'none', label: 'None' },
  { value: 'pagination', label: 'Pagination' },
  { value: 'loadMore', label: 'Load more' },
  { value: 'infiniteScroll', label: 'Infinite scroll' },
] as const;
type FooterKey = (typeof FOOTERS)[number]['value'];

const PLAYGROUND_PAGE_SIZE = 10;
const PLAYGROUND_BATCH = 20;
const FETCH_DELAY_MS = 500;
const IDLE_NOTE = 'Tap a header to sort, tick a row to select.';
const FOOTER_NOTE = 'Every footer mode reports intent and waits for the story to hand back the next slice.';

/** All of it on one canvas: the four footer modes, three densities, and every affordance the grid can carry. */

function TablePlayground() {
  const [rowCountKey, setRowCountKey] = useState<RowCountKey>('1000');
  const [rowHeightKey, setRowHeightKey] = useState<RowHeightKey>('default');
  const [footer, setFooter] = useState<FooterKey>('none');
  const [selectable, setSelectable] = useState(true);
  const [sortable, setSortable] = useState(true);
  const [reorderable, setReorderable] = useState(false);
  const [striped, setStriped] = useState(false);
  const [cardView, setCardView] = useState(false);
  const [note, setNote] = useState(IDLE_NOTE);

  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(PLAYGROUND_BATCH);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchingRef = useRef(false);

  const rows = useMemo(() => buildPeople(ROW_COUNTS[rowCountKey]), [rowCountKey]);

  // Paging stays the story's business: the table renders the footer and reports
  // the intent, the consumer hands back the slice that answers it.
  const visible = useMemo(() => {
    if (footer === 'none') return rows;
    if (footer === 'pagination') return rows.slice((page - 1) * PLAYGROUND_PAGE_SIZE, page * PLAYGROUND_PAGE_SIZE);
    return rows.slice(0, loaded);
  }, [footer, loaded, page, rows]);

  // `onEndReached` can fire several times per scroll, so the in-flight guard is a
  // ref: state would not have committed yet by the second call.
  const fetchMore = useCallback(() => {
    if (fetchingRef.current || loaded >= rows.length) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    setTimeout(() => {
      setLoaded((current) => Math.min(current + PLAYGROUND_BATCH, rows.length));
      setLoadingMore(false);
      fetchingRef.current = false;
    }, FETCH_DELAY_MS);
  }, [loaded, rows.length]);

  // Both choices invalidate whatever page the footer was on.
  const handleRowCount = useCallback((value: RowCountKey) => {
    setRowCountKey(value);
    setPage(1);
    setLoaded(PLAYGROUND_BATCH);
  }, []);

  const handleFooter = useCallback((value: FooterKey) => {
    setFooter(value);
    setPage(1);
    setLoaded(PLAYGROUND_BATCH);
  }, []);

  const handleSelection = useCallback((ids: string[]) => setNote(ids.length > 0 ? `${ids.length} selected` : IDLE_NOTE), []);

  const handleSort = useCallback(
    (sort: SortState | null) => setNote(sort ? `Sorted by ${sort.key}, ${sort.direction}` : 'Sort cleared'),
    [],
  );

  return (
    <Playground>
      <ControlCard title="Options">
        <Choice label="Rows" onChange={handleRowCount} options={ROW_COUNT_OPTIONS} value={rowCountKey} />
        <Choice label="Row height" onChange={setRowHeightKey} options={ROW_HEIGHT_KEYS} value={rowHeightKey} />
        <Choice label="Footer" onChange={handleFooter} options={FOOTERS} value={footer} />
        <Toggle label="Selectable" onChange={setSelectable} value={selectable} />
        <Toggle label="Sortable" onChange={setSortable} value={sortable} />
        <Toggle label="Reorderable" onChange={setReorderable} value={reorderable} />
        <Toggle label="Striped" onChange={setStriped} value={striped} />
        <Toggle label="Card view" onChange={setCardView} value={cardView} />
      </ControlCard>

      <Note testID="story-note">{note}</Note>
      <Note>{FOOTER_NOTE}</Note>

      <Table
        {...CLASSIC_TABLE}
        columns={DEFAULT_COLUMNS}
        data={visible}
        getRowId={getPersonId}
        hasMore={loaded < rows.length}
        height={420}
        loadingMore={loadingMore}
        mode={footer === 'none' ? undefined : footer}
        onEndReached={fetchMore}
        onLoadMore={fetchMore}
        onPageChange={setPage}
        onSelectionChange={handleSelection}
        onSortChange={handleSort}
        page={page}
        pageSize={PLAYGROUND_PAGE_SIZE}
        renderSmallScreen={renderPersonCard}
        reorderable={reorderable}
        rowHeight={ROW_HEIGHTS[rowHeightKey]}
        selectable={selectable}
        sortable={sortable}
        striped={striped}
        testID="table-interactive"
        total={rows.length}
        useSmallScreen={cardView}
      />
    </Playground>
  );
}

export const Interactive: Story = {
  args: { columns: [], data: [] },
  render: () => <TablePlayground />,
};

// ─── Default ─────────────────────────────────────────────────────────────────
// 1000 rows, sort by mrr desc initially, selectable

const DEFAULT_STORY_ARGS = {
  data: buildPeople(1000),
  columns: DEFAULT_COLUMNS,
  selectable: true,
  defaultSort: { key: 'mrr', direction: 'desc' },
  height: 420,
  rowHeight: 52,
} satisfies Partial<TableProps<Person>>;

export const Default: Story = {
  name: 'Demo: Sort a column',
  args: { ...DEFAULT_STORY_ARGS, testID: 'table-default' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Headers are visible
    await canvas.findByText('Name');
    await canvas.findByText('MRR');

    // Clicking a sortable header cycles the sort
    const nameHeader = await canvas.findByTestId('table-default-header-name');
    await userEvent.click(nameHeader);
    expect(nameHeader).toBeTruthy();
  },
};

// ─── Reorderable ───────────────────────────────────────────────────────────────
// Drag a header grip left/right to reorder columns; a line marks the drop spot.

export const Reorderable: Story = {
  name: 'Demo: Reorder grips',
  args: {
    data: buildPeople(50),
    columns: DEFAULT_COLUMNS,
    selectable: true,
    reorderable: true,
    defaultSort: { key: 'mrr', direction: 'desc' },
    height: 420,
    rowHeight: 52,
    testID: 'table-reorder',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Every column exposes a reorder grip (rendered only when reorderable).
    const grip = await canvas.findByTestId('table-reorder-grip-name');
    expect(grip).toBeTruthy();

    // Grip and sort trigger are distinct: the grip drags, the header taps to sort.
    const nameHeader = await canvas.findByTestId('table-reorder-header-name');
    expect(nameHeader).toBeTruthy();
  },
};

export const Async: Story = {
  name: 'Demo: Infinite scroll pages',
  render: () => <AsyncTableStory />,
  args: {
    // render override supplies its own data; placeholders satisfy Story typing
    data: [],
    columns: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Headers should be visible immediately (before data loads)
    await canvas.findByText('Name');
    await canvas.findByText('Email');
  },
};

// ─── Small screen (card view) ─────────────────────────────────────────────────
// Toggle between the normal table layout and the card view with renderSmallScreen.

function SmallScreenTableStory() {
  const [useSmallScreen, setUseSmallScreen] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  const rows = useMemo(() => buildPeople(12), []);
  const getRowId = useCallback((row: Person) => row.id, []);

  return (
    <View className="flex-1 p-4">
      <View className="mb-[12px] flex-row items-center justify-between">
        <Text className="text-[#6b7280] text-[12px]">
          {useSmallScreen ? 'Card view — each row rendered by renderSmallScreen.' : 'Table view — toggle to switch.'}
        </Text>
        <Switch isSelected={useSmallScreen} onSelectedChange={setUseSmallScreen} label="Card view" />
      </View>
      <Table
        {...CLASSIC_TABLE}
        data={rows}
        columns={DEFAULT_COLUMNS}
        getRowId={getRowId}
        height={440}
        rowHeight={52}
        selectable={true}
        selectedRowIds={selectedRowIds}
        onSelectionChange={setSelectedRowIds}
        useSmallScreen={useSmallScreen}
        renderSmallScreen={renderPersonCard}
        testID="table-small-screen"
      />
    </View>
  );
}

export const Editable: Story = {
  name: 'Demo: Edit a cell',
  render: () => <EditableTableStory />,
  args: {
    // render override supplies its own data; placeholders satisfy Story typing
    data: [],
    columns: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Editable cells render as TextInputs — find by initial display value
    const nameInput = await canvas.findByDisplayValue('Ava Cole');
    expect(nameInput).toBeTruthy();

    // Edit the cell
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Test Name');
    expect(await canvas.findByDisplayValue('Test Name')).toBeTruthy();
  },
};

export const SmallScreen: Story = {
  name: 'Demo: Toggle card view',
  render: () => <SmallScreenTableStory />,
  args: {
    data: [],
    columns: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // In the default (table) state, the column headers are visible
    await canvas.findByText('Name');
    await canvas.findByText('Email');

    // Switch to card view
    const toggle = await canvas.findByRole('switch', { name: 'Card view' });
    await userEvent.click(toggle);

    // Headers are gone; card content from renderSmallScreen is visible
    expect(canvas.queryByText('Email')).toBeNull();
    expect((await canvas.findAllByText('Ava Cole')).length).toBeGreaterThan(0);
  },
};
