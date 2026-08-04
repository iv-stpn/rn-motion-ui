/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The file thumbnail: a paper-white page tile showing an externally generated
// preview image, a caller-supplied preview node, or the file-type icon plus its
// extension. Multi-page files get a pager (page thumbnails are loaded on demand
// through `loadPreviewImageUrl` and shared via a `path#pageIndex` cache).

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { cn } from '../../../lib/cn';
import { ChevronLeft, ChevronRight } from '../../../lib/icons';
import { Text } from '../../typography/Text/text';
import { Loader } from '../Loader/loader';
import type { FileEntry, FileSystemFileItem } from './file-system.types';
import { FileTypeIcon } from './file-system-icons';
import { filePreviewUrls } from './file-system-index';
import { fileExtension } from './file-system-paths';

/** Portrait page proportions, the fallback when a file declares no ratio. */
const DEFAULT_PREVIEW_ASPECT_RATIO = 0.72;

/** The tile face: paper-white in both themes, so previews read like documents. */
const TILE_FACE_CLASSNAME = 'overflow-hidden rounded-md border border-border bg-white';

/** The fallback icon scales with the tile, down to a legible floor. */
const ICON_MIN_SIZE = 16;
const ICON_WIDTH_DIVISOR = 3;

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
    setPageIndex(0);
    setLazyPageUrls({});
  }, [file.path]);

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

export type FileGenericPreviewProps = { file: FileEntry; iconSize?: number };

/** Icon + uppercase extension, shown when a file has no preview image. */
export function FileGenericPreview({ file, iconSize = 28 }: FileGenericPreviewProps) {
  const extension = fileExtension(file.name);
  return (
    <View className="flex-1 items-center justify-center gap-1.5">
      <FileTypeIcon fileName={file.name} size={iconSize} surface="light" />
      {extension ? (
        <Text className="text-neutral-400 uppercase tracking-wide" size="xs" weight="semibold">
          {extension}
        </Text>
      ) : null}
    </View>
  );
}

export type FileVisualProps = {
  file: FileEntry;
  /** Tile width in px. Height follows the preview aspect ratio. */
  width: number;
  className?: string;
  /** Show the page pager over multi-page thumbnails. */
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

export type FileVisualPagerProps = Pick<FilePagesState, 'goToPage' | 'pageIndex' | 'totalPages'>;

/** Page counter + prev/next, floating over the bottom of the tile. */
function FileVisualPager({ goToPage, pageIndex, totalPages }: FileVisualPagerProps) {
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

type TileFaceProps = {
  children: ReactNode;
  file: FileEntry;
  height: number;
  isPending: boolean;
  previewUrl: string | null;
  width: number;
};

/** What fills the tile: the page image, a spinner while it loads, or `children`. */
function FileTileFace({ children, file, height, isPending, previewUrl, width }: TileFaceProps) {
  if (previewUrl)
    return <Image accessibilityLabel={file.name} resizeMode="cover" source={{ uri: previewUrl }} style={{ height, width }} />;

  if (isPending)
    return (
      <View className="flex-1 items-center justify-center">
        <Loader size={16} variant="spinner" />
      </View>
    );

  return children;
}

/**
 * A file's visual: its page thumbnail when one exists, otherwise the consumer's
 * preview node or the built-in icon + extension fallback. The tile keeps a
 * paper-white face in both themes so previews read as documents.
 */
export function FileVisual({
  className,
  file,
  loadPreviewImageUrl,
  pageUrlCache,
  pageable = false,
  previewAspectRatio,
  renderFilePreview,
  width,
}: FileVisualProps) {
  const { goToPage, isPending, pageIndex, previewUrl, totalPages } = useFilePages(
    file,
    pageable,
    loadPreviewImageUrl,
    pageUrlCache,
  );
  const ratio = file.previewAspectRatio ?? previewAspectRatio ?? DEFAULT_PREVIEW_ASPECT_RATIO;
  const height = Math.round(width / ratio);
  const customPreview = previewUrl || isPending ? null : renderFilePreview?.(file);
  const showPager = pageable && totalPages > 1;

  return (
    <View className={cn('relative', className)} style={{ height, width }}>
      <View className={cn(TILE_FACE_CLASSNAME, 'size-full')}>
        <FileTileFace file={file} height={height} isPending={isPending} previewUrl={previewUrl} width={width}>
          {customPreview ?? (
            <FileGenericPreview file={file} iconSize={Math.max(ICON_MIN_SIZE, Math.round(width / ICON_WIDTH_DIVISOR))} />
          )}
        </FileTileFace>
      </View>
      {showPager ? <FileVisualPager goToPage={goToPage} pageIndex={pageIndex} totalPages={totalPages} /> : null}
    </View>
  );
}
