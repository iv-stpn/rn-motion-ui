import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { centerOf, dragOnto, fireDrag, liftDrag, newDragTransfer } from '../../../__stories__/story-drag';
import { DATES, SCROLLABLE_ITEMS } from './__stories__/file-system-story-data';
import { FILE_SYSTEM_ARGS, FILE_SYSTEM_DECORATORS } from './__stories__/file-system-story-meta';
import {
  centreOf,
  dragHost,
  listRow,
  modifierClick,
  mouse,
  opacityOf,
  pointer,
  SELECTION_CLAUSE_PATTERN,
  selectedPaths,
  sweep,
} from './__stories__/file-system-story-testing';
import { FileSystem } from './file-system';
import { FS_ROW_HEIGHT } from './logic/file-system-rows';
import { FS_DRAG_CONTAINER_TEST_ID, FS_DROP_HINT_TEST_ID, FS_DROP_INDICATOR_TEST_ID } from './logic/file-system-test-id';
import type { FileSystemItem } from './types/file-system.types';
import { FS_HOVER_TEST_ID } from './views/file-system-hover';
import { FS_TILE_DROP_TARGET_TEST_ID } from './views/file-system-icons-tile';
import { FS_MARQUEE_TEST_ID } from './views/file-system-marquee';

const meta = {
  title: 'File System/FileSystem',
  component: FileSystem,
  parameters: { layout: 'centered' },
  decorators: FILE_SYSTEM_DECORATORS,
  args: FILE_SYSTEM_ARGS,
} satisfies Meta<typeof FileSystem>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Drag and drop ─────────────────────────────────────────────────────────────
// Every entry is a `<Draggable>` and every folder a `<Dragzone>` (see the
// `Gestures/*` stories), so on web a mouse drag here is the browser's own HTML5
// drag. The play tests dispatch that sequence by hand through the shared helpers
// in `story-drag.ts` — `userEvent` has no drag to give — and one `DataTransfer`
// threaded through the events of one drag is what makes them a drag.
//
// `dragend` is always the caller's: the DOM `drop` deliberately delivers nothing,
// because the store resolves a drop off measured rects so that a native pan and a
// web drag land on the same zone. Both `onMove` and the source's `onDragEnd` fire
// from that release.

/**
 * `draggable` makes every entry a drag source and every folder a drop target: the
 * browser's own drag on web with a mouse, a held pan for touch and on native. Drag
 * an entry onto a folder — an outline marks the live drop target — to fire `onMove`
 * with the dragged paths and the destination folder path. All four views wire it.
 *
 * `onMove` reports; it does not mutate. Nothing appears to move here because the
 * story hands back the same `items` either way — see Interactive for the half
 * that owns the manifest.
 */
export const WithDragAndDrop: Story = {
  name: 'Demo: Drag and drop',
  args: {
    defaultView: 'list',
    draggable: true,
    onMove: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // findAllByText: HoldItem double-renders draggable rows — pick first.
    expect((await canvas.findAllByText('Roadmap.pptx'))[0]).toBeDefined();

    const row = await listRow(canvas, 'Roadmap.pptx');
    const folder = await listRow(canvas, 'Documents');

    // The one part of a drag no play function can perform: the browser lifting a
    // node at all. What the component owes it is the attribute, set on the host
    // `<Draggable>` above the row — so that is what gets asserted directly.
    await expect(dragHost(row)).toHaveAttribute('draggable', 'true');

    const transfer = newDragTransfer();
    await dragOnto({ source: row, target: folder, to: centerOf(folder), transfer });
    // Nothing has been reported yet: the DOM `drop` carries no payload, because
    // the store resolves the target off measured rects for both platforms.
    await expect(args.onMove).not.toHaveBeenCalled();

    fireDrag(row, 'dragend', transfer, centerOf(folder));
    await waitFor(() => expect(args.onMove).toHaveBeenCalledWith({ destination: 'Documents/', sources: ['Roadmap.pptx'] }));

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
 * The shared drop indicator must stay pinned to the folder it marks while the
 * list scrolls under a stationary pointer mid-drag — the auto-scroll that runs
 * when a drag rides the list's edge, or a wheel.
 *
 * Zone rects are window boxes measured at drag start (or the last layout pass);
 * a scroll moves the rows without any layout event, so the store's cached boxes
 * and everything painted from them would resolve against the pre-scroll
 * positions — the outline drifts a row away from the folder under the pointer.
 * This story parks the pointer just inside a folder row's top edge, scrolls the
 * list one row under it (winner unchanged), and asserts the outline moved with
 * the folder.
 */
export const DragIndicatorTracksScroll: Story = {
  name: 'Demo: Drag indicator follows a mid-drag scroll',
  args: {
    defaultView: 'list',
    draggable: true,
    items: SCROLLABLE_ITEMS,
    onMove: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const container = await canvas.findByTestId(FS_DRAG_CONTAINER_TEST_ID.list);

    const source = await listRow(canvas, 'Roadmap.pptx');
    const folder = await listRow(canvas, 'Documents');

    const transfer = newDragTransfer();
    await liftDrag(source, transfer, centerOf(source));
    // Just inside the folder's TOP edge: a one-row scroll keeps the pointer in
    // the same row, so the winner cannot change and the test is purely about
    // the outline following the content it marks.
    const folderBox = folder.getBoundingClientRect();
    const to = { x: folderBox.left + 20, y: folderBox.top + 4 };
    fireDrag(source, 'drag', transfer, to);
    fireDrag(folder, 'dragover', transfer, to);

    const indicator = await canvas.findByTestId(FS_DROP_INDICATOR_TEST_ID);
    await waitFor(() => {
      const i = indicator.getBoundingClientRect();
      const f = folder.getBoundingClientRect();
      expect(Math.abs(i.top - f.top)).toBeLessThanOrEqual(2);
      expect(Math.abs(i.left - f.left)).toBeLessThanOrEqual(2);
    });

    // Scroll the list a small step under the stationary pointer, like auto-scroll
    // does. Small on purpose: a step this size mounts no new FlatList cells, so
    // no zone re-registers and re-measures behind the scenes — the only thing
    // that can move the outline is the scroll correction itself. The row must
    // actually move, or the assertions below would prove nothing.
    const scroller = [...container.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 1);
    if (!scroller) throw new Error('the list is not scrollable in this viewport');
    const beforeTop = folder.getBoundingClientRect().top;
    scroller.scrollTop += 6;
    await waitFor(() => expect(folder.getBoundingClientRect().top).toBeLessThan(beforeTop - 2));

    // The outline must have moved with it — pinned to the folder, not left at
    // the pre-scroll position.
    await waitFor(() => {
      const i = indicator.getBoundingClientRect();
      const f = folder.getBoundingClientRect();
      expect(Math.abs(i.top - f.top)).toBeLessThanOrEqual(2);
      expect(Math.abs(i.left - f.left)).toBeLessThanOrEqual(2);
    });

    // Release where the pointer (and the folder) now are: the drop resolves
    // against the shifted box and lands on Documents.
    fireDrag(source, 'dragend', transfer, to);
    await waitFor(() =>
      expect(args.onMove).toHaveBeenCalledWith({
        destination: 'Documents/',
        sources: ['Roadmap.pptx'],
      }),
    );
  },
};

/**
 * The same gesture in the grid, where the drop target is marked by the folder's
 * own name filling in under a hover-tinted glyph rather than a row highlight.
 * This is the view Interactive opens in.
 */
export const GridDragAndDrop: Story = {
  name: 'Demo: Drag a tile onto a folder',
  args: { draggable: true, onMove: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const container = await canvas.findByTestId(FS_DRAG_CONTAINER_TEST_ID.icons);
    // A tile's accessible name is just the entry name, so the button role is the
    // whole query — and the tile's own box is the zone's rect.
    // findAllByRole: HoldItem double-renders draggable rows — pick first.
    const tiles = await canvas.findAllByRole('button', { name: 'Roadmap.pptx' });
    const tile = tiles[0];
    if (!tile) throw new Error('no Roadmap.pptx tile rendered');
    const folderTiles = await canvas.findAllByRole('button', { name: 'Documents' });
    const folderTile = folderTiles[0];
    if (!folderTile) throw new Error('no Documents tile rendered');
    const target = centerOf(folderTile);

    // Hover the grid first, so the highlight is up and there is something to see
    // suppressed: the resolvers return null for the length of a drag, because the
    // folder's own zone is what marks the pending drop now.
    const highlight = await canvas.findByTestId(FS_HOVER_TEST_ID.icons);
    const hovered = centerOf(tile);
    pointer(container, 'pointermove', hovered);
    await waitFor(() => expect(opacityOf(highlight)).toBe(1));

    const transfer = newDragTransfer();
    await liftDrag(tile, transfer, hovered);
    fireDrag(tile, 'drag', transfer, target);
    fireDrag(folderTile, 'dragover', transfer, target);

    // Hold the drag over the folder and read the mark. A pending drop is the
    // folder's *name* filling in — the same fill selection uses, so the tile about
    // to receive the drop reads as its label lighting up.
    // findAllByTestId: HoldItem double-renders draggable tiles — pick first.
    const dropTargets = await canvas.findAllByTestId(FS_TILE_DROP_TARGET_TEST_ID);
    const dropTarget = dropTargets[0];
    if (!dropTarget) throw new Error('no drop target rendered');
    await expect(dropTarget).toHaveTextContent('Documents');
    const tileBox = folderTile.getBoundingClientRect();
    const targetBox = dropTarget.getBoundingClientRect();
    await expect(targetBox.top).toBeGreaterThanOrEqual(tileBox.top);
    await expect(targetBox.bottom).toBeLessThanOrEqual(tileBox.bottom + 1);
    await expect(targetBox.width).toBeLessThanOrEqual(tileBox.width + 1);
    // And the pointer-driven highlight has stood down for the drag, so the two
    // cannot mark different cells at once.
    await waitFor(() => expect(opacityOf(highlight)).toBe(0));

    fireDrag(tile, 'dragend', transfer, target);
    await waitFor(() => expect(args.onMove).toHaveBeenCalledWith({ destination: 'Documents/', sources: ['Roadmap.pptx'] }));

    // The drag is over, so the highlight comes back on the next move — the
    // suppression is tied to the drag, not a one-way door. Onto a tile, not just
    // anywhere in the grid: hover is the stricter of the two questions and refuses
    // the padding and the gaps, where a drop would still clamp to a neighbour.
    pointer(container, 'pointermove', centerOf(folderTile));
    await waitFor(() => expect(opacityOf(highlight)).toBe(1));
  },
};

/** A folder cannot land inside itself or its own subtree, so no drop is reported. */
export const DragIntoOwnSubtree: Story = {
  name: 'Demo: Rejected drop',
  args: { defaultView: 'list', draggable: true, onMove: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Expand `Documents/` so its own child folder is a row beneath it.
    const expandDocsLabels = await canvas.findAllByLabelText('Expand Documents');
    const expandDocs = expandDocsLabels[0];
    if (!expandDocs) throw new Error('no Expand Documents button rendered');
    await userEvent.click(expandDocs);
    const row = await listRow(canvas, 'Documents');
    const child = await listRow(canvas, 'Reports');
    const sibling = await listRow(canvas, 'Photos');

    // The children the expand revealed animate open (height 0 → full) with a
    // fast-start ease, so the rows below them — `Photos/` included — shift the
    // most in the first ~100ms, and keep creeping for the full 280ms. A drop
    // point sampled while that runs is stale by the time the release is
    // hit-tested against the zone's measured box. Wait until the entering row has
    // grown to full height — the deterministic stand-in for a fixed settle count,
    // which races under load.
    await waitFor(() => {
      const container = child.closest('.overflow-hidden');
      expect(container?.getBoundingClientRect().height ?? 0).toBeGreaterThanOrEqual(FS_ROW_HEIGHT - 0.5);
    });

    // `Documents/Reports/` is inside `Documents/`: a valid-looking folder row that
    // would make the path circular. Its zone refuses the drag outright, so the
    // release falls through to the background zone — the open folder, which is
    // where `Documents/` already sits, so that is not a move either.
    const transfer = newDragTransfer();
    const ontoChild = centerOf(child);
    await dragOnto({ source: row, target: child, to: ontoChild, transfer });
    fireDrag(row, 'dragend', transfer, ontoChild);
    await expect(args.onMove).not.toHaveBeenCalled();

    // The same folder, the same gesture, a destination outside its subtree: this
    // one reports. Without it the assertion above would also pass on a drag that
    // never armed at all.
    const second = newDragTransfer();
    const ontoSibling = centerOf(sibling);
    await dragOnto({ source: row, target: sibling, to: ontoSibling, transfer: second });
    fireDrag(row, 'dragend', second, ontoSibling);
    await waitFor(() => expect(args.onMove).toHaveBeenCalledWith({ destination: 'Photos/', sources: ['Documents/'] }));
  },
};

/**
 * A drag lifted from a selected entry carries the whole selection: `onMove`
 * reports every path at once rather than firing once per entry. Members the drop
 * would not move — the destination itself, entries already inside it, a folder
 * dropped into its own subtree — are filtered out first, and nothing fires when
 * that leaves the list empty.
 *
 * Lifting an *unselected* entry is still a single-entry drag; the selection
 * elsewhere in the folder does not ride along.
 */
export const MultiSelectDrag: Story = {
  name: 'Demo: Drag a multi-selection',
  args: { defaultView: 'list', draggable: true, selectionMode: 'multiple', onMove: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await listRow(canvas, 'README.md'));
    modifierClick(await listRow(canvas, 'Roadmap.pptx'), 'ctrlKey');
    await canvas.findByText('· 2 selected');

    const row = await listRow(canvas, 'README.md');
    const folder = await listRow(canvas, 'Photos');
    const transfer = newDragTransfer();
    await dragOnto({ source: row, target: folder, to: centerOf(folder), transfer });
    fireDrag(row, 'dragend', transfer, centerOf(folder));

    await waitFor(() =>
      expect(args.onMove).toHaveBeenCalledWith({
        destination: 'Photos/',
        sources: expect.arrayContaining(['README.md', 'Roadmap.pptx']),
      }),
    );

    // Lifting an entry outside the selection is a single-entry drag: the two rows
    // still selected do not ride along.
    const outside = await listRow(canvas, 'Budget-2026.xlsx');
    const second = newDragTransfer();
    await dragOnto({ source: outside, target: folder, to: centerOf(folder), transfer: second });
    fireDrag(outside, 'dragend', second, centerOf(folder));
    await waitFor(() => expect(args.onMove).toHaveBeenLastCalledWith({ destination: 'Photos/', sources: ['Budget-2026.xlsx'] }));
  },
};

/**
 * A drag that ends before anything claimed it must not commit a move.
 *
 * Lifting a file from inside an expanded subfolder and ending the drag in the same
 * tick reproduces a browser-cancelled drag: no `dragover` ever runs, so `dragend`
 * reports `dropEffect: 'none'`. The always-accepting body zone sits under the
 * pointer, so a cancelled lift used to resolve against it and report a move to the
 * root — an entry that was never released anywhere moving on its own.
 */
export const CancelledDragFromSubfolder: Story = {
  name: 'Demo: A cancelled drag from a subfolder stays put',
  args: { defaultView: 'list', draggable: true, onMove: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Expand Documents so its child file is a row beneath it.
    const expandDocs = (await canvas.findAllByLabelText('Expand Documents'))[0];
    if (!expandDocs) throw new Error('no Expand Documents button rendered');
    await userEvent.click(expandDocs);
    const row = await listRow(canvas, 'Contract.docx');

    // Lift and end in the same tick: the browser never claims the drag, so the
    // dropEffect at `dragend` is 'none'.
    const transfer = newDragTransfer();
    fireDrag(row, 'dragstart', transfer, centerOf(row));
    fireDrag(row, 'dragend', transfer, centerOf(row));

    await expect(args.onMove).not.toHaveBeenCalled();
  },
};

/**
 * A file dragged out of a deep subfolder and back onto its own folder stays put.
 *
 * The expanded folder's overlay dropzone has to register the drag — even though
 * the file already lives there — so the ancestor folder's larger overlay, which
 * would otherwise "show through" and move the file up a level, never gets the
 * release. `portal` makes the overlay accept every in-library file-system drag;
 * the drop handler still filters via `movableFileSystemSources`, so a release
 * that changes nothing is a silent no-op.
 */
export const DropIntoOwnFolder: Story = {
  name: 'Demo: A deep file drops into its own folder as a no-op',
  args: { defaultView: 'list', draggable: true, onMove: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Expand Documents/ and Reports/ so Q1-report.pdf is a row two levels down.
    const expandDocs = (await canvas.findAllByLabelText('Expand Documents'))[0];
    if (!expandDocs) throw new Error('no Expand Documents button rendered');
    await userEvent.click(expandDocs);
    const expandReports = (await canvas.findAllByLabelText('Expand Reports'))[0];
    if (!expandReports) throw new Error('no Expand Reports button rendered');
    await userEvent.click(expandReports);

    const file = await listRow(canvas, 'Q1-report.pdf');
    const ownFolder = await listRow(canvas, 'Reports');
    const ancestor = await listRow(canvas, 'Documents');

    // Lift, then drive the pointer to the release point and wait for the store to
    // name *this* folder the drop target. The overlays mount one tick *after* the
    // drag starts (`dragActive` is deferred so mounting over the source row doesn't
    // tear the browser's drag down) and measure a tick after that. Both the
    // Documents and Reports overlays are portal zones, so the shared outline can
    // flash the ancestor first while the descendant is still measuring; the
    // "Move into <folder>" hint names the over zone's destination, so waiting on its
    // label pins the drop to the right overlay — and the hint only appears once that
    // zone has measured and won the hit test.
    const dropOn = async (target: Element, label: string) => {
      const transfer = newDragTransfer();
      const to = centerOf(target);
      await liftDrag(file, transfer, centerOf(file));
      fireDrag(file, 'drag', transfer, to);
      await waitFor(() => expect(canvas.queryByTestId(FS_DROP_HINT_TEST_ID)).toHaveTextContent(`Move into ${label}`));
      fireDrag(target, 'dragenter', transfer, to);
      fireDrag(target, 'dragover', transfer, to);
      fireDrag(target, 'drop', transfer, to);
      fireDrag(file, 'dragend', transfer, to);
    };

    // Onto its own folder: the Reports/ overlay wins the tie-break over the larger
    // Documents/ overlay, but nothing can move into the folder it already lives in.
    await dropOn(ownFolder, 'Reports');
    await expect(args.onMove).not.toHaveBeenCalled();

    // The same file onto its ancestor still moves, proving the lift above really
    // carried a movable entry and the no-op was the folder's own, not a dead drag.
    await dropOn(ancestor, 'Documents');
    await waitFor(() =>
      expect(args.onMove).toHaveBeenCalledWith({
        destination: 'Documents/',
        sources: ['Documents/Reports/Q1-report.pdf'],
      }),
    );
  },
};

/**
 * The selection box: press on empty space in the grid and drag, and everything
 * the band touches is selected live as it is drawn. Web only — a finger dragged
 * across a grid scrolls it, and there is no modifier on a touchscreen to say
 * otherwise — and only under `selectionMode="multiple"`.
 *
 * It never fights the drag, because the two are cut from one hit test: a press
 * lands on a tile, where a drag lifts, or it does not, where the band starts.
 * That same strictness is why a press in the gutter *between* two tiles now
 * starts a band rather than lifting whichever tile was nearest.
 *
 * Hold Ctrl/Cmd as you start the band to add to the selection instead of
 * replacing it.
 */
/**
 * The selection-box demo's own small manifest. The sweep starts in the empty
 * space below the tiles and rises to the first row, so it needs a grid short
 * enough to leave that space — `SAMPLE_ITEMS`' sixteen files fill the grid and
 * would drag the band over more than the two pinned tiles.
 */
const SELECTION_BOX_ITEMS: FileSystemItem[] = [
  { hasChildren: true, kind: 'folder', path: 'Archive/', updatedAt: DATES.january },
  { createdAt: DATES.june, kind: 'file', path: 'README.md', pinnedAt: DATES.june, size: 2480, updatedAt: DATES.june },
  { createdAt: DATES.april, kind: 'file', path: 'Roadmap.pptx', pinnedAt: DATES.april, size: 1_204_000, updatedAt: DATES.may },
  { createdAt: DATES.march, kind: 'file', path: 'Budget-2026.xlsx', size: 96_400, updatedAt: DATES.june },
];

export const SelectionBox: Story = {
  name: 'Demo: Drag a selection box',
  args: { items: SELECTION_BOX_ITEMS, selectionMode: 'multiple', draggable: true, onMove: fn(), onSelectedItemsChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const container = await canvas.findByTestId(FS_DRAG_CONTAINER_TEST_ID.icons);
    // findAllByText: HoldItem double-renders draggable rows — pick first.
    expect((await canvas.findAllByText('Archive'))[0]).toBeDefined();

    // Pinned items sort first, so the first two tiles are README.md and Roadmap.pptx.
    // Start below them — empty space, where no tile can lift — and sweep up.
    const bounds = container.getBoundingClientRect();
    const readmeEls = await canvas.findAllByRole('button', { name: 'README.md' });
    const roadmapEls = await canvas.findAllByRole('button', { name: 'Roadmap.pptx' });
    const readme = readmeEls[0];
    const roadmap = roadmapEls[0];
    if (!readme) throw new Error('README.md tile not rendered');
    if (!roadmap) throw new Error('Roadmap.pptx tile not rendered');
    const first = centreOf(readme);
    const second = centreOf(roadmap);
    const origin = { x: bounds.left + 4, y: bounds.top + bounds.height - 4 };

    pointer(container, 'pointerdown', origin);
    sweep(container, origin, second);

    // The band is up and painting while the pointer is still down.
    expect(await canvas.findByTestId(FS_MARQUEE_TEST_ID)).toBeInTheDocument();
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['README.md', 'Roadmap.pptx']));

    pointer(container, 'pointerup', second);
    // The click the browser sends after the release is swallowed: without that,
    // the container's background press would clear the band on the frame it ended.
    mouse(container, 'click');
    await canvas.findByText('· 2 selected');
    await waitFor(() =>
      expect(args.onSelectedItemsChange).toHaveBeenLastCalledWith([
        expect.objectContaining({ name: 'README.md' }),
        expect.objectContaining({ name: 'Roadmap.pptx' }),
      ]),
    );

    // A band is not a drag: nothing was moved by drawing one over the tiles.
    expect(args.onMove).not.toHaveBeenCalled();

    // A shorter sweep takes fewer tiles, so the band tracks the pointer rather
    // than latching onto whatever it first touched.
    pointer(container, 'pointerdown', origin);
    sweep(container, origin, first);
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['README.md']));
    pointer(container, 'pointerup', first);
    mouse(container, 'click');

    // And an ordinary click on the background still clears — the gate only ever
    // swallows the click that follows a band that actually drew.
    mouse(container, 'click');
    await waitFor(() => expect(canvas.queryByText(SELECTION_CLAUSE_PATTERN)).toBeNull());
  },
};

/**
 * Multi-selection visual state in the columns view.
 *
 * After Ctrl-clicking two entries, both must carry `aria-selected="true"` so
 * assistive tech and CSS can mark the multi-selection.
 */
export const ColumnsMultiSelect: Story = {
  name: 'Demo: Multi-select in columns view',
  args: { defaultView: 'columns', selectionMode: 'multiple', onSelectedItemsChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('README.md');

    // Plain click to select the first entry.
    await userEvent.click(await canvas.findByRole('button', { name: 'README.md' }));
    await waitFor(() => expect(args.onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'README.md' })));

    // Ctrl-click a second entry — both should show as selected via callbacks.
    modifierClick(await canvas.findByRole('button', { name: 'Roadmap.pptx' }), 'ctrlKey');
    await waitFor(() =>
      expect(args.onSelectedItemsChange).toHaveBeenLastCalledWith([
        expect.objectContaining({ name: 'README.md' }),
        expect.objectContaining({ name: 'Roadmap.pptx' }),
      ]),
    );

    // The critical assertion: both entries visibly carry aria-selected.
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['README.md', 'Roadmap.pptx']));
  },
};

/**
 * Multi-selection visual state in the gallery view.
 *
 * Same check as ColumnsMultiSelect but for the gallery (filmstrip + stage).
 */
export const GalleryMultiSelect: Story = {
  name: 'Demo: Multi-select in gallery view',
  args: { defaultView: 'gallery', selectionMode: 'multiple', onSelectedItemsChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('README.md');

    // Plain click to select the first entry.
    await userEvent.click(await canvas.findByRole('button', { name: 'README.md' }));
    await waitFor(() => expect(args.onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'README.md' })));

    // Ctrl-click the next tile — both should show as selected via callbacks.
    modifierClick(await canvas.findByRole('button', { name: 'Roadmap.pptx' }), 'ctrlKey');
    await waitFor(() =>
      expect(args.onSelectedItemsChange).toHaveBeenLastCalledWith([
        expect.objectContaining({ name: 'README.md' }),
        expect.objectContaining({ name: 'Roadmap.pptx' }),
      ]),
    );

    // The critical assertion: both tiles visibly carry aria-selected.
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['README.md', 'Roadmap.pptx']));
  },
};
