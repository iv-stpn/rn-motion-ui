import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { DATES } from './__stories__/file-system-story-data';
import { FILE_SYSTEM_ARGS, FILE_SYSTEM_DECORATORS } from './__stories__/file-system-story-meta';
import {
  findScroller,
  ITEM_COUNT_PATTERN,
  listRow,
  modifierClick,
  openTile,
  SELECTION_CLAUSE_PATTERN,
  selectedPaths,
} from './__stories__/file-system-story-testing';
import { FileSystem } from './file-system';
import type { FileSystemItem } from './types/file-system.types';

const meta = {
  title: 'File System/FileSystem',
  component: FileSystem,
  parameters: { layout: 'centered' },
  decorators: FILE_SYSTEM_DECORATORS,
  args: FILE_SYSTEM_ARGS,
} satisfies Meta<typeof FileSystem>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Selection ─────────────────────────────────────────────────────────────────

/**
 * `selectionMode="multiple"` adds the gestures a file browser is expected to
 * have on the web views: Ctrl-click (Cmd-click on macOS) toggles the entry under
 * the pointer in or out of the selection, and Shift-click runs a range. A plain
 * press still replaces the selection, and a press on the background still clears
 * it.
 *
 * The selected set arrives through `onSelectedItemsChange`, in the order the
 * entries were picked. `onSelectionChange` keeps its single-entry shape and
 * follows the *lead* — the one added most recently — which is what the columns
 * trail, the gallery stage and the preview pane keep showing.
 *
 * The touch long-press is the *mobile* views' way into multi-select; on these
 * web views a long-press opens the entry's context menu instead.
 */
export const MultiSelect: Story = {
  name: 'Demo: Select several entries',
  args: { selectionMode: 'multiple', onSelectedItemsChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const footer = await canvas.findByText(ITEM_COUNT_PATTERN);

    // A plain press is still a plain selection.
    await userEvent.click(await canvas.findByRole('button', { name: 'Documents' }));
    await canvas.findByText('· “Documents” selected');

    // Ctrl held, the second press adds instead of replacing.
    modifierClick(await canvas.findByRole('button', { name: 'Photos' }), 'ctrlKey');
    await canvas.findByText('· 2 selected');
    await waitFor(() =>
      expect(args.onSelectedItemsChange).toHaveBeenLastCalledWith([
        expect.objectContaining({ name: 'Documents' }),
        expect.objectContaining({ name: 'Photos' }),
      ]),
    );
    // Both entries must carry aria-selected for assistive tech and visual highlighting.
    await waitFor(() => expect(selectedPaths(canvas)).toEqual(['Documents/', 'Photos/']));
    // The lead follows the entry added last, so single-selection consumers still
    // get something coherent out of a multi-selection.
    expect(args.onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Photos' }));

    // Cmd is the same modifier on macOS, where Ctrl-click is a right-click.
    modifierClick(await canvas.findByRole('button', { name: 'Budget-2026.xlsx' }), 'metaKey');
    await canvas.findByText('· 3 selected');

    // Ctrl/Cmd-click is the removal toggle.
    modifierClick(await canvas.findByRole('button', { name: 'Documents' }), 'ctrlKey');
    await canvas.findByText('· 2 selected');

    // Clear is the way out where there is no background left to tap.
    await userEvent.click(await canvas.findByLabelText('Clear selection'));
    await waitFor(() => expect(args.onSelectedItemsChange).toHaveBeenLastCalledWith([]));
    expect(footer).toBeInTheDocument();
    await waitFor(() => expect(canvas.queryByText(SELECTION_CLAUSE_PATTERN)).toBeNull());
  },
};

/**
 * Shift-click takes the contiguous run from the *anchor* — the last entry picked
 * without Shift — to the entry pressed, in the order the surface you pressed
 * lays its entries out. The anchor deliberately stays put, so shift-clicking
 * around grows and shrinks one run from a fixed origin rather than accumulating.
 *
 * Hold Ctrl/Cmd as well and the run is added to what is already selected, which
 * is how a selection made of several separate runs gets built.
 *
 * The ordering comes from the view, not the store: the list view runs through
 * its rows as drawn (an expanded folder's children included, since they sit
 * between their parent and its next sibling), while the columns view keeps each
 * pane to itself.
 */
export const ShiftRange: Story = {
  name: 'Demo: Select a range',
  args: { defaultView: 'list', selectionMode: 'multiple', onSelectedItemsChange: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('README.md');

    // Pinned items sort first (README.md, Roadmap.pptx), then the rest by name:
    // README.md, Roadmap.pptx, Archive/, Budget-2026.xlsx, Documents/, Invoice-0042.pdf, Photos/.
    // The plain press on an unpinned entry sets the anchor the run will measure from.
    await userEvent.click(await listRow(canvas, 'Budget-2026.xlsx'));
    await canvas.findByText('· “Budget-2026.xlsx” selected');

    modifierClick(await listRow(canvas, 'Photos'), 'shiftKey');
    await canvas.findByText('· 4 selected');
    expect(selectedPaths(canvas)).toEqual(['Budget-2026.xlsx', 'Documents/', 'Invoice-0042.pdf', 'Photos/']);

    // The anchor held, so a second Shift-click re-measures rather than extends.
    modifierClick(await listRow(canvas, 'Documents'), 'shiftKey');
    await canvas.findByText('· 2 selected');
    expect(selectedPaths(canvas)).toEqual(['Budget-2026.xlsx', 'Documents/']);

    // Ctrl moves the anchor and keeps what is there; Shift then runs from it,
    // replacing — so the two rows added by Ctrl-then-Shift are all that is left.
    modifierClick(await listRow(canvas, 'Roadmap.pptx'), 'ctrlKey');
    await canvas.findByText('· 3 selected');
    modifierClick(await listRow(canvas, 'README.md'), 'shiftKey');
    await canvas.findByText('· 2 selected');
    expect(selectedPaths(canvas)).toEqual(['README.md', 'Roadmap.pptx']);

    // Shift with Ctrl adds a second run instead of replacing the first.
    modifierClick(await listRow(canvas, 'Archive'), 'ctrlKey');
    modifierClick(await listRow(canvas, 'Documents'), 'ctrlKey', 'shiftKey');
    await canvas.findByText('· 5 selected');
    expect(selectedPaths(canvas)).toEqual(['README.md', 'Roadmap.pptx', 'Archive/', 'Budget-2026.xlsx', 'Documents/']);
  },
};

// ─── Lazy children ─────────────────────────────────────────────────────────────

export const LazyChildren: Story = {
  name: 'Demo: Load a folder on demand',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // `Archive/` ships with `hasChildren` and no entries, so opening it is what
    // triggers `loadChildren` — cursor-paged, drained before the rows appear.
    await openTile(canvas, 'Archive');
    await waitFor(() => expect(args.loadChildren).toHaveBeenCalledWith({ cursor: null, path: 'Archive/' }));

    await canvas.findAllByText('legacy.zip');
    await canvas.findAllByText('2024');

    // Loaded children are kept, so a second visit costs nothing.
    await userEvent.click(await canvas.findByLabelText('Back'));
    await openTile(canvas, 'Archive');
    await canvas.findAllByText('legacy.zip');
    expect(args.loadChildren).toHaveBeenCalledTimes(1);
  },
};

/**
 * The list view's disclosure caret opens a folder in place instead of navigating,
 * so it is the caret — not a press on the row — that has to request a lazy
 * folder's children. Clicking it must load the same way selecting (navigating
 * into) the folder would.
 */
export const LazyChildrenList: Story = {
  name: 'Demo: Expand a lazy folder in the list',
  args: { defaultView: 'list' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const expand = (await canvas.findAllByLabelText('Expand Archive'))[0];
    if (!expand) throw new Error('no Expand Archive caret rendered');
    await userEvent.click(expand);

    await waitFor(() => expect(args.loadChildren).toHaveBeenCalledWith({ cursor: null, path: 'Archive/' }));
    await listRow(canvas, 'legacy.zip');

    // Expanding didn't navigate: the root is still open around the folder.
    await listRow(canvas, 'README.md');
    expect(args.loadChildren).toHaveBeenCalledTimes(1);
  },
};

// ─── Scroll position ─────────────────────────────────────────────────────────

/**
 * A manifest tall enough to scroll the list view: 80 rows × 30 px ≈ 2400 px of
 * content against the 460 px story viewport.
 */
const SCROLL_ITEMS: FileSystemItem[] = Array.from({ length: 80 }, (_, index) => ({
  createdAt: DATES.june,
  kind: 'file',
  path: `File-${String(index + 1).padStart(3, '0')}.md`,
  size: 1000 + index,
  updatedAt: DATES.june,
}));

/**
 * The scroll-offset contract: `initialScrollOffset` restores an exact position
 * once the view has content, and `onScrollOffsetChange` reports the live
 * offset so a consumer can keep an external position record (URL, per-tab
 * state) in lockstep.
 */
export const ScrollPosition: Story = {
  name: 'Demo: Scroll position restore and report',
  args: {
    defaultView: 'list',
    initialScrollOffset: 600,
    items: SCROLL_ITEMS,
    onScrollOffsetChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // The HoldMenu portal renders an always-mounted aria-hidden twin of every
    // row, so the file name matches twice (see the rn-motion-ui maintenance
    // skill's HoldMenu note) — `.first()` picks the functional copy.
    await canvas.findAllByText('File-001.md');

    // The pending initial scroll lands once content exists — the container is
    // empty on first mount, so the retry is what actually moves it.
    const scroller = findScroller(canvasElement);
    if (!scroller) throw new Error('no scroll container rendered');
    await waitFor(() => expect(scroller?.scrollTop ?? 0).toBeGreaterThan(0));
    expect(Math.abs((scroller?.scrollTop ?? 0) - (args.initialScrollOffset ?? 0))).toBeLessThan(50);

    // The restore itself reports (the scrollTo fires onScroll), then a real
    // user scroll keeps the callback in lockstep. NOTE: rn-web monkey-patches
    // the scroll node's `scrollTo` to the RN API (`{y, animated}`), so a DOM
    // `scrollTo({top})` scrolls to the top — assign `scrollTop` directly.
    await waitFor(() => expect(args.onScrollOffsetChange).toHaveBeenCalledWith(expect.any(Number)));
    scroller.scrollTop = 200;
    await waitFor(() => expect(args.onScrollOffsetChange).toHaveBeenCalledWith(200));
  },
};

/**
 * The scroll position must survive the view's content unmounting and remounting
 * — the hidden-tab-pane case. When a FileSystem sits inside a container that
 * flips `display: none` (an inactive tab pane, a collapsed section), the view
 * measures 0, its tiles unmount, and the browser clamps the scroll container
 * back to the top. The consumer never changes `initialScrollOffset` — the
 * position the user actually had lives only in the view's own report — so the
 * restore must come from the last reported offset once the content is back.
 */
export const ScrollSurvivesHiddenContainer: Story = {
  name: 'Demo: Scroll survives a hidden-then-shown container',
  args: {
    defaultView: 'mobile-grid',
    items: SCROLL_ITEMS,
    onScrollOffsetChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('File-001.md');

    const scroller = findScroller(canvasElement);
    if (!scroller) throw new Error('no scroll container rendered');
    // A real user scroll; assign scrollTop directly — rn-web patches scrollTo.
    scroller.scrollTop = 300;
    await waitFor(() => expect(args.onScrollOffsetChange).toHaveBeenCalledWith(300));

    // Flip the view's own container to display:none (a tab switch hiding the
    // pane): the container measures 0, the grid's tiles unmount, and the
    // browser clamps the scroll position back to the top. The clamp fires a
    // scroll event reporting 0 — it must NOT reach the consumer (that would
    // wipe the last real position), so the callback keeps 300 as its last call.
    const container = scroller.parentElement;
    if (!container) throw new Error('no scroll container parent');
    const previousDisplay = container.style.display;
    container.style.display = 'none';
    await waitFor(() => expect(scroller.scrollTop).toBe(0));
    expect(args.onScrollOffsetChange).not.toHaveBeenCalledWith(0);

    // Back to visible: the content remounts and the view re-applies the last
    // reported offset on its own — no consumer change involved.
    container.style.display = previousDisplay;
    await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(200));
    expect(Math.abs(scroller.scrollTop - 300)).toBeLessThan(50);
  },
};
