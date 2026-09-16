import type { FileSystemItem } from '../types/file-system.types';
import { STORY_PREVIEWS as PREVIEWS, type StoryPreview } from './file-system-previews';

// ─── Shared data ───────────────────────────────────────────────────────────────
// A small, deterministic manifest. Only files are listed at the top level —
// `Documents/` and `Photos/` are inferred from their paths — while `Archive/` is
// declared with `hasChildren` and no entries, so it only fills in through
// `loadChildren` (see LazyChildren below).

/**
 * Spread a fixture onto a manifest entry: its picture, and the proportions that
 * picture was drawn at.
 *
 * The two travel together on purpose. `previewAspectRatio` is what decides the
 * box a file is drawn in — before the picture has even loaded — so a ratio that
 * disagrees with the image is what leaves paper showing around a thumbnail.
 * Declaring the truth here is what makes the margin in `Thumbnails` below the
 * ratio *limit* rather than a mismatch.
 */
function preview({ aspectRatio, uri }: StoryPreview) {
  return { previewAspectRatio: aspectRatio, previewImageUrl: uri };
}

/** Fixed timestamps keep the Date Modified column and the date sorts stable. */
const DATES = {
  april: '2026-04-02T11:20:00.000Z',
  february: '2026-02-14T16:05:00.000Z',
  january: '2026-01-08T09:30:00.000Z',
  june: '2026-06-21T08:15:00.000Z',
  march: '2026-03-19T14:45:00.000Z',
  may: '2026-05-11T17:40:00.000Z',
};

const SAMPLE_ITEMS: FileSystemItem[] = [
  { hasChildren: true, kind: 'folder', path: 'Archive/', updatedAt: DATES.january },
  { createdAt: DATES.june, kind: 'file', path: 'README.md', pinnedAt: DATES.june, size: 2480, updatedAt: DATES.june },
  {
    ...preview(PREVIEWS.invoice),
    createdAt: DATES.may,
    favoritedAt: DATES.may,
    kind: 'file',
    path: 'Invoice-0042.pdf',
    size: 84_120,
  },
  { createdAt: DATES.april, kind: 'file', path: 'Roadmap.pptx', pinnedAt: DATES.april, size: 1_204_000, updatedAt: DATES.may },
  { createdAt: DATES.march, kind: 'file', path: 'Budget-2026.xlsx', size: 96_400, updatedAt: DATES.june },
  {
    createdAt: DATES.january,
    kind: 'file',
    path: 'Documents/Contract.docx',
    pinnedAt: DATES.january,
    size: 48_900,
    updatedAt: DATES.february,
  },
  {
    createdAt: DATES.february,
    favoritedAt: DATES.february,
    kind: 'file',
    path: 'Documents/notes.txt',
    size: 1120,
    updatedAt: DATES.march,
  },
  {
    createdAt: DATES.january,
    kind: 'file',
    path: 'Documents/Reports/Q1-report.pdf',
    previewAspectRatio: PREVIEWS.reportChart.aspectRatio,
    // Three pages, two of them provided eagerly: the tile pager loads the third
    // — the donut — through `loadPreviewImageUrl`.
    previewImageUrls: [PREVIEWS.reportChart.uri, PREVIEWS.reportText.uri],
    previewPageCount: 3,
    size: 320_500,
    updatedAt: DATES.april,
  },
  {
    ...preview(PREVIEWS.reportChart),
    createdAt: DATES.april,
    favoritedAt: DATES.april,
    kind: 'file',
    path: 'Documents/Reports/Q2-report.pdf',
    size: 298_100,
    updatedAt: DATES.june,
  },
  {
    ...preview(PREVIEWS.dunes),
    createdAt: DATES.march,
    kind: 'file',
    path: 'Photos/dunes.jpg',
    pinnedAt: DATES.march,
    size: 2_140_000,
    updatedAt: DATES.march,
    url: PREVIEWS.dunes.uri,
  },
  {
    ...preview(PREVIEWS.harbour),
    createdAt: DATES.may,
    kind: 'file',
    path: 'Photos/harbour.jpg',
    size: 1_880_000,
    updatedAt: DATES.may,
    url: PREVIEWS.harbour.uri,
  },
  {
    // Portrait, among landscapes: each keeps its own proportions in the grid.
    ...preview(PREVIEWS.forest),
    createdAt: DATES.june,
    favoritedAt: DATES.june,
    kind: 'file',
    path: 'Photos/forest.png',
    size: 3_260_000,
    updatedAt: DATES.june,
    url: PREVIEWS.forest.uri,
  },
  {
    // 4:1, past the box clamp — see `Thumbnails`.
    ...preview(PREVIEWS.panorama),
    createdAt: DATES.may,
    kind: 'file',
    path: 'Photos/coast-panorama.jpg',
    size: 4_120_000,
    updatedAt: DATES.may,
    url: PREVIEWS.panorama.uri,
  },
  {
    // 1:3.2 — past it the other way round.
    ...preview(PREVIEWS.lighthouse),
    createdAt: DATES.april,
    kind: 'file',
    path: 'Photos/lighthouse.jpg',
    size: 1_640_000,
    updatedAt: DATES.april,
    url: PREVIEWS.lighthouse.uri,
  },
  {
    // A picture with no picture: nothing was ever generated for it, so it falls
    // all the way through to the file-type icon.
    createdAt: DATES.june,
    kind: 'file',
    path: 'Photos/IMG-4021.heic',
    size: 3_940_000,
    updatedAt: DATES.june,
  },
  {
    ...preview(PREVIEWS.invoice),
    createdAt: DATES.april,
    kind: 'file',
    path: 'Receipt-scan.pdf',
    size: 182_400,
    updatedAt: DATES.may,
  },
  {
    ...preview(PREVIEWS.reportText),
    createdAt: DATES.june,
    kind: 'file',
    path: 'Scan-0001.pdf',
    size: 96_700,
    updatedAt: DATES.june,
  },
  { createdAt: DATES.may, favoritedAt: DATES.may, kind: 'file', path: 'Tax-2025.xlsx', size: 214_000, updatedAt: DATES.june },
  { createdAt: DATES.march, kind: 'file', path: 'Trip-itinerary.docx', size: 58_300, updatedAt: DATES.may },
  {
    ...preview(PREVIEWS.reportText),
    createdAt: DATES.february,
    kind: 'file',
    path: 'Vaccination-record.pdf',
    size: 144_800,
    updatedAt: DATES.april,
  },
  {
    // A wide document: 10:3, so it letterboxes the same way the panorama does.
    ...preview(PREVIEWS.floorPlan),
    createdAt: DATES.april,
    kind: 'file',
    path: 'Zoo-trip-map.pdf',
    size: 310_000,
    updatedAt: DATES.april,
  },
  {
    createdAt: DATES.may,
    favoritedAt: DATES.may,
    kind: 'file',
    path: 'Wedding-checklist.docx',
    size: 42_100,
    updatedAt: DATES.may,
  },
  {
    ...preview(PREVIEWS.invoice),
    createdAt: DATES.june,
    kind: 'file',
    path: 'Warranty-card.pdf',
    size: 88_500,
    updatedAt: DATES.june,
  },
  { createdAt: DATES.february, kind: 'file', path: 'Year-review.pptx', size: 1_860_000, updatedAt: DATES.april },
  {
    ...preview(PREVIEWS.dunes),
    createdAt: DATES.april,
    kind: 'file',
    path: 'Wallpaper-sunset.jpg',
    size: 2_410_000,
    updatedAt: DATES.april,
    url: PREVIEWS.dunes.uri,
  },
  {
    ...preview(PREVIEWS.panorama),
    createdAt: DATES.may,
    kind: 'file',
    path: 'Wallpaper-mountains.jpg',
    size: 3_020_000,
    updatedAt: DATES.may,
    url: PREVIEWS.panorama.uri,
  },
  {
    ...preview(PREVIEWS.harbour),
    createdAt: DATES.june,
    kind: 'file',
    path: 'Wallpaper-coast.jpg',
    size: 2_780_000,
    updatedAt: DATES.june,
    url: PREVIEWS.harbour.uri,
  },
];

/**
 * `SAMPLE_ITEMS` plus enough padding rows to make the list view scroll in the
 * story canvas — the mid-drag scroll test needs content beyond the fold.
 */
const SCROLLABLE_ITEMS: FileSystemItem[] = [
  ...SAMPLE_ITEMS,
  ...Array.from({ length: 24 }, (_, index) => ({
    kind: 'file' as const,
    path: `Padding-${String(index).padStart(2, '0')}.txt`,
    size: 100,
  })),
];

/** What `Archive/` resolves to. Kept out of `items` so the load is observable. */
const ARCHIVE_ITEMS: FileSystemItem[] = [
  { ...preview(PREVIEWS.reportChart), createdAt: DATES.january, kind: 'file', path: 'Archive/2024-summary.pdf', size: 210_300 },
  { createdAt: DATES.january, kind: 'file', path: 'Archive/legacy.zip', size: 8_412_000 },
  {
    createdAt: DATES.january,
    favoritedAt: DATES.january,
    hasChildren: true,
    kind: 'folder',
    path: 'Archive/2024/',
    updatedAt: DATES.january,
  },
  { createdAt: DATES.january, kind: 'file', path: 'Archive/2024/minutes.docx', size: 22_600 },
];

/** Long enough for the loading placeholder to be observable, short enough to test. */
const LOAD_DELAY_MS = 120;

async function loadArchiveChildren() {
  await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));
  return { items: ARCHIVE_ITEMS };
}

/** Third page of the quarterly report, resolved on demand by the tile pager. */
async function loadPreviewImageUrl() {
  await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));
  return PREVIEWS.reportDonut.uri;
}

export { ARCHIVE_ITEMS, DATES, LOAD_DELAY_MS, loadArchiveChildren, loadPreviewImageUrl, preview, SAMPLE_ITEMS, SCROLLABLE_ITEMS };
