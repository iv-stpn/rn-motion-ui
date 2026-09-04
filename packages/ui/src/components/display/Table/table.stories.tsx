import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, type UserEventObject, userEvent, waitFor, within } from 'storybook/test';
import { Choice, ControlCard, Note, Playground, Toggle } from '../../../__stories__/story-harness';
import { DirectionProvider } from '../../../hooks/direction-provider';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { cn } from '../../../lib/cn';
import { Switch } from '../../form/Switch/switch';
import { Text } from '../../typography/Text/text';
import { type SortState, Table, type TableColumn, type TableProps } from './table';

// ─── Classic (pre-headless) styling defaults ───────────────────────────────────
// Apply these to restore the original table appearance when using the headless
// component. Remove or override individual entries to customise.

const CLASSIC_TABLE = {
  className: '',
  headerClassName: 'border-border border-b-[1.5px]',
  rowClassName: 'border-border border-b-[1.5px]',
  cardClassName: 'border-border border-b-[1.5px]',
  footerClassName: 'border-border border-t-[1.5px]',
  selectedClassName: 'bg-surface-selected',
  dropIndicatorClassName: 'bg-primary',
  skeletonClassName: 'bg-border',
} as const;

// ─── Shared data builders ─────────────────────────────────────────────────────

type Person = { id: string; name: string; email: string; role: string; status: 'active' | 'invited' | 'suspended'; mrr: number };

const FIRST = ['Ava', 'Leo', 'Mia', 'Kai', 'Zoe', 'Eli', 'Noa', 'Ren', 'Ivy', 'Jude'];
const LAST = ['Cole', 'Frost', 'Vale', 'Reyes', 'Okafor', 'Sato', 'Lund', 'Marsh', 'Bose', 'Quinn'];
const ROLES = ['Owner', 'Admin', 'Member', 'Viewer'];
const STATUSES: Person['status'][] = ['active', 'invited', 'suspended'];

function buildPeople(count: number): Person[] {
  const out: Person[] = [];
  for (let i = 0; i < count; i += 1) {
    // modulo guarantees in-bounds; ?? '' satisfies noUncheckedIndexedAccess
    const first = FIRST[i % FIRST.length] ?? '';
    const last = LAST[(i * 7) % LAST.length] ?? '';
    const status = STATUSES[(i * 5) % STATUSES.length] ?? 'active';
    out.push({
      id: String(i),
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@rnmotionui.dev`,
      role: ROLES[(i * 3) % ROLES.length] ?? 'Member',
      status,
      mrr: 12 + ((i * 37) % 488),
    });
  }
  return out;
}

function statusBackgroundClass(status: Person['status']): `bg-[${string}]` {
  if (status === 'active') return 'bg-[rgba(5,150,105,0.1)]';
  if (status === 'invited') return 'bg-[rgba(217,119,6,0.1)]';
  return 'bg-[rgba(220,38,38,0.1)]';
}

function statusTextColorClass(status: Person['status']): `text-[${string}]` {
  if (status === 'active') return 'text-[#059669]';
  if (status === 'invited') return 'text-[#d97706]';
  return 'text-[#dc2626]';
}

type StatusBadgeProps = { status: Person['status'] };

function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <View className={cn('self-start rounded-full px-2 py-0.5', statusBackgroundClass(status))}>
      <Text weight="medium" className={cn('text-[11px] capitalize', statusTextColorClass(status))}>
        {status}
      </Text>
    </View>
  );
}

const ITEM_SEPARATOR = ' · ';

/** The card body `renderSmallScreen` asks for: the same five fields, stacked instead of columned. */
function renderPersonCard(row: Person) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between gap-2">
        <Text numberOfLines={1} size="sm" className="flex-1" weight="semibold">
          {row.name}
        </Text>
        <StatusBadge status={row.status} />
      </View>
      <Text className="text-muted-foreground" numberOfLines={1} size="xs">
        {row.email}
      </Text>
      <View className="flex-row items-center gap-1.5">
        <Text size="xs">{row.role}</Text>
        <Text className="text-muted-foreground" size="xs">
          {ITEM_SEPARATOR}
        </Text>
        <Text size="xs" weight="medium">{`$${row.mrr.toLocaleString()} MRR`}</Text>
      </View>
    </View>
  );
}

// ─── Default columns ──────────────────────────────────────────────────────────

const DEFAULT_COLUMNS: TableColumn<Person>[] = [
  {
    key: 'name',
    header: 'Name',
    sortable: true,
    width: '1.4fr',
    cell: (row) => (
      <Text weight="medium" className="text-[13px]">
        {row.name}
      </Text>
    ),
  },
  { key: 'email', header: 'Email', width: '1.8fr' },
  { key: 'role', header: 'Role', sortable: true, width: '120px' },
  {
    key: 'status',
    header: 'Status',
    width: '130px',
    cell: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'mrr',
    header: 'MRR',
    sortable: true,
    align: 'right',
    width: '100px',
    cell: (row) => <Text className="text-right text-[13px]">{`$${row.mrr.toLocaleString()}`}</Text>,
  },
];

// ─── Typed wrapper so meta can be pinned to Person ────────────────────────────
// Using a wrapper avoids the contravariance problem between TableColumn<Person>
// and TableColumn<unknown> that occurs when Meta infers T = unknown from the
// raw generic component.

function TablePerson(props: TableProps<Person>) {
  return <Table {...CLASSIC_TABLE} {...props} />;
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Display/Table',
  component: TablePerson,
  // `centered` like every other story group — a missing layout resolves to an
  // empty canvas container on the native storybook, which collapses the
  // flex-1 → ScrollView chain and blanks the story on the
  // Android APK (same mechanism as the fixed fullscreen menu stories, 4250db21).
  parameters: { layout: 'centered' },
  args: {
    data: buildPeople(20),
    columns: DEFAULT_COLUMNS,
    getRowId: (row: Person) => row.id,
    height: 420,
    rowHeight: 52,
    onSelectionChange: fn(),
    onSortChange: fn(),
    onColumnOrderChange: fn(),
  },
} satisfies Meta<typeof TablePerson>;

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

export default meta;

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

function getPersonId(row: Person) {
  return row.id;
}

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
    const table = (await canvas.findByTestId('table-narrow')).getBoundingClientRect();
    const row = (await canvas.findByTestId('table-narrow-row-0')).getBoundingClientRect();
    // The body row sits under the header (aligned to the table's left edge), not
    // beside it — a horizontal ScrollView would otherwise push it off-screen and
    // the body reads as empty on a narrow screen.
    expect(row.left).toBeLessThan(table.left + 2);
    expect(row.top).toBeGreaterThanOrEqual(table.top + NARROW_ROW_HEIGHT - 1);
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

// ─── RTL ─────────────────────────────────────────────────────────────────────

const DIRECTION_STYLES = { ltr: { direction: 'ltr' }, rtl: { direction: 'rtl' } } as const;
const RTL_COLUMNS: TableColumn<Person>[] = [
  { key: 'name', header: 'Name', width: '1fr' },
  { key: 'mrr', header: 'MRR', align: 'right', width: '100px' },
];
const RTL_ROWS = buildPeople(3);
/** Fixed so the assertions below can reason about column geometry in pixels. */
const RTL_WIDTH = 420;

type DirectionalTableProps = { direction: 'ltr' | 'rtl' };

function DirectionalTable({ direction }: DirectionalTableProps) {
  return (
    <DirectionProvider value={direction}>
      <View style={{ ...DIRECTION_STYLES[direction], width: RTL_WIDTH }}>
        <Table
          {...CLASSIC_TABLE}
          columns={RTL_COLUMNS}
          data={RTL_ROWS}
          height={200}
          rowHeight={44}
          testID={`table-${direction}`}
        />
      </View>
    </DirectionProvider>
  );
}

/**
 * Column *order* is the consumer's call — the library renders the array it is
 * given, and whether "first" should mean the right-hand side under RTL depends
 * on the data, so nothing here reorders it.
 *
 * Column *alignment* is not, and that is what this pins. A column with no
 * `align` pairs `alignItems: 'flex-start'` — already direction-relative — with
 * its text alignment, so the text has to follow the direction too or it ends up
 * left-aligned inside a right-aligned cell. An explicit `align: 'right'` stays
 * physically right in both directions, because a caller asking for right means
 * right.
 */
export const RightToLeft: Story = {
  name: 'Demo: Default alignment follows direction',
  args: { columns: [], data: [] },
  render: () => (
    <View className="gap-6">
      <DirectionalTable direction="ltr" />
      <DirectionalTable direction="rtl" />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId('table-ltr');
    await canvas.findByTestId('table-rtl');

    // Resolved text-align of the header cell for a column, read off the DOM
    // rather than the style object: `auto` is not a CSS value, so what matters
    // is what the browser actually computed.
    const headerAlign = async (direction: string, header: string) => {
      const node = await within(await canvas.findByTestId(`table-${direction}`)).findByText(header);
      return getComputedStyle(node).textAlign;
    };

    // Default column: resolves to the *starting* edge of the reading direction,
    // and asserted as the concrete edge rather than a relative keyword —
    // react-native-web puts `dir="auto"` on every Text, so `start` on a Latin
    // string resolves to the left even inside an RTL page.
    expect(await headerAlign('ltr', 'Name')).toBe('left');
    expect(await headerAlign('rtl', 'Name')).toBe('right');

    // Explicit `align: 'right'` is physical and does not flip.
    expect(await headerAlign('ltr', 'MRR')).toBe('right');
    expect(await headerAlign('rtl', 'MRR')).toBe('right');
  },
};

// ─── RTL: column reorder ──────────────────────────────────────────────────────

/** Three equal columns, so every drop boundary is a clean third of the width. */
const THIRDS_COLUMNS: TableColumn<Person>[] = [
  { key: 'name', header: 'Name', width: '1fr' },
  { key: 'role', header: 'Role', width: '1fr' },
  { key: 'mrr', header: 'MRR', width: '1fr' },
];
const THIRDS_ROWS = buildPeople(2);

const orderSpies = { ltr: fn<(keys: string[]) => void>(), rtl: fn<(keys: string[]) => void>() };

type DirectedTableProps = { direction: 'ltr' | 'rtl'; testID: string };

function ReorderTable({ direction, testID }: DirectedTableProps) {
  return (
    <DirectionProvider value={direction}>
      <View style={{ ...DIRECTION_STYLES[direction], width: RTL_WIDTH }}>
        <Table
          {...CLASSIC_TABLE}
          columns={THIRDS_COLUMNS}
          data={THIRDS_ROWS}
          height={160}
          rowHeight={44}
          reorderable={true}
          onColumnOrderChange={orderSpies[direction]}
          testID={testID}
        />
      </View>
    </DirectionProvider>
  );
}

/** A drag bound to one rendered table: its root node (what the hook measures) and direction. */
type Drag = { root: HTMLElement; testID: string; isRTL: boolean };

/**
 * Dispatch one mouse event on `node`, bubbling to `document` — where RNW's
 * `ResponderSystem` listens.
 *
 * Native events rather than `userEvent.pointer`, because user-event emulates
 * drag-to-select: a held-button move extends the DOM selection, which fires
 * `selectionchange`, and `ResponderSystem` reads a `selectionchange` carrying a
 * valid selection as a gesture *terminate*. The drag dies mid-move and the
 * release commits nothing. Chromium selects nothing during this drag (the
 * header row is `select-none`), so dispatching directly is the more faithful of
 * the two rather than a way around a real bug.
 *
 * `buttons` is load-bearing: `isPrimaryPointerDown` drops any `mousemove` whose
 * primary button does not read as held.
 */
function mouse(node: HTMLElement, type: 'mousedown' | 'mousemove' | 'mouseup', x: number, y: number) {
  const held = type !== 'mouseup';
  const init = { bubbles: true, cancelable: true, button: 0, buttons: held ? 1 : 0, clientX: x, clientY: y };
  node.dispatchEvent(new MouseEvent(type, init));
}

/**
 * Physical x inside the table → viewport coordinates.
 *
 * Deliberately no `window.scrollX` term. The hook subtracts a `measureInWindow`
 * origin — `getBoundingClientRect().left`, viewport-relative — from the event's
 * `pageX`, which the DOM derives as `clientX + scrollX`. Those two agree only at
 * scroll 0, and compensating here would hide that rather than fix it. The canvas
 * does not scroll horizontally, so the assertions stay exact and honest.
 */
function dragPoint(root: HTMLElement, physicalX: number) {
  const box = root.getBoundingClientRect();
  return { x: box.left + physicalX, y: box.top + 20 };
}

/**
 * Press the grip for `key`, then wait for the drop indicator to appear.
 *
 * The wait is a layout gate, not a sleep: `indicatorX` stays null until
 * `containerWidth > 0`, so an indicator on screen proves `onLayout` has landed
 * and the boundary table is real.
 */
async function pressGrip(drag: Drag, key: string) {
  const grip = await within(drag.root).findByTestId(`${drag.testID}-grip-${key}`);
  const box = grip.getBoundingClientRect();
  mouse(grip, 'mousedown', box.left + box.width / 2, box.top + box.height / 2);
  await within(drag.root).findByTestId(`${drag.testID}-drop-indicator`);
}

/** Half a column, plus slop — see `dragTo`. */
const HALF_COLUMN = RTL_WIDTH / 6 + 5;

/**
 * Move the held pointer to a physical x inside the table, then wait for the
 * indicator to catch up.
 *
 * The wait is what makes the drag deterministic rather than a race. `dropIndex`
 * lands in a React render, and dispatching the move does not guarantee that
 * render has committed — release the button too early and the responder commits
 * the index from the *grant* instead of this move, which reads as "the drag did
 * nothing" no matter how correct the geometry is.
 *
 * Gating on the indicator also asserts something worth asserting: whichever way
 * the table runs, the line tracks the pointer. Boundaries sit one column apart,
 * so the nearest one is never further than half a column away — a mirrored
 * indicator misses that by a whole table.
 */
async function dragTo(drag: Drag, physicalX: number) {
  const { x, y } = dragPoint(drag.root, physicalX);
  mouse(drag.root, 'mousemove', x, y);
  // Sync queries inside `waitFor`: a nested `findBy*` has its own timeout, and
  // when the two collide the outer one reports "timed out" with no diagnosis.
  await waitFor(() => {
    const box = within(drag.root).getByTestId(`${drag.testID}-drop-indicator`).getBoundingClientRect();
    const centre = (box.left + box.right) / 2 - drag.root.getBoundingClientRect().left;
    expect(Math.abs(centre - physicalX)).toBeLessThan(HALF_COLUMN);
  });
}

/**
 * Release at the given position. The coordinates are repeated rather than
 * omitted so the release cannot read as a move somewhere else first —
 * `onPanResponderRelease` commits the drop index tracked so far, so a stray
 * move would silently change what gets committed.
 */
function releaseDrag(drag: Drag, physicalX: number) {
  const { x, y } = dragPoint(drag.root, physicalX);
  mouse(drag.root, 'mouseup', x, y);
}

/** Column keys in `orderedColumns` order — header cells sit in DOM order. */
function headerOrder(drag: Drag): string[] {
  const prefix = `${drag.testID}-header-`;
  return Array.from(drag.root.querySelectorAll(`[data-testid^="${prefix}"]`)).map((n) =>
    (n.getAttribute('data-testid') ?? '').slice(prefix.length),
  );
}

type MakeDragArgs = { canvasElement: HTMLElement; prefix: string; direction: 'ltr' | 'rtl' };

/** Bind a drag to one of the two rendered tables. */
async function makeDrag({ canvasElement, prefix, direction }: MakeDragArgs): Promise<Drag> {
  const testID = `${prefix}-${direction}`;
  return { root: await within(canvasElement).findByTestId(testID), testID, isRTL: direction === 'rtl' };
}

type IndicatorProbe = { canvasElement: HTMLElement; direction: 'ltr' | 'rtl'; x: number };

/**
 * Drag to a physical x and assert the drop indicator lands on the measured
 * leading edge of `mrr` — the column the line would insert before.
 */
async function assertIndicatorAt({ canvasElement, direction, x }: IndicatorProbe) {
  const drag = await makeDrag({ canvasElement, prefix: 'table-indicator', direction });
  const { root, testID, isRTL } = drag;
  await pressGrip(drag, 'name');
  await dragTo(drag, x);

  await waitFor(() => {
    const scope = within(root);
    const line = scope.getByTestId(`${testID}-drop-indicator`).getBoundingClientRect();
    const cell = scope.getByTestId(`${testID}-header-mrr`).getBoundingClientRect();
    // "Leading edge" is that column's *right* edge once the row is mirrored.
    expect(Math.abs(isRTL ? line.right - cell.right : line.left - cell.left)).toBeLessThan(5);

    // Coarse polarity, so a mirrored-but-plausible position cannot pass by
    // landing on a neighbouring boundary: two thirds along an RTL table is
    // left of centre, and left of centre is wrong under LTR.
    const centre = (line.left + line.right) / 2 - root.getBoundingClientRect().left;
    if (isRTL) expect(centre).toBeLessThan(RTL_WIDTH / 2);
    else expect(centre).toBeGreaterThan(RTL_WIDTH / 2);
  });

  releaseDrag(drag, x);
}

/**
 * Drag-to-reorder cannot inherit the platform's mirroring the way Tabs does.
 * Drop boundaries are accumulated from column *widths* in column order, so the
 * boundary table is logical while the pointer that has to be matched against it
 * is physical — under RTL the two run opposite ways.
 *
 * The reconciliation happens once, at the pointer (`toLogicalX` in table-utils),
 * which is why the insertion arithmetic below is direction-agnostic: the same
 * logical drop index means the same committed order in both directions. What
 * changes is which *physical* edge produces it, and that is what this pins —
 * dropping on the far physical edge appends under LTR and is a no-op under RTL,
 * because under RTL that edge is where the column already is.
 */
export const ReorderDirection: Story = {
  name: 'Demo: Reorder drop targets mirror',
  args: { columns: [], data: [] },
  render: () => (
    <View className="gap-6">
      <ReorderTable direction="ltr" testID="table-reorder-ltr" />
      <ReorderTable direction="rtl" testID="table-reorder-rtl" />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const ltr = await makeDrag({ canvasElement, prefix: 'table-reorder', direction: 'ltr' });
    const rtl = await makeDrag({ canvasElement, prefix: 'table-reorder', direction: 'rtl' });
    orderSpies.ltr.mockClear();
    orderSpies.rtl.mockClear();

    // The grip itself sits on the leading edge of its cell in both directions —
    // flexbox mirrors its position, and the negative margin that tucks it into
    // the cell padding is flipped to match (`-ml-1` → `-mr-1`).
    const gripInset = async ({ root, testID, isRTL }: Drag) => {
      const cell = (await within(root).findByTestId(`${testID}-header-name`)).getBoundingClientRect();
      const grip = (await within(root).findByTestId(`${testID}-grip-name`)).getBoundingClientRect();
      return isRTL ? cell.right - grip.right : grip.left - cell.left;
    };
    expect(await gripInset(ltr)).toBeGreaterThan(9);
    expect(await gripInset(ltr)).toBeLessThan(15);
    expect(await gripInset(rtl)).toBeGreaterThan(9);
    expect(await gripInset(rtl)).toBeLessThan(15);

    // Far right edge, LTR: past every midpoint, so `name` goes last.
    await pressGrip(ltr, 'name');
    await dragTo(ltr, 416);
    releaseDrag(ltr, 416);
    await waitFor(() => expect(headerOrder(ltr)).toEqual(['role', 'mrr', 'name']));
    expect(orderSpies.ltr).toHaveBeenCalledWith(['role', 'mrr', 'name']);

    // Same physical point, RTL: that edge is the *logical start*, where `name`
    // already is, so the drop is a no-op and the spy never fires.
    await pressGrip(rtl, 'name');
    await dragTo(rtl, 416);
    releaseDrag(rtl, 416);
    await waitFor(() => expect(headerOrder(rtl)).toEqual(['name', 'role', 'mrr']));
    expect(orderSpies.rtl).not.toHaveBeenCalled();

    // Opposite physical edge, RTL: that is the logical end, so `name` goes last
    // — the same committed order the LTR drag produced from the other side.
    await pressGrip(rtl, 'name');
    await dragTo(rtl, 4);
    releaseDrag(rtl, 4);
    await waitFor(() => expect(headerOrder(rtl)).toEqual(['role', 'mrr', 'name']));
    expect(orderSpies.rtl).toHaveBeenCalledWith(['role', 'mrr', 'name']);
  },
};

/**
 * The drop indicator is a second, independent flip. Its `left` is physical, so
 * mirroring the pointer is not enough — get one of the two right and the other
 * wrong and the line lands a column away from the boundary it claims to mark,
 * which is exactly the failure the pointer-only fix would have shipped.
 *
 * So the assertion is against the *measured* edge of the cell the line sits
 * before, not against a computed pixel, plus a coarse which-half-of-the-table
 * guard so a mirrored-but-plausible position cannot pass.
 */
export const ReorderIndicatorDirection: Story = {
  name: 'Demo: Drop indicator mirrors',
  args: { columns: [], data: [] },
  render: () => (
    <View className="gap-6">
      <ReorderTable direction="ltr" testID="table-indicator-ltr" />
      <ReorderTable direction="rtl" testID="table-indicator-rtl" />
    </View>
  ),
  play: async ({ canvasElement }) => {
    // Mirrored physical points that both resolve to the same logical boundary:
    // the one before the third column, two thirds along the reading direction.
    await assertIndicatorAt({ canvasElement, direction: 'ltr', x: 270 });
    await assertIndicatorAt({ canvasElement, direction: 'rtl', x: 150 });
  },
};

// ─── RTL: action overlays ─────────────────────────────────────────────────────

function OverlayTable({ direction, testID }: DirectedTableProps) {
  return (
    <DirectionProvider value={direction}>
      <View style={{ ...DIRECTION_STYLES[direction], width: RTL_WIDTH }}>
        <Table
          {...CLASSIC_TABLE}
          columns={THIRDS_COLUMNS}
          data={THIRDS_ROWS}
          height={160}
          rowHeight={44}
          onInsertRow={fn()}
          onDeleteRow={fn()}
          onInsertColumn={fn()}
          onDeleteColumn={fn()}
          testID={testID}
        />
      </View>
    </DirectionProvider>
  );
}

type OverlayProbe = { user: UserEventObject; container: HTMLElement; testID: string; isRTL: boolean };

/**
 * Long-press `host`, then measure the insert/delete pair it reveals against the
 * host's own box while the press is still held.
 *
 * Reported as gaps rather than absolute pixels: the host is a full-width row in
 * one case and a single header cell in the other, and the claim under test is
 * only which *edge* the pair hugs, which the two gaps capture on their own.
 */
async function overlayGaps(probe: OverlayProbe, host: HTMLElement, insert: string, del: string) {
  const scope = within(probe.container);
  await probe.user.pointer({ keys: '[MouseLeft>]', target: host });
  // Pressable's long-press delay is 500ms, which makes the default 1s timeout
  // uncomfortably tight on a loaded CI box.
  const a = (await scope.findByLabelText(insert, {}, { timeout: 2000 })).getBoundingClientRect();
  const b = (await scope.findByLabelText(del, {}, { timeout: 2000 })).getBoundingClientRect();
  const box = host.getBoundingClientRect();
  const union = { left: Math.min(a.left, b.left), right: Math.max(a.right, b.right) };
  const gaps = probe.isRTL
    ? { trailing: union.left - box.left, leading: box.right - union.right }
    : { trailing: box.right - union.right, leading: union.left - box.left };
  await probe.user.pointer({ keys: '[/MouseLeft]', target: host });
  return gaps;
}

/**
 * Both overlays for one direction: the row pair and the column pair.
 *
 * Each is asserted as a *pair* of gaps. A small trailing gap on its own would
 * also pass if the overlay had stretched across the host, so the leading gap has
 * to be large — and the leading floors are set well inside the true values (a
 * ~366px row gap, a ~96px cell gap) so they fail on a mirror, not on rounding.
 */
async function assertOverlaysTrail(probe: OverlayProbe) {
  const scope = within(probe.container);

  // Row overlay: `right-2` → `left-2`, an 8px inset on a ~418px-wide row.
  const row = await scope.findByTestId(`${probe.testID}-row-0`);
  const rowGaps = await overlayGaps(probe, row, 'Insert row before row 1', 'Delete row 1');
  expect(rowGaps.trailing).toBeLessThan(12);
  expect(rowGaps.leading).toBeGreaterThan(200);

  // Column overlay on the middle header: `right-0.5` → `left-0.5`, a 2px inset
  // on a 140px cell. Tighter numbers, same shape of assertion.
  const header = await scope.findByTestId(`${probe.testID}-header-role`);
  const colGaps = await overlayGaps(probe, header, 'Insert column before Role', 'Delete column Role');
  expect(colGaps.trailing).toBeLessThan(6);
  expect(colGaps.leading).toBeGreaterThan(60);
}

/**
 * The row and column action overlays pin to the *trailing* edge, which a plain
 * `right-2` / `right-0.5` cannot express: `right` stays physical under RTL, so
 * the buttons would sit on the reading direction's leading edge — covering the
 * start of the very content they act on, and landing on the opposite side from
 * every other trailing affordance in the table.
 */
export const ActionOverlaysDirection: Story = {
  name: 'Demo: Action overlays follow the trailing edge',
  args: { columns: [], data: [] },
  render: () => (
    <View className="gap-6">
      <OverlayTable direction="ltr" testID="table-overlay-ltr" />
      <OverlayTable direction="rtl" testID="table-overlay-rtl" />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Shared pointer system, so the two long-presses have to stay sequential.
    const user = userEvent.setup();

    const probeFor = async (direction: 'ltr' | 'rtl'): Promise<OverlayProbe> => {
      const testID = `table-overlay-${direction}`;
      return { user, container: await canvas.findByTestId(testID), testID, isRTL: direction === 'rtl' };
    };

    await assertOverlaysTrail(await probeFor('ltr'));
    await assertOverlaysTrail(await probeFor('rtl'));
  },
};
