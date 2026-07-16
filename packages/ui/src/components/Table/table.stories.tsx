import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Switch } from '../Switch/switch';
import { Table, type TableColumn, type TableProps } from './table';

// ─── Shared data builders ─────────────────────────────────────────────────────

type Person = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'invited' | 'suspended';
  mrr: number;
};

const FIRST = ['Ava', 'Leo', 'Mia', 'Kai', 'Zoe', 'Eli', 'Noa', 'Ren', 'Ivy', 'Jude'];
const LAST = ['Cole', 'Frost', 'Vale', 'Reyes', 'Okafor', 'Sato', 'Lund', 'Marsh', 'Bose', 'Quinn'];
const ROLES = ['Owner', 'Admin', 'Member', 'Viewer'];
const STATUSES: Person['status'][] = ['active', 'invited', 'suspended'];

function buildPeople(count: number): Person[] {
  const out: Person[] = [];
  for (let i = 0; i < count; i++) {
    // modulo guarantees in-bounds; ?? '' satisfies noUncheckedIndexedAccess
    const first = FIRST[i % FIRST.length] ?? '';
    const last = LAST[(i * 7) % LAST.length] ?? '';
    const status = STATUSES[(i * 5) % STATUSES.length] ?? 'active';
    out.push({
      id: String(i),
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@beui.dev`,
      role: ROLES[(i * 3) % ROLES.length] ?? 'Member',
      status,
      mrr: 12 + ((i * 37) % 488),
    });
  }
  return out;
}

const STATUS_COLORS: Record<Person['status'], string> = {
  active: '#059669',
  invited: '#d97706',
  suspended: '#dc2626',
};

function StatusBadge({ status }: { status: Person['status'] }) {
  return (
    <View
      style={{
        borderRadius: 9999,
        paddingHorizontal: 8,
        paddingVertical: 2,
        alignSelf: 'flex-start',
        backgroundColor:
          status === 'active'
            ? 'rgba(5,150,105,0.1)'
            : status === 'invited'
              ? 'rgba(217,119,6,0.1)'
              : 'rgba(220,38,38,0.1)',
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '500',
          textTransform: 'capitalize',
          color: STATUS_COLORS[status],
        }}
      >
        {status}
      </Text>
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
    cell: (row) => <Text style={{ fontSize: 13, fontWeight: '500', color: '#111' }}>{row.name}</Text>,
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
    cell: (row) => <Text style={{ fontSize: 13, textAlign: 'right', color: '#111' }}>${row.mrr.toLocaleString()}</Text>,
  },
];

// ─── Typed wrapper so meta can be pinned to Person ────────────────────────────
// Using a wrapper avoids the contravariance problem between TableColumn<Person>
// and TableColumn<unknown> that occurs when Meta infers T = unknown from the
// raw generic component.

function TablePerson(props: TableProps<Person>) {
  return <Table {...props} />;
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Components/Table',
  component: TablePerson,
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

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Default ─────────────────────────────────────────────────────────────────
// 1000 rows, sort by mrr desc initially, selectable

export const Default: Story = {
  args: {
    data: buildPeople(1000),
    columns: DEFAULT_COLUMNS,
    selectable: true,
    defaultSort: { key: 'mrr', direction: 'desc' },
    height: 420,
    rowHeight: 52,
    testID: 'table-default',
  },
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

// ─── Async ────────────────────────────────────────────────────────────────────
// Infinite scroll with simulated 700 ms pages

const PAGE_SIZE = 20;
const MAX_PAGES = 8;

function buildPage(page: number): Person[] {
  const out: Person[] = [];
  const start = page * PAGE_SIZE;
  for (let n = start; n < start + PAGE_SIZE; n++) {
    const first = FIRST[n % FIRST.length] ?? '';
    const last = LAST[(n * 7) % LAST.length] ?? '';
    const status = STATUSES[(n * 5) % STATUSES.length] ?? 'active';
    out.push({
      id: String(n),
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${n}@beui.dev`,
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
  useEffect(() => {
    loadMore();
  }, [loadMore]);

  const columns = useMemo<TableColumn<Person>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        cell: (r) => <Text style={{ fontSize: 13, fontWeight: '500', color: '#111' }}>{r.name}</Text>,
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
        cell: (r) => <Text style={{ fontSize: 13, textAlign: 'right', color: '#111' }}>${r.mrr.toLocaleString()}</Text>,
      },
    ],
    [],
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 12, color: '#6b7280' }}>{rows.length} loaded</Text>
        <Text style={{ fontSize: 12, color: '#6b7280' }}>
          {loading ? 'Loading…' : pageRef.current >= MAX_PAGES ? 'All loaded' : 'Scroll for more'}
        </Text>
      </View>
      <Table
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
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

export const Async: Story = {
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
        const next = { ...row };
        delete next[key];
        return next;
      }),
    );
  }, []);

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
    <View style={{ flex: 1, padding: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 12, color: '#6b7280' }}>
          {editable ? 'Tap a cell to edit. Long-press row for actions.' : 'Read-only.'}
        </Text>
        <Switch checked={editable} onCheckedChange={setEditable} label="Editable" />
      </View>
      <Table
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
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

export const Editable: Story = {
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
