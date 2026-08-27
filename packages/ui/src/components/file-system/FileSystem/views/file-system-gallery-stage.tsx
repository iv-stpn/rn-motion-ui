/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The gallery's centre pane (and the viewer modal's body): one file, shown as
// large as the pane allows. Images are handled here; every other viewable kind
// is delegated to `renderFileViewer`, falling back to the pageable thumbnail.
// The web original kept a pool of mounted stages alive to avoid re-parsing
// documents on revisit — here the viewer is the consumer's, so pooling is
// theirs too and a single stage is mounted at a time.

import type { ReactNode } from 'react';
import { Image, View } from 'react-native';
import { Loader } from '../../../display/Loader/loader';
import { useResolvedFileUrl } from '../hooks/use-resolved-file-url';
import { viewerKindForFile } from '../logic/file-system-kinds';
import type { FileEntry, FileSystemFileItem, FileSystemViewerArgs } from '../types/file-system.types';
import { FileThumbnail } from './file-system-thumbnail';

/** Stage geometry (px). */
const STAGE_THUMBNAIL_WIDTH = 224;
const STAGE_ASPECT_RATIO = 0.78;
const STAGE_LOADER_SIZE = 24;

export type FileSystemGalleryStageProps = {
  file: FileEntry;
  /** Pane width in px, so the fallback thumbnail can't overflow it. */
  width: number;
  getFileUrl?: (file: FileSystemFileItem) => string | Promise<string>;
  loadPreviewImageUrl?: (file: FileSystemFileItem, pageIndex: number) => Promise<string | null>;
  pageUrlCache?: Map<string, string>;
  renderFilePreview?: (file: FileSystemFileItem) => ReactNode;
  renderFileViewer?: (args: FileSystemViewerArgs) => ReactNode;
  urlCache: Map<string, string>;
};

/**
 * One file at stage size. Only viewer-backed kinds resolve a URL, so selecting
 * a thumbnail-only file never triggers a presign.
 */
export function FileSystemGalleryStage({
  file,
  getFileUrl,
  loadPreviewImageUrl,
  pageUrlCache,
  renderFileViewer,
  renderFilePreview,
  urlCache,
  width,
}: FileSystemGalleryStageProps) {
  const viewerKind = viewerKindForFile(file);
  const { isResolving, url } = useResolvedFileUrl(viewerKind ? file : null, getFileUrl, urlCache);

  if (viewerKind && isResolving)
    return (
      <View className="flex-1 items-center justify-center">
        <Loader size={STAGE_LOADER_SIZE} variant="spinner" />
      </View>
    );

  if (viewerKind === 'image' && url)
    return <Image accessibilityLabel={file.name} className="size-full rounded-lg" resizeMode="contain" source={{ uri: url }} />;

  const viewer = viewerKind ? renderFileViewer?.({ file, kind: viewerKind, url }) : null;
  if (viewer) return <View className="size-full">{viewer}</View>;

  return (
    <FileThumbnail
      file={file}
      loadPreviewImageUrl={loadPreviewImageUrl}
      pageUrlCache={pageUrlCache}
      pageable={true}
      previewAspectRatio={STAGE_ASPECT_RATIO}
      renderFilePreview={renderFilePreview}
      width={Math.min(STAGE_THUMBNAIL_WIDTH, width)}
    />
  );
}
