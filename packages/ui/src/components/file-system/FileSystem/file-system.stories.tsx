import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Note } from '../../../__stories__/story-harness';
import { Text } from '../../typography/Text/text';
import { FileSystemControls, renderViewSwitcherHeader } from './__stories__/file-system-playground';
import { STORY_PREVIEWS as PREVIEWS } from './__stories__/file-system-previews';
import { DATES, preview } from './__stories__/file-system-story-data';
import { FILE_SYSTEM_ARGS, FILE_SYSTEM_DECORATORS } from './__stories__/file-system-story-meta';
import { FileSystem } from './file-system';
import { fileSystemEntryTestID } from './logic/file-system-test-id';
import type { FileSystemFileItem, FileSystemItem, FileSystemProps, FileSystemViewProps } from './types/file-system.types';
import { FS_THUMBNAIL_TEST_ID, MAX_THUMBNAIL_ELONGATION } from './views/file-system-thumbnail';

const meta = {
  title: 'File System/FileSystem',
  component: FileSystem,
  parameters: { layout: 'centered' },
  decorators: FILE_SYSTEM_DECORATORS,
  args: FILE_SYSTEM_ARGS,
} satisfies Meta<typeof FileSystem>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Interactive ───────────────────────────────────────────────────────────────

/** Every view, layout width and consumer-driven feature on one canvas. */
export const Interactive: Story = {
  render: (args) => <FileSystemControls {...args} />,
};

// ─── Views ─────────────────────────────────────────────────────────────────────

export const SwitchViews: Story = {
  name: 'Demo: Switch views',
  args: { testID: 'file-system-views', renderHeader: renderViewSwitcherHeader },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Every entry answers to `<testID>-entry-<path>` whichever view is drawing
    // it, so one query holds across all four frames below.
    const readme = 'file-system-views-entry-README.md';

    // Grid is the default: tiles, no column headers.
    await canvas.findAllByText('README.md');
    await canvas.findAllByTestId(readme);
    expect(canvas.queryByText('Date Modified')).toBeNull();

    // List brings the sortable Name / Date Modified / Size header row.
    await userEvent.click(await canvas.findByLabelText('List view'));
    await canvas.findByText('Date Modified');
    await canvas.findAllByTestId(readme);
    await waitFor(() => expect(args.onViewChange).toHaveBeenCalledWith('list'));

    // Columns and Gallery keep the same entries, each in its own frame.
    await userEvent.click(await canvas.findByLabelText('Columns view'));
    await waitFor(() => expect(canvas.queryByText('Date Modified')).toBeNull());
    await canvas.findAllByText('README.md');
    await canvas.findAllByTestId(readme);

    await userEvent.click(await canvas.findByLabelText('Gallery view'));
    await waitFor(() => expect(args.onViewChange).toHaveBeenLastCalledWith('gallery'));
    await canvas.findAllByTestId(readme);
  },
};

/** A consumer-defined view registered through `FileSystemProps.views`. */
function KanbanView({ entries }: FileSystemViewProps) {
  return (
    <View className="flex-1 gap-2 p-4">
      <Text size="lg" weight="semibold">
        Kanban board
      </Text>
      {entries.map((entry) => (
        <View key={entry.path} className="hairline rounded-md border-border bg-surface-2 px-3 py-1.5">
          <Text size="sm">{entry.name}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A view the package never shipped: `views` maps a custom id to a component that
 * gets the same flat {@link FileSystemViewProps} contract the four built-ins do.
 * The controlled `view` prop selects `kanban` directly; consumers could just as
 * well reach it through `setView` from their own header.
 */
export const CustomView: Story = {
  name: 'Demo: Custom view',
  args: { view: 'kanban', views: { kanban: KanbanView } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByText('Kanban board');
    await canvas.findAllByText('README.md');
  },
};

// ─── Thumbnails ────────────────────────────────────────────────────────────────
// How a file is pictured, in every view: the page thumbnail the manifest
// carries, else the node `renderFilePreview` hands back, else the file-type
// icon. The box that picture is drawn in follows the file's own ratio — up to a
// point, which is what the story below is for.

/** The one kind the story's consumer draws itself, and the node it draws. */
const SWATCH_EXTENSION = '.sketch';
const CUSTOM_PREVIEW_TEST_ID = 'story-custom-preview';

/**
 * The middle rung of the fallback chain. `renderFilePreview` is asked only about
 * files with no thumbnail of their own, and returning `null` for the kinds it
 * does not know leaves those to the file-type icon — so one callback shows both
 * rungs at once.
 */
function renderSwatchPreview(file: FileSystemFileItem) {
  if (!file.path.endsWith(SWATCH_EXTENSION)) return null;
  return (
    <View className="size-full items-center justify-center bg-primary/15" testID={CUSTOM_PREVIEW_TEST_ID}>
      <Text className="text-primary" size="xs" weight="semibold">
        SKETCH
      </Text>
    </View>
  );
}

/**
 * One folder covering the three things a thumbnail can be: a picture drawn at
 * its own proportions, a picture too elongated to draw at them, and no picture
 * at all. Grouped that way here; the grid itself sorts them by name.
 */
const THUMBNAIL_ITEMS: FileSystemItem[] = [
  // Inside the limit: the box *is* the picture's ratio, so it fills edge to edge.
  { ...preview(PREVIEWS.dunes), kind: 'file', path: 'Dunes.jpg', size: 2_140_000, updatedAt: DATES.march },
  { ...preview(PREVIEWS.forest), kind: 'file', path: 'Forest.png', size: 3_260_000, updatedAt: DATES.june },
  { ...preview(PREVIEWS.invoice), kind: 'file', path: 'Invoice-0042.pdf', size: 84_120, updatedAt: DATES.may },
  { ...preview(PREVIEWS.slide), kind: 'file', path: 'Keynote-deck.pdf', size: 640_000, updatedAt: DATES.april },
  // Past it: the box stops at 2:1 and the picture is fitted inside, which leaves
  // the paper showing along two of its edges rather than cropping the picture.
  { ...preview(PREVIEWS.panorama), kind: 'file', path: 'Coast-panorama.jpg', size: 4_120_000, updatedAt: DATES.may },
  { ...preview(PREVIEWS.lighthouse), kind: 'file', path: 'Lighthouse.jpg', size: 1_640_000, updatedAt: DATES.april },
  { ...preview(PREVIEWS.floorPlan), kind: 'file', path: 'Floor-plan.pdf', size: 310_000, updatedAt: DATES.june },
  // No picture: the consumer's node for the one kind it knows, the file-type
  // icon for the rest — a page with its extension printed on it, or a brand mark.
  { kind: 'file', path: 'Logo.sketch', size: 1_120_000, updatedAt: DATES.june },
  { kind: 'file', path: 'Untitled.heic', size: 3_940_000, updatedAt: DATES.june },
  { kind: 'file', path: 'Backup.zip', size: 8_412_000, updatedAt: DATES.february },
  { kind: 'file', path: 'Q3-deck.pptx', size: 1_860_000, updatedAt: DATES.march },
];

const THUMBNAILS_TEST_ID = 'thumbnails';

const THUMBNAILS_NOTE =
  'Every file is drawn at its own proportions, up to twice as long as it is wide. Past that the box stops at the limit and the picture keeps its shape inside it: Coast-panorama.jpg and Floor-plan.pdf keep paper above and below, Lighthouse.jpg keeps it either side. Four files carry no thumbnail at all — Logo.sketch falls back to the consumer’s own preview node, Backup.zip, Q3-deck.pptx and Untitled.heic to their file-type icon.';

function renderThumbnails(args: FileSystemProps) {
  return (
    <View className="gap-3">
      <Note>{THUMBNAILS_NOTE}</Note>
      <FileSystem {...args} />
    </View>
  );
}

/** The tile for `path`, whatever it drew inside. */
async function thumbnailTile(canvas: ReturnType<typeof within>, path: string): Promise<HTMLElement> {
  const tiles: HTMLElement[] = await canvas.findAllByTestId(fileSystemEntryTestID(THUMBNAILS_TEST_ID, path));
  const tile = tiles[0];
  if (!tile) throw new Error(`no tile rendered for ${path}`);
  return tile;
}

/**
 * What a tile drew, measured off the DOM: the box the view gave the file, and
 * the proportions of the picture that landed in it.
 *
 * Two nodes, because they answer different halves. The box is
 * `FS_THUMBNAIL_TEST_ID` — the node the clamp sizes. The picture's own shape
 * comes off the real `<img>` react-native-web keeps behind every `Image`: it is
 * laid out at its intrinsic ratio rather than stretched, so it is no use as a
 * box, but `naturalWidth`/`naturalHeight` is the file as drawn. Fitting one
 * into the other is what `resizeMode="contain"` does, so the leftover is the
 * paper the story is about.
 */
async function measureThumbnail(canvas: ReturnType<typeof within>, path: string) {
  const tile = await thumbnailTile(canvas, path);
  const [boxNode] = within(tile).getAllByTestId(FS_THUMBNAIL_TEST_ID);
  const image = tile.querySelector('img');
  if (!(boxNode && image)) throw new Error(`no picture drawn for ${path}`);
  // Decoding is asynchronous even for a data URI, and the natural size is what
  // the margin is computed from.
  await waitFor(() => expect(image.naturalWidth).toBeGreaterThan(0));

  const box = boxNode.getBoundingClientRect();
  const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  return {
    boxRatio: box.width / box.height,
    marginX: (box.width - image.naturalWidth * scale) / 2,
    marginY: (box.height - image.naturalHeight * scale) / 2,
    pictureRatio: image.naturalWidth / image.naturalHeight,
  };
}

/**
 * The ratio limit and the fallback chain, in one folder.
 *
 * A thumbnail follows its file's proportions only up to `MAX_THUMBNAIL_ELONGATION`
 * — twice as long as it is wide, either way round. Past that a picture drawn to
 * width would be a sliver in a row's glyph lane, so the box stops at the limit
 * and the picture is fitted inside it: the paper it is printed on shows along
 * two edges instead of the picture being sliced to fit.
 *
 * The same component decides what to draw when there is no picture, which is why
 * no view carries a fallback of its own: the consumer's preview node comes
 * first, then the file-type icon — with its extension printed on the page, at
 * tile sizes where that is legible.
 */
export const Thumbnails: Story = {
  name: 'Demo: Thumbnails, ratio limits and fallbacks',
  args: {
    items: THUMBNAIL_ITEMS,
    renderFilePreview: renderSwatchPreview,
    testID: THUMBNAILS_TEST_ID,
    title: 'Previews',
  },
  render: renderThumbnails,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByText('Dunes.jpg');

    // A 3:2 photo is inside the limit, so its box is its own ratio and the
    // picture covers it — no paper showing on any edge.
    const dunes = await measureThumbnail(canvas, 'Dunes.jpg');
    expect(dunes.pictureRatio).toBeCloseTo(1.5, 1);
    expect(dunes.boxRatio).toBeCloseTo(dunes.pictureRatio, 1);
    expect(dunes.marginX + dunes.marginY).toBeLessThan(1);

    // 4:1 is twice the limit: the box comes back to 2:1 …
    const panorama = await measureThumbnail(canvas, 'Coast-panorama.jpg');
    expect(panorama.pictureRatio).toBeCloseTo(4, 1);
    expect(panorama.boxRatio).toBeCloseTo(MAX_THUMBNAIL_ELONGATION, 1);
    // … and the picture keeps its own shape inside it, so the paper shows above
    // and below it rather than the sides being cropped off.
    expect(panorama.marginY).toBeGreaterThan(2);
    expect(panorama.marginX).toBeLessThan(1);

    // The same limit the other way round, and the margin moves to the sides.
    const lighthouse = await measureThumbnail(canvas, 'Lighthouse.jpg');
    expect(lighthouse.boxRatio).toBeCloseTo(1 / MAX_THUMBNAIL_ELONGATION, 1);
    expect(lighthouse.marginX).toBeGreaterThan(2);
    expect(lighthouse.marginY).toBeLessThan(1);

    // A document is clamped by the same rule a photo is — nothing here reads the
    // file's kind, only the ratio it declares.
    const plan = await measureThumbnail(canvas, 'Floor-plan.pdf');
    expect(plan.pictureRatio).toBeGreaterThan(MAX_THUMBNAIL_ELONGATION);
    expect(plan.boxRatio).toBeCloseTo(MAX_THUMBNAIL_ELONGATION, 1);
    expect(plan.marginY).toBeGreaterThan(2);

    // No thumbnail: the consumer's node is asked first and answers for `.sketch`.
    // It still gets a framed box — as far as the layout is concerned it is a
    // picture, just not one the manifest carried.
    const sketch = await thumbnailTile(canvas, 'Logo.sketch');
    expect(within(sketch).queryAllByTestId(CUSTOM_PREVIEW_TEST_ID)).not.toHaveLength(0);
    expect(within(sketch).queryAllByTestId(FS_THUMBNAIL_TEST_ID)).not.toHaveLength(0);

    // What that node declines falls through to the file-type icon, which takes
    // the slot rather than a thumbnail box — no box, no raster — and prints the
    // extension on its page at this size.
    const heic = await thumbnailTile(canvas, 'Untitled.heic');
    expect(within(heic).queryAllByTestId(FS_THUMBNAIL_TEST_ID)).toHaveLength(0);
    expect(heic.querySelector('img')).toBeNull();
    within(heic).getByText('HEIC');

    // A brand glyph is drawn full-bleed instead, so it prints no label: there is
    // no page margin to print one in.
    const deck = await thumbnailTile(canvas, 'Q3-deck.pptx');
    expect(within(deck).queryAllByTestId(FS_THUMBNAIL_TEST_ID)).toHaveLength(0);
    expect(within(deck).queryByText('PPTX')).toBeNull();
  },
};
