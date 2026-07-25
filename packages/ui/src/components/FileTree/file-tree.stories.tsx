// biome-ignore-all lint/style/noExcessiveLinesPerFile: stories + interaction tests for a path-first tree kept together for easy editing
/** biome-ignore-all lint/style/useExportsLast: this a stories file */

import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { FileTree } from './file-tree';
import type { FileTreeGitStatusMap } from './file-tree.types';

// ─── Shared data ───────────────────────────────────────────────────────────────
// A small, deterministic tree. Top-level directories (`docs/`, `src/`) sort
// before the root files, and every directory holds more than one child so
// flatten-empty-directories never collapses a chain unexpectedly — the visible
// row order stays predictable for the interaction tests below.

const SAMPLE_PATHS = [
  'src/app/index.tsx',
  'src/app/router.tsx',
  'src/app/screens/home.tsx',
  'src/app/screens/profile.tsx',
  'src/components/button.tsx',
  'src/components/card.tsx',
  'src/hooks/use-theme.ts',
  'src/hooks/use-store.ts',
  'src/lib/format.ts',
  'src/lib/parse.ts',
  'src/index.ts',
  'docs/guide.md',
  'docs/api.md',
  'package.json',
  'README.md',
  'tsconfig.json',
];

// Per-path git status. `null` marks an ignored path (dimmed, no lane letter);
// directory rollups (e.g. `src/` shows the strongest descendant status) are
// derived by the controller.
const SAMPLE_GIT_STATUS: FileTreeGitStatusMap = {
  'src/app/index.tsx': 'M',
  'src/app/router.tsx': 'A',
  'src/components/button.tsx': 'M',
  'src/hooks/use-store.ts': 'D',
  'src/lib/format.ts': null,
  'README.md': 'M',
};

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Components/FileTree',
  component: FileTree,
  decorators: [
    (Story) => (
      <View style={{ width: 400 }}>
        <Story />
      </View>
    ),
  ],
  args: {
    paths: SAMPLE_PATHS,
    height: 360,
    onSelectionChange: fn(),
    onExpandedChange: fn(),
    onActivate: fn(),
    onMove: fn(),
    onRename: fn(),
  },
} satisfies Meta<typeof FileTree>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Interactive ───────────────────────────────────────────────────────────────
// The full playground: multi-select, built-in search, drag-to-move, inline
// rename and git lanes all on. Drive it yourself — tap to select/open, right-click
// (web) for secondary activation, and hold a row then drag it onto a folder to
// move it. With `draggable` on, the hold belongs to the drag, not to multi-select.

/** Every feature on — the hands-on playground. */
export const Interactive: Story = {
  args: {
    selectionMode: 'multiple',
    showSearch: true,
    draggable: true,
    renamable: true,
    gitStatus: SAMPLE_GIT_STATUS,
    initialExpansion: 1,
    testID: 'file-tree-interactive',
  },
};

// ─── Expand / collapse ───────────────────────────────────────────────────────

export const ExpandCollapse: Story = {
  name: 'Demo: Expand a folder',
  args: { testID: 'file-tree-expand' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Closed by default: only the top-level rows are present.
    const srcRow = await canvas.findByText('src');
    expect(canvas.queryByText('components')).toBeNull();

    // Tapping a directory row toggles its expansion; children appear.
    await userEvent.click(srcRow);
    await canvas.findByText('components');
    await canvas.findByText('hooks');

    // Tapping again collapses it back.
    await userEvent.click(await canvas.findByText('src'));
    await waitFor(() => expect(canvas.queryByText('components')).toBeNull());
  },
};

// ─── Selection ─────────────────────────────────────────────────────────────────

export const Selection: Story = {
  name: 'Demo: Select a file',
  args: { testID: 'file-tree-select' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Files with an extension render their leaf as head + pinned `.ext`, so we
    // target a directory row (single text node) to keep the query unambiguous.
    await userEvent.click(await canvas.findByText('docs'));

    // A plain tap replaces the selection with the tapped row.
    await waitFor(() => expect(args.onSelectionChange).toHaveBeenCalledWith(['docs/']));
  },
};

// ─── Search ─────────────────────────────────────────────────────────────────────

export const Search: Story = {
  name: 'Demo: Search files',
  args: {
    showSearch: true,
    searchMode: 'hide-non-matches',
    testID: 'file-tree-search',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const input = await canvas.findByTestId('file-tree-search-search');
    await userEvent.type(input, 'hooks');

    // hide-non-matches keeps the match + its ancestors, drops everything else.
    await canvas.findByText('hooks');
    await waitFor(() => expect(canvas.queryByText('docs')).toBeNull());
  },
};

// ─── Git status ─────────────────────────────────────────────────────────────────
// Per-path status drives the trailing lane letter (A/M/R/D/U). Directories roll
// up their descendants' status, and `null` marks an ignored (dimmed) path.

export const GitStatus: Story = {
  name: 'Demo: Git status lanes',
  args: {
    gitStatus: SAMPLE_GIT_STATUS,
    initialExpansion: 'open',
    testID: 'file-tree-git',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The lane letter is exposed to a11y by its status name.
    const modified = await canvas.findAllByLabelText('Modified');
    expect(modified.length).toBeGreaterThan(0);
  },
};

// ─── Multi-select ────────────────────────────────────────────────────────────

/** Multiple selection with two rows pre-selected via `defaultSelectedPaths`. */
export const MultiSelect: Story = {
  args: {
    selectionMode: 'multiple',
    defaultSelectedPaths: ['package.json', 'README.md'],
    testID: 'file-tree-multi',
  },
};

// ─── Draggable ─────────────────────────────────────────────────────────────────
// Long-press a row and drag it onto a folder to move it (with all descendants).
// The move is committed to the model and echoed through `onMove`.
//
// The play test drives the drag with real PointerEvents rather than `userEvent`:
// the web transport takes pointer capture, and capture only works for a pointer
// the browser considers active, so the ids and coordinates have to line up. Each
// step below is one event the browser itself would send.

type ClientPoint = { x: number; y: number };

/** The rendered row carrying `path`. */
function rowFor(canvasElement: HTMLElement, path: string): Element {
  const row = canvasElement.querySelector(`[data-fttree-path="${path}"]`);
  if (!row) throw new Error(`no row rendered for ${path}`);
  return row;
}

/** Centre point of the row carrying `path`, in client coordinates. */
function rowCentre(canvasElement: HTMLElement, path: string): ClientPoint {
  const rect = rowFor(canvasElement, path).getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

const DRAG_POINTER_ID = 7;
/** Long-press threshold plus a margin, so the drag is armed before the first move. */
const DRAG_ARMED_MS = 450;

/** Dispatch one pointer event of `type` at a client point, as the browser would. */
function pointer(node: Element, type: string, point: ClientPoint) {
  node.dispatchEvent(
    new PointerEvent(type, {
      pointerId: DRAG_POINTER_ID,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: point.x,
      clientY: point.y,
      bubbles: true,
      cancelable: true,
    }),
  );
}

/** Long-press drag-to-move + inline rename enabled. */
export const Draggable: Story = {
  name: 'Demo: Drag a folder onto another',
  args: {
    draggable: true,
    renamable: true,
    initialExpansion: 'open',
    gitStatus: SAMPLE_GIT_STATUS,
    testID: 'file-tree-drag',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('hooks');

    // The transport listens on the scroll container, which is also the frame the
    // drop highlight is positioned in — the same node a real press bubbles to.
    const list = await canvas.findByTestId('file-tree-drag-list');
    const container = list.parentElement;
    if (!container) throw new Error('scroll container not found');

    const source = rowCentre(canvasElement, 'src/app/screens/');
    const target = rowCentre(canvasElement, 'src/components/');

    // Press on the row, then hold past the long-press threshold to arm the drag.
    pointer(rowFor(canvasElement, 'src/app/screens/'), 'pointerdown', source);
    await new Promise((resolve) => setTimeout(resolve, DRAG_ARMED_MS));

    // Drag down onto `src/components/`, in steps, as a pointer stream would arrive.
    // The old RNGH transport died on the first of these moves, when the row that
    // owned the gesture re-rendered under it.
    const steps = 6;
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      pointer(container, 'pointermove', {
        x: source.x + (target.x - source.x) * ratio,
        y: source.y + (target.y - source.y) * ratio,
      });
    }
    pointer(container, 'pointerup', target);

    // `screens/` and both its files land under `components/`.
    await waitFor(() =>
      expect(args.onMove).toHaveBeenCalledWith(
        expect.objectContaining({
          sources: ['src/app/screens/'],
          destination: 'src/components/',
          remap: expect.objectContaining({
            'src/app/screens/': 'src/components/screens/',
            'src/app/screens/home.tsx': 'src/components/screens/home.tsx',
            'src/app/screens/profile.tsx': 'src/components/screens/profile.tsx',
          }),
        }),
      ),
    );
  },
};

// ─── Density ─────────────────────────────────────────────────────────────────

/** Compact rows for dense file panels. */
export const Compact: Story = {
  args: { density: 'compact', initialExpansion: 'open', testID: 'file-tree-compact' },
};

/** Relaxed rows for touch-first layouts. */
export const Relaxed: Story = {
  args: { density: 'relaxed', testID: 'file-tree-relaxed' },
};

// ─── Empty ─────────────────────────────────────────────────────────────────────

export const Empty: Story = {
  name: 'Demo: Empty state',
  args: { paths: [], emptyState: 'No files yet', testID: 'file-tree-empty' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('No files yet');
  },
};
