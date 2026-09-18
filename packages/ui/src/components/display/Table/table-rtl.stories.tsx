import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, fn, type UserEventObject, userEvent, waitFor, within } from 'storybook/test';
import { DirectionProvider } from '../../../hooks/direction-provider';
import { buildPeople, CLASSIC_TABLE, type Person, TablePerson } from './__stories__/table-story-data';
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
