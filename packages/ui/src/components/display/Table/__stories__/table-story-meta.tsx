import { fn } from 'storybook/test';
import { buildPeople, DEFAULT_COLUMNS, type Person } from './table-story-data';

// ─── Shared meta pieces ──────────────────────────────────────────────────────
// Storybook's static CSF indexer reads each story file's default export from a
// literal `meta` object *in that file* — it cannot follow `import meta` across
// files. So the reusable default args live here and each story file spreads them
// into its own local `meta` literal.

const TABLE_ARGS = {
  data: buildPeople(20),
  columns: DEFAULT_COLUMNS,
  getRowId: (row: Person) => row.id,
  height: 420,
  rowHeight: 52,
  onSelectionChange: fn(),
  onSortChange: fn(),
  onColumnOrderChange: fn(),
};

export { TABLE_ARGS };
