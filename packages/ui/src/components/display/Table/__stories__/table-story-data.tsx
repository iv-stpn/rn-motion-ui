import { View } from 'react-native';
import { cn } from '../../../../lib/cn';
import { Text } from '../../../typography/Text/text';
import { Table, type TableColumn, type TableProps } from '../table';

// ─── Classic (pre-headless) styling defaults ───────────────────────────────────
// Apply these to restore the original table appearance when using the headless
// component. Remove or override individual entries to customise.

const CLASSIC_TABLE = {
  className: '',
  headerClassName: 'border-border hairline-b',
  rowClassName: 'border-border hairline-b',
  cardClassName: 'border-border hairline-b',
  footerClassName: 'border-border hairline-t',
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
  if (status === 'active') return 'bg-[rgba(5,150,105,0.1)]'; /* theme-exempt: fixed semantic status tint */
  if (status === 'invited') return 'bg-[rgba(217,119,6,0.1)]'; /* theme-exempt: fixed semantic status tint */
  return 'bg-[rgba(220,38,38,0.1)]'; /* theme-exempt: fixed semantic status tint */
}

function statusTextColorClass(status: Person['status']): `text-[${string}]` {
  if (status === 'active') return 'text-[#059669]'; /* theme-exempt: fixed semantic status colour */
  if (status === 'invited') return 'text-[#d97706]'; /* theme-exempt: fixed semantic status colour */
  return 'text-[#dc2626]'; /* theme-exempt: fixed semantic status colour */
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

/** Row identity for the shared `Person` rows. */
function getPersonId(row: Person) {
  return row.id;
}

export type { Person };
export {
  buildPeople,
  CLASSIC_TABLE,
  DEFAULT_COLUMNS,
  FIRST,
  getPersonId,
  LAST,
  ROLES,
  renderPersonCard,
  STATUSES,
  StatusBadge,
  TablePerson,
};
