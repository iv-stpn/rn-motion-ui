/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// How a file is pictured, everywhere in the file system: `FileThumbnail` is the
// one component every view draws a file with — list rows, icon tiles, the
// gallery strip and stage, the columns rows and preview pane.
//
// It picks the best picture it has, in order: a page thumbnail (externally
// generated — the component never rasterizes documents itself), the consumer's
// preview node, then the file-type icon, which is why no caller needs a fallback
// of its own. Multi-page files can carry a pager; those pages load on demand
// through `loadPreviewImageUrl` and are shared via a `path#pageIndex` cache.
//
// Everything that varies by size is decided here rather than per view, so a
// thumbnail cannot read one way in a tile and another in a row:
//   · the box — the file's aspect ratio, clamped, fitted to the slot it was given
//   · the frame — a bordered page tile, dropped for a hairline at row scale
//   · the extension label under a badge, which `FileTypeIcon` prints only when
//     the glyph is drawn big enough to read it
// A view's only job is to say how much room it has.

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { LeftLine as ChevronLeft } from 'rn-motion-ui-icons/icons/left-line';
import { RightLine as ChevronRight } from 'rn-motion-ui-icons/icons/right-line';
import { cn } from '../../../../lib/cn';
import { Loader } from '../../../display/Loader/loader';
import { Text } from '../../../typography/Text/text';
import { fileIconWidthForBox } from '../../FileIcon/file-icon';
import { FileTypeIcon } from '../../FileIcon/file-icons';
import { filePreviewUrls } from '../logic/file-system-index';
import type { FileEntry, FileSystemFileItem } from '../types/file-system.types';

/** Portrait page proportions, the fallback when a file declares no ratio. */
const DEFAULT_PREVIEW_ASPECT_RATIO = 0.72;

/**
 * How far from square a thumbnail may follow the file's own proportions: at the
 * limit its box is twice as long as it is wide, whichever way round.
 *
 * Past that a thumbnail stops being a picture and becomes a sliver — a panorama
 * drawn to width in a 16 px lane is a few pixels tall. So the box stops at the
 * limit and the image sits inside it, which leaves margin rather than cropping.
 */
const MAX_THUMBNAIL_ELONGATION = 2;

/**
 * Below this width the face keeps its paper but drops its border: a 1.5 px
 * hairline around a row-sized glyph is a fifth of the picture, and the corner
 * has to come down with it or the square reads as a lozenge.
 */
const FRAMED_MIN_WIDTH = 24;

/**
 * The face a picture is drawn on: paper-white in both themes, so thumbnails read
 * like documents — and so the margin around one that could not fill its box
 * reads as the page it is printed on rather than as a gap.
 */
const FACE_CLASSNAME = 'size-full overflow-hidden bg-white';

type ThumbnailBox = { height: number; width: number };

/**
 * The box a file draws in: its aspect ratio, clamped, fitted to the room the
 * view gave it.
 *
 * With no `slotHeight` the ratio decides one — the mode for a view that hands a
 * file a column of its own and lets it be as tall as it is (a tile, a preview
 * pane). With one, whichever edge runs out first wins, which is what lets a
 * portrait page and a landscape photo share a row's glyph lane.
 */
function thumbnailBox(ratio: number, width: number, slotHeight?: number): ThumbnailBox {
  // Clamping before the fit is also what makes a zero or negative ratio — the
  // manifest is consumer data — a very tall box rather than a collapsed one.
  const clamped = Math.min(Math.max(ratio, 1 / MAX_THUMBNAIL_ELONGATION), MAX_THUMBNAIL_ELONGATION);
  if (slotHeight === undefined || clamped > width / slotHeight) return { height: width / clamped, width };
  return { height: slotHeight, width: slotHeight * clamped };
}

export type FilePagesState = {
  pageIndex: number;
  totalPages: number;
  previewUrl: string | null;
  isPending: boolean;
  goToPage: (index: number) => void;
};

/**
 * Resolve the current page's thumbnail. Eager `previewImageUrls` win; anything
 * beyond them is fetched once through `loadPreviewImageUrl` and memoized in the
 * shared cache so other views reuse it.
 *
 * Only a pageable thumbnail fetches. A row draws the cover it was handed and
 * nothing else, so scrolling a long folder costs no I/O.
 */
function useFilePages(
  file: FileEntry,
  pageable: boolean,
  loadPreviewImageUrl?: (file: FileSystemFileItem, pageIndex: number) => Promise<string | null>,
  pageUrlCache?: Map<string, string>,
): FilePagesState {
  const previewUrls = filePreviewUrls(file);
  const canLoadLazily = pageable && Boolean(loadPreviewImageUrl);
  const totalPages = Math.max(previewUrls.length, canLoadLazily ? (file.previewPageCount ?? 0) : 0);

  const [pageIndex, setPageIndex] = useState(0);
  const [lazyPageUrls, setLazyPageUrls] = useState<Record<number, string>>({});
  const clampedPageIndex = Math.min(pageIndex, Math.max(totalPages - 1, 0));
  const previewUrl =
    previewUrls[clampedPageIndex] ??
    lazyPageUrls[clampedPageIndex] ??
    pageUrlCache?.get(`${file.path}#${clampedPageIndex}`) ??
    null;
  const isPending = canLoadLazily && !previewUrl && clampedPageIndex < totalPages;

  // The latest item object, so a manifest refresh doesn't re-trigger the fetch
  // effect (which is keyed on the path).
  const fileRef = useRef(file);
  fileRef.current = file;

  // biome-ignore lint/plugin: switching files must reset the pager — the page index is user state, so it can't be derived from the file prop during render
  // biome-ignore lint/correctness/useExhaustiveDependencies: file.path is the intended trigger, not a value the effect reads
  useEffect(() => {
    // Nothing but a pager can have moved either one, and a fresh object here
    // would cost every row in a list a second render on mount.
    if (!pageable) return;
    setPageIndex(0);
    setLazyPageUrls({});
  }, [file.path, pageable]);

  // biome-ignore lint/plugin: fetching a page thumbnail is I/O keyed on the visible page; there is no data library in this package to delegate it to
  useEffect(() => {
    if (!(isPending && loadPreviewImageUrl)) return;
    let isCurrent = true;

    loadPreviewImageUrl(fileRef.current, clampedPageIndex)
      .then((url) => {
        // Cache even when stale (page flipped away mid-load): the fetch is
        // done, so let the next visit use it.
        if (url) pageUrlCache?.set(`${file.path}#${clampedPageIndex}`, url);
        if (isCurrent && url) setLazyPageUrls((previous) => ({ ...previous, [clampedPageIndex]: url }));
      })
      // A failed thumbnail is not an error: the tile keeps its icon fallback.
      .catch(() => undefined);

    return () => {
      isCurrent = false;
    };
  }, [clampedPageIndex, file.path, isPending, loadPreviewImageUrl, pageUrlCache]);

  const goToPage = useCallback((index: number) => setPageIndex(Math.max(0, Math.min(totalPages - 1, index))), [totalPages]);

  return { goToPage, isPending, pageIndex: clampedPageIndex, previewUrl, totalPages };
}

export type FileThumbnailPagerProps = Pick<FilePagesState, 'goToPage' | 'pageIndex' | 'totalPages'>;

/** Page counter + prev/next, floating over the bottom of the thumbnail. */
function FileThumbnailPager({ goToPage, pageIndex, totalPages }: FileThumbnailPagerProps) {
  const isFirst = pageIndex === 0;
  const isLast = pageIndex >= totalPages - 1;
  const goPrevious = useCallback(() => goToPage(pageIndex - 1), [goToPage, pageIndex]);
  const goNext = useCallback(() => goToPage(pageIndex + 1), [goToPage, pageIndex]);

  return (
    <View className="absolute inset-x-0 bottom-1.5 flex-row items-center justify-center gap-1">
      <Pressable
        accessibilityLabel="Previous page"
        accessibilityRole="button"
        className={cn('size-6 items-center justify-center rounded-md bg-surface-3', isFirst && 'opacity-40')}
        disabled={isFirst}
        onPress={goPrevious}
      >
        <ChevronLeft size={14} />
      </Pressable>
      <View className="rounded-md bg-surface-3 px-1.5 py-0.5">
        <Text className="text-muted-foreground" numeric={true} size="xs" weight="medium">
          {`${pageIndex + 1}/${totalPages}`}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Next page"
        accessibilityRole="button"
        className={cn('size-6 items-center justify-center rounded-md bg-surface-3', isLast && 'opacity-40')}
        disabled={isLast}
        onPress={goNext}
      >
        <ChevronRight size={14} />
      </Pressable>
    </View>
  );
}

type ThumbnailFaceProps = { children: ReactNode; isPending: boolean; previewUrl: string | null };

/**
 * What fills the face: the page image, a spinner while it loads, or `children`.
 *
 * The image is drawn `contain`, never cropped: the box is already the file's own
 * ratio, so the only time it does not fill is when the manifest's ratio and the
 * image disagree, or when the ratio was too elongated to draw — and in both
 * cases showing the whole picture on its paper beats slicing it to fit.
 */
function ThumbnailFace({ children, isPending, previewUrl }: ThumbnailFaceProps) {
  // Unlabelled on purpose: every caller already names the file next to it, and a
  // second node carrying that name makes it ambiguous to query by label.
  if (previewUrl) return <Image className="size-full" resizeMode="contain" source={{ uri: previewUrl }} />;

  if (isPending)
    return (
      <View className="flex-1 items-center justify-center">
        <Loader size={16} variant="spinner" />
      </View>
    );

  return children;
}

export type FileThumbnailProps = {
  file: FileEntry;
  /** The room the view has, in px. The file's ratio is fitted inside it. */
  width: number;
  /**
   * The slot's height. Omit where the file may be as tall as its ratio asks —
   * a tile, a preview pane; pass it where the view owns the height, like a row's
   * glyph lane.
   */
  height?: number;
  className?: string;
  /** Show the page pager over multi-page thumbnails, and load pages on demand. */
  pageable?: boolean;
  loadPreviewImageUrl?: (file: FileSystemFileItem, pageIndex: number) => Promise<string | null>;
  /**
   * Shared `path#pageIndex` → URL cache so pages fetched by one pager (gallery
   * stage, columns preview) are reused by every other instance.
   */
  pageUrlCache?: Map<string, string>;
  /** Fallback ratio when the file declares none. */
  previewAspectRatio?: number;
  renderFilePreview?: (file: FileSystemFileItem) => ReactNode;
};

/**
 * A file's picture at whatever size the view can give it: its page thumbnail
 * when one exists, otherwise the consumer's preview node, otherwise the
 * file-type icon.
 *
 * Only the first two are framed — a thumbnail is arbitrary content, so it gets a
 * paper-white tile to read as a document. The icon already *is* a drawn page, so
 * it stands bare: a second page drawn around it would only box a picture of a
 * file inside a picture of a file.
 */
export function FileThumbnail({
  className,
  file,
  height,
  loadPreviewImageUrl,
  pageUrlCache,
  pageable = false,
  previewAspectRatio,
  renderFilePreview,
  width,
}: FileThumbnailProps) {
  const { goToPage, isPending, pageIndex, previewUrl, totalPages } = useFilePages(
    file,
    pageable,
    loadPreviewImageUrl,
    pageUrlCache,
  );
  const box = thumbnailBox(file.previewAspectRatio ?? previewAspectRatio ?? DEFAULT_PREVIEW_ASPECT_RATIO, width, height);
  const customPreview = previewUrl || isPending ? null : renderFilePreview?.(file);
  const showPager = pageable && totalPages > 1;

  // With no picture there is no ratio to honour, so the icon takes the whole
  // slot instead of the box a thumbnail would have wanted — a lane of files
  // keeps one icon width whatever each of them claims its preview looks like.
  // The width is the file-blind one, so mixed types land on the same edges.
  if (!(previewUrl || isPending || customPreview)) {
    const iconSlotHeight = height ?? box.height;
    return (
      <View className={cn('items-center justify-center', className)} style={{ height: iconSlotHeight, width }}>
        <FileTypeIcon fileName={file.name} size={fileIconWidthForBox(width, iconSlotHeight)} />
      </View>
    );
  }

  return (
    <View className={cn('relative shrink-0', className)} style={box}>
      <View
        className={cn(FACE_CLASSNAME, width < FRAMED_MIN_WIDTH ? 'rounded-[3px]' : 'rounded-md border-[1.5px] border-border')}
      >
        <ThumbnailFace isPending={isPending} previewUrl={previewUrl}>
          {customPreview}
        </ThumbnailFace>
      </View>
      {showPager ? <FileThumbnailPager goToPage={goToPage} pageIndex={pageIndex} totalPages={totalPages} /> : null}
    </View>
  );
}
