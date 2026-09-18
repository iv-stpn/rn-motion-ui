import type { Meta, StoryObj } from '@storybook/react';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { centerOf, dragOnto, fireDrag, newDragTransfer } from '../../../__stories__/story-drag';
import {
  EXTERNAL_DROP_FEATURES,
  FileSystemPlayground,
  NEW_FOLDER_NAME,
  PLAYGROUND_HINT,
} from './__stories__/file-system-playground';
import { FILE_SYSTEM_ARGS, FILE_SYSTEM_DECORATORS } from './__stories__/file-system-story-meta';
import { listRow } from './__stories__/file-system-story-testing';
import { FileSystem } from './file-system';
import { FS_DRAG_CONTAINER_TEST_ID, fileSystemEntryTestID } from './logic/file-system-test-id';

const meta = {
  title: 'File System/FileSystem',
  component: FileSystem,
  parameters: { layout: 'centered' },
  decorators: FILE_SYSTEM_DECORATORS,
  args: FILE_SYSTEM_ARGS,
} satisfies Meta<typeof FileSystem>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Playground ────────────────────────────────────────────────────────────────
// Interactive itself carries no play function — it is a playground, and a test
// would hand it to you already half-mutated. These four run the same component
// instead, so the manifest rewrites behind both features stay covered.

/**
 * The consumer half of a drop. `onMove` only reports; the row moves because the
 * story rewrites its own `items` — subtree included, which is why the entry is
 * found again inside the destination rather than merely gone from the root.
 */
export const PlaygroundDrop: Story = {
  name: 'Demo: Playground — a drop rewrites the list',
  args: { defaultView: 'list' },
  render: (args) => <FileSystemPlayground {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // findAllByText: HoldItem double-renders draggable rows — pick first.
    expect((await canvas.findAllByText('Roadmap.pptx'))[0]).toBeDefined();

    const row = await listRow(canvas, 'Roadmap.pptx');
    const folder = await listRow(canvas, 'Documents');
    const transfer = newDragTransfer();
    await dragOnto({ source: row, target: folder, to: centerOf(folder), transfer });
    fireDrag(row, 'dragend', transfer, centerOf(folder));

    // The status line names the move, and the root no longer lists the entry:
    // it is inside `Documents/`, which is still collapsed.
    await canvas.findByText('Moved Roadmap.pptx to Documents/');
    await waitFor(() => expect(canvas.queryByText('Roadmap.pptx')).toBeNull());

    // Expanding the destination finds it under its new parent.
    const expandDocsLabels2 = await canvas.findAllByLabelText('Expand Documents');
    const expandDocs2 = expandDocsLabels2[0];
    if (!expandDocs2) throw new Error('no Expand Documents button rendered');
    await userEvent.click(expandDocs2);
    // findAllByText: HoldItem double-renders draggable rows — pick first.
    expect((await canvas.findAllByText('Roadmap.pptx'))[0]).toBeDefined();

    // Reset restores the manifest and clears the status line back to the hint.
    await userEvent.click(await canvas.findByText('Reset'));
    await canvas.findByText(PLAYGROUND_HINT);
  },
};

/**
 * Moving a *folder* moves the whole subtree — the folder and its subfolders
 * included, not just the files inside them. The root must not keep an empty
 * `Documents/` husk behind after its contents relocate under `Archive/`.
 */
export const PlaygroundMoveFolder: Story = {
  name: 'Demo: Playground — a folder move leaves nothing behind',
  args: { defaultView: 'list' },
  render: (args) => <FileSystemPlayground {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // findAllByText: HoldItem double-renders draggable rows — pick first.
    expect((await canvas.findAllByText('Documents'))[0]).toBeDefined();

    const source = await listRow(canvas, 'Documents');
    const target = await listRow(canvas, 'Archive');
    const transfer = newDragTransfer();
    await dragOnto({ source, target, to: centerOf(target), transfer });
    fireDrag(source, 'dragend', transfer, centerOf(target));

    // The folder moved away, so it is no longer a root row — it has not lingered
    // as an empty husk where it used to be.
    await canvas.findByText('Moved Documents to Archive/');
    await waitFor(() => expect(canvas.queryByText('Documents')).toBeNull());

    // Expanding the destination finds the folder again under its new parent.
    const expandArchive = (await canvas.findAllByLabelText('Expand Archive'))[0];
    if (!expandArchive) throw new Error('no Expand Archive caret rendered');
    await userEvent.click(expandArchive);
    expect((await canvas.findAllByText('Documents'))[0]).toBeDefined();

    // Reset restores the manifest and clears the status line back to the hint.
    await userEvent.click(await canvas.findByText('Reset'));
    await canvas.findByText(PLAYGROUND_HINT);
  },
};

/**
 * The other end of a drop: something arriving from *outside* the component.
 *
 * `onExternalDrop` is the callback, and it covers two things that look different and
 * are not: an OS file drag, and an element elsewhere on the page that attached a
 * payload of its own — here the tray above the browser, whose chips are plain
 * `<Draggable>`s. Neither carries FileSystem entries, so neither is a move; the
 * component hands the transfer over and the consumer decides what it meant.
 *
 * The destination is the folder the drop landed on, exactly as for a move, so a file
 * dragged in from the desktop lands in the folder under the pointer rather than
 * always at the root.
 */
export const PlaygroundExternalDrop: Story = {
  name: 'Demo: Playground — a payload from outside',
  args: { defaultView: 'list' },
  render: (args) => <FileSystemPlayground {...args} options={EXTERNAL_DROP_FEATURES} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByRole('button', { name: 'Drag invoice.pdf into the file browser' });
    const folder = await listRow(canvas, 'Documents');

    const transfer = newDragTransfer();
    await dragOnto({ source: chip, target: folder, to: centerOf(folder), transfer });
    fireDrag(chip, 'dragend', transfer, centerOf(folder));

    // The chip's payload reached the consumer, and the destination is the row it was
    // dropped on rather than the open folder.
    await canvas.findByText('Added invoice.pdf to Documents/');
    const expandDocsLabels3 = await canvas.findAllByLabelText('Expand Documents');
    const expandDocs3 = expandDocsLabels3[0];
    if (!expandDocs3) throw new Error('no Expand Documents button rendered');
    await userEvent.click(expandDocs3);
    // findAllByTestId, not findByTestId: HoldItem double-renders every row
    // child (functional + offscreen drag-preview ghost inside <Draggable>), and
    // both copies carry the same testID. Pick the first (functional) copy.
    const invoiceTestIds = await canvas.findAllByTestId(fileSystemEntryTestID(undefined, 'Documents/invoice.pdf'));
    expect(invoiceTestIds[0]).toBeDefined();

    // A drop on empty space below the rows takes the folder that is open — the
    // background zone — so the same gesture always lands somewhere nameable.
    await userEvent.click(await canvas.findByText('Reset'));
    const container = await canvas.findByTestId(FS_DRAG_CONTAINER_TEST_ID.list);
    const bounds = container.getBoundingClientRect();
    const empty = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height - 6 };
    const second = newDragTransfer();
    await dragOnto({ source: chip, target: container, to: empty, transfer: second });
    fireDrag(chip, 'dragend', second, empty);
    await canvas.findByText('Added invoice.pdf to Files');
  },
};

/** Open the menu on the entry named `name` and wait for `action` to be pickable. */
async function pickMenuAction(canvas: ReturnType<typeof within>, name: string, action: string): Promise<void> {
  // findAllByRole: HoldItem double-renders draggable rows — pick first.
  const tiles = await canvas.findAllByRole('button', { name });
  const tile = tiles[0];
  await userEvent.pointer({ target: tile, keys: '[MouseRight]' });
  await userEvent.click(await screen.findByRole('menuitem', { name: action }));
}

/**
 * The consumer half of a menu pick: duplicate, delete and new-folder each rewrite
 * the manifest, so every action here changes the grid you are looking at.
 */
export const PlaygroundMenuActions: Story = {
  name: 'Demo: Playground — menu actions rewrite the list',
  render: (args) => <FileSystemPlayground {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // findAllByText/FindAllByRole: HoldItem double-renders draggable rows — pick first.
    expect((await canvas.findAllByText('README.md'))[0]).toBeDefined();

    // A file's menu carries `Share…` disabled. A menuitem is a div, not a form
    // control, so the state it exposes is `aria-disabled` — the dimming alone
    // would leave a screen reader calling the row actionable.
    await userEvent.pointer({ target: (await canvas.findAllByRole('button', { name: 'README.md' }))[0], keys: '[MouseRight]' });
    await expect(await screen.findByRole('menuitem', { name: 'Share…' })).toHaveAttribute('aria-disabled', 'true');

    // Duplicate names the copy before the extension and puts it beside the file.
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));
    await canvas.findByText('Duplicated README.md');
    // findAllByText: HoldItem double-renders draggable rows — pick first.
    expect((await canvas.findAllByText('README copy.md'))[0]).toBeDefined();

    // Delete drops it again.
    await pickMenuAction(canvas, 'README copy.md', 'Delete');
    await canvas.findByText('Deleted README copy.md');
    await waitFor(() => expect(canvas.queryByText('README copy.md')).toBeNull());

    // New folder lands in the clicked entry's parent — the root here — so the row
    // appears in the view you are already in, rather than behind a navigation.
    await pickMenuAction(canvas, 'README.md', 'New folder');
    await canvas.findByText(`Created ${NEW_FOLDER_NAME} in Files`);
    // findAllByText: HoldItem double-renders draggable rows — pick first.
    expect((await canvas.findAllByText(NEW_FOLDER_NAME))[0]).toBeDefined();

    // A folder's menu has no `Share…`, and its own actions still apply.
    await pickMenuAction(canvas, NEW_FOLDER_NAME, 'Delete');
    await canvas.findByText(`Deleted ${NEW_FOLDER_NAME}`);
    await waitFor(() => expect(canvas.queryByText(NEW_FOLDER_NAME)).toBeNull());
  },
};
