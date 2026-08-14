/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The open-a-file modal. Images render built-in; the other viewable kinds are
// the consumer's through `renderFileViewer`, and anything unviewable never
// reaches here (the root hands those to `onFileOpen` instead).
//
// The web original sized its dialog in viewport units per kind. Percentages of
// the window are the RN equivalent, so pages stay tall while presentations and
// spreadsheets stay wide.

import { useCallback } from 'react';
import { View } from 'react-native';
import { AdaptiveModal, type WidePanelSize } from '../../../menus/AdaptiveModal/adaptive-modal';
import { useFileSystemConsumer, useFileSystemViewer, useFileSystemViewerActions } from '../store/file-system-context';
import type { FileEntry, FileSystemViewerKind } from '../types/file-system.types';
import { FileSystemGalleryStage } from './file-system-gallery-stage';

/** Wide-screen panel size per viewer kind, as a share of the window. */
const VIEWER_PANEL_SIZES: Record<FileSystemViewerKind, WidePanelSize> = {
  docx: { height: '88%', maxWidth: '96%', width: '70%' },
  image: { maxHeight: '88%', maxWidth: '90%' },
  pdf: { height: '88%', maxWidth: '96%', width: '70%' },
  pptx: { height: '88%', maxWidth: '96%', width: '82%' },
  xlsx: { height: '85%', maxWidth: '96%', width: '92%' },
};

/** Fallback stage width when the modal has no measured pane yet. */
const VIEWER_STAGE_WIDTH = 640;

export type FileSystemOpenedFile = { file: FileEntry; kind: FileSystemViewerKind; url: string | null };

/**
 * Hosts one file at a time. The stage is the same component the gallery centre
 * pane uses, so a file opened straight from a resolved URL shows without a
 * second round-trip — the URL is already in `urlCache`.
 */
export function FileSystemViewerModal() {
  const { closeFile } = useFileSystemViewerActions();
  const { opened, resolvedUrlCache, pageUrlCache } = useFileSystemViewer();
  const { getFileUrl, loadPreviewImageUrl, renderFilePreview, renderFileViewer } = useFileSystemConsumer();

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) closeFile();
    },
    [closeFile],
  );

  return (
    <AdaptiveModal
      customLayout={true}
      onOpenChange={handleOpenChange}
      open={opened !== null}
      showClose={true}
      title={opened?.file.name}
      widePanelSize={opened ? VIEWER_PANEL_SIZES[opened.kind] : undefined}
    >
      <View className="min-h-0 flex-1 items-center justify-center p-3">
        {opened ? (
          <FileSystemGalleryStage
            file={opened.file}
            getFileUrl={getFileUrl}
            loadPreviewImageUrl={loadPreviewImageUrl}
            pageUrlCache={pageUrlCache}
            renderFilePreview={renderFilePreview}
            renderFileViewer={renderFileViewer}
            urlCache={resolvedUrlCache}
            width={VIEWER_STAGE_WIDTH}
          />
        ) : null}
      </View>
    </AdaptiveModal>
  );
}
