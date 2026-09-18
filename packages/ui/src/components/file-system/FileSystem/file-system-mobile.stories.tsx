import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { centerOf, dragOnto, fireDrag, newDragTransfer } from '../../../__stories__/story-drag';
import { MOBILE_WIDTH, TABLET_WIDTH } from './__stories__/file-system-playground';
import { FILE_SYSTEM_ARGS, FILE_SYSTEM_DECORATORS } from './__stories__/file-system-story-meta';
import {
  centreOf,
  dragHost,
  ENTRY_TEST_ID_PREFIX,
  holdDrag,
  listRow,
  longPress,
  selectedPaths,
} from './__stories__/file-system-story-testing';
import { FileSystem } from './file-system';
import { FS_DROP_HINT_TEST_ID } from './logic/file-system-test-id';
import type { FileSystemContextMenuAction, FileSystemItem } from './types/file-system.types';

const meta = {
  title: 'File System/FileSystem',
  component: FileSystem,
  parameters: { layout: 'centered' },
  decorators: FILE_SYSTEM_DECORATORS,
  args: FILE_SYSTEM_ARGS,
} satisfies Meta<typeof FileSystem>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Mobile views ──────────────────────────────────────────────────────────────
// The two touch views. They drop the desktop's marquee and hover — a phone has no
// right button to summon a menu and no pointer to hover with — and give every
// entry a visible kebab instead. A long-press is the way into multi-select; once
// anything is selected every kebab becomes a checkbox, checked on the selection
// (see `FileSystemMobileMenu`). The same hold keeps dragging past the escape slop,
// so a held selection lifts onto a folder row or tile — see the three
// `Mobile*DragAndDrop` stories below.

/** Actions vary by entry kind; folders expose fewer operations than files. */
function resolveContextMenuActions(item: FileSystemItem): FileSystemContextMenuAction[] {
  const common: FileSystemContextMenuAction[] = [
    { id: 'rename', label: 'Rename…' },
    { id: 'move', label: 'Move to…' },
    { id: 'delete', label: 'Delete', destructive: true },
  ];
  if (item.kind === 'file')
    return [
      { id: 'open', label: 'Open' },
      { id: 'download', label: 'Download' },
      { id: 'copy-link', label: 'Copy link' },
      ...common,
    ];
  return [{ id: 'open', label: 'Open' }, ...common];
}

/**
 * The mobile grid at phone width: two thumbnail columns, the name left-aligned
 * under each preview and free to wrap to a second line, with a kebab beside it.
 */
export const MobileGrid: Story = {
  name: 'Demo: Mobile grid',
  decorators: [
    (Story) => (
      <View style={{ maxWidth: '100%', width: MOBILE_WIDTH }}>
        <Story />
      </View>
    ),
  ],
  args: {
    defaultView: 'mobile-grid',
    selectionMode: 'multiple',
    getContextMenuActions: resolveContextMenuActions,
  },
};

/**
 * The same grid in a tablet-width container. Columns are packed at a minimum tile
 * width rather than fixed at two, so a wider container gets more tiles per row
 * instead of two stretched ones — five across here, against two at phone width.
 */
export const MobileGridWide: Story = {
  name: 'Demo: Mobile grid (wide)',
  decorators: [
    (Story) => (
      <View style={{ maxWidth: '100%', width: TABLET_WIDTH }}>
        <Story />
      </View>
    ),
  ],
  args: {
    defaultView: 'mobile-grid',
    selectionMode: 'multiple',
    getContextMenuActions: resolveContextMenuActions,
  },
};

/**
 * The mobile list at phone width: one name per row, statistics beneath it joined
 * with a middle dot, and the same kebab/checkbox control on the right edge.
 */
export const MobileList: Story = {
  name: 'Demo: Mobile list',
  decorators: [
    (Story) => (
      <View style={{ maxWidth: '100%', width: MOBILE_WIDTH }}>
        <Story />
      </View>
    ),
  ],
  args: {
    defaultView: 'mobile-list',
    selectionMode: 'multiple',
    getContextMenuActions: resolveContextMenuActions,
  },
};

/**
 * Long-press is the touch views' way into multi-select: it selects the entry
 * under the finger and turns every kebab into a checkbox, checked on the
 * selection. Tapping another entry's checkbox adds it; tapping a checked one
 * takes it back out.
 */
export const MobileMultiSelect: Story = {
  name: 'Demo: Mobile multi-select',
  decorators: [
    (Story) => (
      <View style={{ maxWidth: '100%', width: MOBILE_WIDTH }}>
        <Story />
      </View>
    ),
  ],
  args: {
    defaultView: 'mobile-grid',
    selectionMode: 'multiple',
    getContextMenuActions: resolveContextMenuActions,
    onSelectedItemsChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // findAllByText: HoldItem double-renders draggable rows — pick first.
    expect((await canvas.findAllByText('README.md'))[0]).toBeDefined();

    // Every entry starts with a kebab and no checkbox in sight.
    await canvas.findByTestId(`${ENTRY_TEST_ID_PREFIX}README.md-kebab`);
    expect(canvas.queryByTestId(`${ENTRY_TEST_ID_PREFIX}README.md-checkbox`)).toBeNull();

    // A long press selects the entry under the finger.
    const readmeRow = (await canvas.findAllByRole('button', { name: 'README.md' }))[0];
    if (!readmeRow) throw new Error('no README.md row rendered');
    await longPress(readmeRow);
    await waitFor(() =>
      expect(args.onSelectedItemsChange).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'README.md' })]),
    );

    // The kebabs yield to checkboxes, and the selected entry's is the checked one.
    expect(canvas.queryByTestId(`${ENTRY_TEST_ID_PREFIX}README.md-kebab`)).toBeNull();
    expect(await canvas.findByTestId(`${ENTRY_TEST_ID_PREFIX}README.md-checkbox`)).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['README.md']));

    // Tapping a second entry's checkbox adds it to the selection.
    await userEvent.click(await canvas.findByTestId(`${ENTRY_TEST_ID_PREFIX}Roadmap.pptx-checkbox`));
    await waitFor(() =>
      expect(args.onSelectedItemsChange).toHaveBeenLastCalledWith([
        expect.objectContaining({ name: 'README.md' }),
        expect.objectContaining({ name: 'Roadmap.pptx' }),
      ]),
    );
    expect(await canvas.findByTestId(`${ENTRY_TEST_ID_PREFIX}Roadmap.pptx-checkbox`)).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['README.md', 'Roadmap.pptx']));
  },
};

/**
 * The mobile tap contract: a single tap OPENS the entry — a phone has no
 * double-click, so the first tap must not select. Only a hold (long press)
 * enters selection mode; once anything is selected a tap toggles that entry's
 * selection, mirroring the checkboxes.
 */
export const MobileTapOpens: Story = {
  name: 'Demo: Mobile tap opens, hold selects',
  decorators: [
    (Story) => (
      <View style={{ maxWidth: '100%', width: MOBILE_WIDTH }}>
        <Story />
      </View>
    ),
  ],
  args: {
    defaultView: 'mobile-list',
    getContextMenuActions: resolveContextMenuActions,
    onFileOpen: fn(),
    selectionMode: 'multiple',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // No selection yet: kebabs everywhere, no checkbox in sight.
    await canvas.findByTestId(`${ENTRY_TEST_ID_PREFIX}README.md-kebab`);
    expect(canvas.queryByTestId(`${ENTRY_TEST_ID_PREFIX}README.md-checkbox`)).toBeNull();

    // A single tap opens the file — it does not select, and no checkbox appears.
    const readme = (await canvas.findAllByRole('button', { name: 'README.md' }))[0];
    if (!readme) throw new Error('no README.md row rendered');
    await userEvent.click(readme);
    await waitFor(() => expect(args.onFileOpen).toHaveBeenCalledWith(expect.objectContaining({ name: 'README.md' }), null));
    expect(canvas.queryByTestId(`${ENTRY_TEST_ID_PREFIX}README.md-checkbox`)).toBeNull();
    expect(selectedPaths(canvas)).toEqual([]);

    // Tapping a folder opens it: the navigation happens, not a selection.
    const documents = (await canvas.findAllByRole('button', { name: 'Documents' }))[0];
    if (!documents) throw new Error('no Documents row rendered');
    await userEvent.click(documents);
    await canvas.findAllByText('Contract.docx');
    expect(args.onFileOpen).toHaveBeenCalledTimes(1);
    expect(selectedPaths(canvas)).toEqual([]);

    // Back at the root, a hold still enters selection mode.
    await userEvent.click(await canvas.findByLabelText('Back'));
    await canvas.findAllByText('README.md');
    const row = (await canvas.findAllByRole('button', { name: 'README.md' }))[0];
    if (!row) throw new Error('no README.md row rendered');
    await longPress(row);
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['README.md']));
    expect(await canvas.findByTestId(`${ENTRY_TEST_ID_PREFIX}README.md-checkbox`)).toHaveAttribute('aria-checked', 'true');

    // In selection mode a tap toggles that entry's selection.
    const roadmap = (await canvas.findAllByRole('button', { name: 'Roadmap.pptx' }))[0];
    if (!roadmap) throw new Error('no Roadmap.pptx row rendered');
    await userEvent.click(roadmap);
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['README.md', 'Roadmap.pptx']));
  },
};

/**
 * The mobile kebab contract: tapping the three-dot menu opens the entry's
 * context menu AND selects the entry in the same gesture — the row highlights
 * and the selection mode comes on, so the menu opens onto a selected item.
 */
export const MobileKebabSelects: Story = {
  name: 'Demo: Mobile kebab opens and selects',
  decorators: [
    (Story) => (
      <View style={{ maxWidth: '100%', width: MOBILE_WIDTH }}>
        <Story />
      </View>
    ),
  ],
  args: {
    defaultView: 'mobile-list',
    getContextMenuActions: resolveContextMenuActions,
    onSelectedItemsChange: fn(),
    selectionMode: 'multiple',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const kebab = await canvas.findByTestId(`${ENTRY_TEST_ID_PREFIX}README.md-kebab`);
    expect(canvas.queryByTestId(`${ENTRY_TEST_ID_PREFIX}README.md-checkbox`)).toBeNull();

    // One tap: the menu opens and the entry joins the selection. The menu's
    // actions appear (the same ones a right-click would show) while the row is
    // painted selected — the kebab stays in the slot until the menu closes.
    await userEvent.click(within(kebab).getByRole('button'));
    await screen.findByRole('menuitem', { name: 'Open' });
    await waitFor(() =>
      expect(args.onSelectedItemsChange).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'README.md' })]),
    );
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['README.md']));

    // Closing the menu releases the slot: the kebab gives way to the checked
    // checkbox, the selection-mode surface.
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Open' }));
    await waitFor(() => expect(canvas.queryByTestId(`${ENTRY_TEST_ID_PREFIX}README.md-kebab`)).toBeNull());
    expect(await canvas.findByTestId(`${ENTRY_TEST_ID_PREFIX}README.md-checkbox`)).toHaveAttribute('aria-checked', 'true');
  },
};

/**
 * The mobile list's drag-and-drop, driven by the browser's own HTML5 drag exactly
 * like the desktop views: `draggable` makes every row a drag source and every
 * folder row a drop target. A FILE row is no destination, so the same drag onto
 * one falls through to the background zone — the open folder, which is where the
 * entry already is, so it is not a move either.
 */
export const MobileListDragAndDrop: Story = {
  name: 'Demo: Mobile list drag and drop',
  decorators: [
    (Story) => (
      <View style={{ maxWidth: '100%', width: MOBILE_WIDTH }}>
        <Story />
      </View>
    ),
  ],
  args: { defaultView: 'mobile-list', draggable: true, onMove: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // findAllByText: HoldItem double-renders draggable rows — pick first.
    expect((await canvas.findAllByText('Roadmap.pptx'))[0]).toBeDefined();

    const row = await listRow(canvas, 'Roadmap.pptx');
    const folder = await listRow(canvas, 'Documents');

    // The one part of a drag no play function can perform: the browser lifting a
    // node at all. What the component owes it is the attribute, set on the host
    // `<HoldDraggable>` above the row.
    await expect(dragHost(row)).toHaveAttribute('draggable', 'true');

    const transfer = newDragTransfer();
    await dragOnto({ source: row, target: folder, to: centerOf(folder), transfer });
    // Windows-style drop cue: while the drag hangs over the folder, a hint names
    // it under the ghost — and leaves again with the drag.
    expect(await canvas.findByTestId(FS_DROP_HINT_TEST_ID)).toHaveTextContent('Move into Documents');
    fireDrag(row, 'dragend', transfer, centerOf(folder));
    await waitFor(() => expect(args.onMove).toHaveBeenCalledWith({ destination: 'Documents/', sources: ['Roadmap.pptx'] }));
    await waitFor(() => expect(canvas.queryByTestId(FS_DROP_HINT_TEST_ID)).toBeNull());

    // A file row is no destination, so the same drag onto one falls through to the
    // background zone — the open folder, which is where the entry already is, so
    // it is not a move either. Without this the assertion above would also pass on
    // a component that reported every release as a drop.
    const file = await listRow(canvas, 'Budget-2026.xlsx');
    const second = newDragTransfer();
    await dragOnto({ source: row, target: file, to: centerOf(file), transfer: second });
    fireDrag(row, 'dragend', second, centerOf(file));
    await expect(args.onMove).toHaveBeenCalledTimes(1);
  },
};

/**
 * The same HTML5 gesture in the mobile grid: the tile buttons are the sources and
 * folder tiles take the drop, mirroring the desktop icons view.
 */
export const MobileGridDragAndDrop: Story = {
  name: 'Demo: Mobile grid drag and drop',
  decorators: [
    (Story) => (
      <View style={{ maxWidth: '100%', width: MOBILE_WIDTH }}>
        <Story />
      </View>
    ),
  ],
  args: { defaultView: 'mobile-grid', draggable: true, onMove: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // findAllByRole: HoldItem double-renders draggable tiles — pick first.
    const tiles = await canvas.findAllByRole('button', { name: 'Roadmap.pptx' });
    const tile = tiles[0];
    if (!tile) throw new Error('no Roadmap.pptx tile rendered');
    const folderTiles = await canvas.findAllByRole('button', { name: 'Documents' });
    const folderTile = folderTiles[0];
    if (!folderTile) throw new Error('no Documents tile rendered');

    await expect(dragHost(tile)).toHaveAttribute('draggable', 'true');

    const transfer = newDragTransfer();
    await dragOnto({ source: tile, target: folderTile, to: centerOf(folderTile), transfer });
    // Same Windows-style drop cue as the list: named under the ghost, gone with the drag.
    expect(await canvas.findByTestId(FS_DROP_HINT_TEST_ID)).toHaveTextContent('Move into Documents');
    fireDrag(tile, 'dragend', transfer, centerOf(folderTile));
    await waitFor(() => expect(args.onMove).toHaveBeenCalledWith({ destination: 'Documents/', sources: ['Roadmap.pptx'] }));
    await waitFor(() => expect(canvas.queryByTestId(FS_DROP_HINT_TEST_ID)).toBeNull());

    // A file tile is no destination either.
    const fileTiles = await canvas.findAllByRole('button', { name: 'Budget-2026.xlsx' });
    const fileTile = fileTiles[0];
    if (!fileTile) throw new Error('no Budget-2026.xlsx tile rendered');
    const second = newDragTransfer();
    await dragOnto({ source: tile, target: fileTile, to: centerOf(fileTile), transfer: second });
    fireDrag(tile, 'dragend', second, centerOf(fileTile));
    await expect(args.onMove).toHaveBeenCalledTimes(1);
  },
};

/**
 * The flagship mobile flow: hold selects, keep dragging, release on a folder —
 * all through the TOUCH pointer path, since a finger never starts an HTML5 drag.
 *
 * The hold fires the multi-select join first (the kebab yields to a checked
 * checkbox while the finger is still down), then movement past the escape slop
 * lifts the drag, and the release resolves the drop off measured rects — which
 * is why `holdDrag` settles before returning and the assertions below waitFor.
 *
 * A drag lifted from a selected entry carries the whole multi-selection. The
 * hold is additive and never removes — a re-hold of an already selected entry
 * keeps it selected, so the same row can be held again and the lift carries
 * the whole group: join a second entry with a long press, then re-hold-drag
 * the first; both paths travel.
 */
export const MobileHoldDragAndDrop: Story = {
  name: 'Demo: Mobile hold-drag onto a folder',
  decorators: [
    (Story) => (
      <View style={{ maxWidth: '100%', width: MOBILE_WIDTH }}>
        <Story />
      </View>
    ),
  ],
  args: { defaultView: 'mobile-list', draggable: true, selectionMode: 'multiple', onMove: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // findAllByText: HoldItem double-renders draggable rows — pick first.
    expect((await canvas.findAllByText('Roadmap.pptx'))[0]).toBeDefined();

    const row = await listRow(canvas, 'Roadmap.pptx');
    const folder = await listRow(canvas, 'Documents');

    // Hold fires the multi-select join before any drag lifts: the kebab yields
    // to a checked checkbox while the finger is still down.
    await holdDrag(row, centreOf(folder), async () => {
      await canvas.findByTestId(`${ENTRY_TEST_ID_PREFIX}Roadmap.pptx-checkbox`);
      await waitFor(() => expect(canvas.queryByTestId(`${ENTRY_TEST_ID_PREFIX}Roadmap.pptx-kebab`)).toBeNull());
      await waitFor(() => expect(selectedPaths(canvas)).toEqual(['Roadmap.pptx']));
    });
    await waitFor(() => expect(args.onMove).toHaveBeenCalledWith({ destination: 'Documents/', sources: ['Roadmap.pptx'] }));

    // Build a multi-selection the mobile way. The hold only ever joins — a long
    // press on README adds it, and the selection survives the first drag.
    const readme = (await canvas.findAllByRole('button', { name: 'README.md' }))[0];
    if (!readme) throw new Error('no README.md row rendered');
    await longPress(readme);
    // selectedPaths reads in view order — README sits above Roadmap in the list.
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['README.md', 'Roadmap.pptx']));

    // Re-hold the ALREADY-SELECTED Roadmap: the hold must keep it selected
    // (no toggle-off), so the drag that follows lifts the whole group again.
    const photos = await listRow(canvas, 'Photos');
    await holdDrag(row, centreOf(photos), async () => {
      await waitFor(() => expect(selectedPaths(canvas)).toEqual(['README.md', 'Roadmap.pptx']));
    });
    await waitFor(() =>
      expect(args.onMove).toHaveBeenLastCalledWith({
        destination: 'Photos/',
        sources: expect.arrayContaining(['README.md', 'Roadmap.pptx']),
      }),
    );
    // And the selection survives the re-drag — the same rows can be dragged again.
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['README.md', 'Roadmap.pptx']));
  },
};
