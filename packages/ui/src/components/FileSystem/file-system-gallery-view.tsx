// The gallery view: a large stage for the active entry, a metadata sidebar on
// wide viewports, and the filmstrip along the bottom. The web original pooled
// mounted document viewers and debounced arrow-key scrubbing; here the stage
// mounts one file at a time and the settle delay still keeps a fast tap-through
// from resolving URLs it will immediately discard.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, ScrollView, View } from 'react-native';
import { Loader } from '../Loader/loader';
import { Text } from '../Text/text';
import type { FileEntry, FileSystemEntry } from './file-system.types';
import { formatByteSize } from './file-system-format';
import { FileSystemGalleryStage } from './file-system-gallery-stage';
import { FileSystemGalleryStrip } from './file-system-gallery-strip';
import { FileSystemFolderGlyph } from './file-system-icons';
import { FileSystemInformation } from './file-system-information';
import { fileKindLabel } from './file-system-kinds';
import type { FileSystemViewProps } from './file-system-view';
import { FileSystemEmptyState } from './file-system-view';
import { FileVisual } from './file-system-visual';
import { useEntryActivation } from './use-entry-activation';

const EMPTY_LABEL = 'No files to show';
const FOLDER_LABEL = 'Folder';
const KIND_SIZE_SEPARATOR = ' · ';

/** Layout geometry (px). */
const SIDEBAR_WIDTH = 256;
const SIDEBAR_MIN_VIEWPORT_WIDTH = 640;
const STAGE_PADDING = 12;
const STAGE_FOLDER_GLYPH_SIZE = 128;
const SIDEBAR_FOLDER_GLYPH_SIZE = 32;
const SIDEBAR_PORTRAIT_WIDTH = 36;
const SIDEBAR_LANDSCAPE_WIDTH = 64;
const SIDEBAR_ASPECT_RATIO = 0.78;
const LANDSCAPE_RATIO = 1.2;
const STAGE_LOADER_SIZE = 24;
/** How long the selection must hold still before the stage resolves a URL. */
const SETTLE_DELAY_MS = 200;

/** `value` once it has stopped changing for `delay` ms. */
function useSettledValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);

  // biome-ignore lint/plugin: debouncing is a timer, and the delayed value can't be derived during render
  useEffect(() => {
    if (Object.is(settled, value)) return;
    const timeout = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timeout);
  }, [delay, settled, value]);

  return settled;
}

type StagePaneProps = Pick<
  FileSystemViewProps,
  'getFileUrl' | 'loadPreviewImageUrl' | 'pageUrlCache' | 'renderFilePreview' | 'renderFileViewer' | 'urlCache'
> & {
  entry: FileSystemEntry | null;
  /** The active file once the selection has settled; `null` while scrubbing. */
  file: FileEntry | null;
  width: number;
};

/** What the stage shows: a folder glyph, a spinner while scrubbing, or the file. */
function GalleryStagePane({ entry, file, width, ...stageProps }: StagePaneProps) {
  if (entry?.kind === 'folder') return <FileSystemFolderGlyph size={STAGE_FOLDER_GLYPH_SIZE} />;

  if (!file)
    return (
      <View className="flex-1 items-center justify-center">
        <Loader size={STAGE_LOADER_SIZE} variant="spinner" />
      </View>
    );

  return <FileSystemGalleryStage file={file} width={width} {...stageProps} />;
}

type SidebarProps = Pick<FileSystemViewProps, 'index' | 'renderFilePreview'> & {
  entry: FileSystemEntry;
  sizeLabel: string | null;
};

/** Name, kind and metadata for the active entry, beside the stage. */
function GallerySidebar({ entry, index, renderFilePreview, sizeLabel }: SidebarProps) {
  const isLandscape = entry.kind === 'file' && (entry.previewAspectRatio ?? 0) > LANDSCAPE_RATIO;
  const kindLabel = entry.kind === 'file' ? fileKindLabel(entry) : FOLDER_LABEL;
  const subtitle = sizeLabel ? `${kindLabel}${KIND_SIZE_SEPARATOR}${sizeLabel}` : kindLabel;

  return (
    <ScrollView
      className="shrink-0 border-border border-l"
      contentContainerClassName="gap-3 p-4"
      showsVerticalScrollIndicator={false}
      style={{ width: SIDEBAR_WIDTH }}
    >
      <View className="flex-row items-center gap-3">
        {entry.kind === 'folder' ? (
          <FileSystemFolderGlyph size={SIDEBAR_FOLDER_GLYPH_SIZE} />
        ) : (
          <FileVisual
            file={entry}
            previewAspectRatio={SIDEBAR_ASPECT_RATIO}
            renderFilePreview={renderFilePreview}
            width={isLandscape ? SIDEBAR_LANDSCAPE_WIDTH : SIDEBAR_PORTRAIT_WIDTH}
          />
        )}
        <View className="flex-1">
          <Text size="sm" weight="semibold">
            {entry.name}
          </Text>
          <Text className="text-muted-foreground" size="xs">
            {subtitle}
          </Text>
        </View>
      </View>
      <FileSystemInformation entry={entry} index={index} />
    </ScrollView>
  );
}

export function FileSystemGalleryView(props: FileSystemViewProps) {
  const { entries, getContextMenuActions, index, onContextMenuAction, onOpen, onSelect, renderFilePreview, selectedEntry } =
    props;
  const { testID } = props;
  const [viewportWidth, setViewportWidth] = useState(0);
  const activate = useEntryActivation(onOpen, onSelect);
  const handleLayout = useCallback((event: LayoutChangeEvent) => setViewportWidth(event.nativeEvent.layout.width), []);

  // The gallery always shows something: the selection when it belongs to this
  // folder, else the first entry.
  const activeEntry = useMemo(() => {
    if (selectedEntry && entries.some((entry) => entry.path === selectedEntry.path)) return selectedEntry;
    return entries[0] ?? null;
  }, [entries, selectedEntry]);

  const settledPath = useSettledValue(activeEntry?.path ?? null, SETTLE_DELAY_MS);
  const stagedFile = activeEntry?.kind === 'file' && activeEntry.path === settledPath ? activeEntry : null;
  const sizeLabel = activeEntry?.kind === 'file' ? formatByteSize(activeEntry.size) : null;
  const showSidebar = viewportWidth >= SIDEBAR_MIN_VIEWPORT_WIDTH;
  const stageWidth = Math.max(0, (showSidebar ? viewportWidth - SIDEBAR_WIDTH : viewportWidth) - STAGE_PADDING * 2);

  if (entries.length === 0) return <FileSystemEmptyState label={EMPTY_LABEL} />;

  return (
    <View className="flex-1" onLayout={handleLayout}>
      <View className="min-h-0 flex-1 flex-row">
        <View className="min-h-0 flex-1 items-center justify-center p-3">
          <GalleryStagePane {...props} entry={activeEntry} file={stagedFile} width={stageWidth} />
        </View>
        {showSidebar && activeEntry ? (
          <GallerySidebar entry={activeEntry} index={index} renderFilePreview={renderFilePreview} sizeLabel={sizeLabel} />
        ) : null}
      </View>
      <FileSystemGalleryStrip
        activePath={activeEntry?.path ?? null}
        entries={entries}
        getContextMenuActions={getContextMenuActions}
        onActivate={activate}
        onContextMenuAction={onContextMenuAction}
        renderFilePreview={renderFilePreview}
        testID={testID}
      />
    </View>
  );
}
