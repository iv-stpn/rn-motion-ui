// The gallery view: a large stage for the active entry, a metadata sidebar on
// wide viewports, and the filmstrip along the bottom. The web original pooled
// mounted document viewers and debounced arrow-key scrubbing; here the stage
// mounts one file at a time and the settle delay still keeps a fast tap-through
// from resolving URLs it will immediately discard.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, ScrollView, View } from 'react-native';
import { Loader } from '../../../display/Loader/loader';
import { Text } from '../../../typography/Text/text';
import { FileSystemFolderGlyph } from '../../FileIcon/file-icons';
import { useEntryActivation } from '../hooks/use-entry-activation';
import { formatByteSize } from '../logic/file-system-format';
import { folderHasChildren } from '../logic/file-system-index';
import { fileKindLabel } from '../logic/file-system-kinds';
import type { FileEntry, FileSystemEntry } from '../types/file-system.types';
import { FileSystemGalleryStage } from './file-system-gallery-stage';
import { FileSystemGalleryStrip } from './file-system-gallery-strip';
import { FileSystemInformation } from './file-system-information';
import { FileThumbnail } from './file-system-thumbnail';
import type { FileSystemViewProps } from './file-system-view';
import { FileSystemEmptyState } from './file-system-view';

const EMPTY_LABEL = 'No files to show';
const FOLDER_LABEL = 'Folder';
const KIND_SIZE_SEPARATOR = ' · ';

/** Layout geometry (px). */
const SIDEBAR_WIDTH = 256;
const SIDEBAR_MIN_VIEWPORT_WIDTH = 640;
const STAGE_PADDING = 12;
const STAGE_FOLDER_GLYPH_SIZE = 128;
const SIDEBAR_FOLDER_GLYPH_SIZE = 32;
/** The slot beside the name: a photo fills its width, a page its height. */
const SIDEBAR_THUMBNAIL_WIDTH = 64;
const SIDEBAR_THUMBNAIL_HEIGHT = 46;
const SIDEBAR_ASPECT_RATIO = 0.78;
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
  /** Whether a staged folder holds anything — drives the folder glyph's variant. */
  hasChildren: boolean;
  width: number;
};

/** What the stage shows: a folder glyph, a spinner while scrubbing, or the file. */
function GalleryStagePane({ entry, file, hasChildren, width, ...stageProps }: StagePaneProps) {
  if (entry?.kind === 'folder')
    return <FileSystemFolderGlyph size={STAGE_FOLDER_GLYPH_SIZE} variant={hasChildren ? 'filled' : 'empty'} />;

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
  const kindLabel = entry.kind === 'file' ? fileKindLabel(entry) : FOLDER_LABEL;
  const subtitle = sizeLabel ? `${kindLabel}${KIND_SIZE_SEPARATOR}${sizeLabel}` : kindLabel;

  return (
    <ScrollView
      className="shrink-0 border-border border-l-[1.5px]"
      contentContainerClassName="gap-3 p-4"
      showsVerticalScrollIndicator={false}
      style={{ width: SIDEBAR_WIDTH }}
      // Nested inside the consumer's own ScrollView — Android only scrolls a
      // child of a scroll container when it opts into nested scrolling.
      nestedScrollEnabled={true}
    >
      <View className="flex-row items-center gap-3">
        {entry.kind === 'folder' ? (
          <FileSystemFolderGlyph
            size={SIDEBAR_FOLDER_GLYPH_SIZE}
            variant={folderHasChildren(index, entry) ? 'filled' : 'empty'}
          />
        ) : (
          <FileThumbnail
            file={entry}
            height={SIDEBAR_THUMBNAIL_HEIGHT}
            previewAspectRatio={SIDEBAR_ASPECT_RATIO}
            renderFilePreview={renderFilePreview}
            width={SIDEBAR_THUMBNAIL_WIDTH}
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
  const {
    draggable,
    entries,
    getContextMenuActions,
    index,
    onContextMenuAction,
    onOpen,
    onSelect,
    renderEntryIcon,
    renderFilePreview,
    selectedEntry,
  } = props;
  const { onMarquee, selectedPaths, selectionMode, testID } = props;
  const [viewportWidth, setViewportWidth] = useState(0);
  // The filmstrip is the only surface a press lands on, and it runs in entry order.
  const orderedPaths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  const { onPress: activate, onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode, orderedPaths);
  const handleLayout = useCallback((event: LayoutChangeEvent) => setViewportWidth(event.nativeEvent.layout.width), []);
  const handleClearSelection = useCallback(() => onSelect(null), [onSelect]);

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
    <View className="flex-1 select-none" onLayout={handleLayout}>
      <View className="min-h-0 flex-1 flex-row">
        <View className="min-h-0 flex-1 items-center justify-center p-3">
          <GalleryStagePane
            {...props}
            entry={activeEntry}
            file={stagedFile}
            hasChildren={activeEntry?.kind === 'folder' && folderHasChildren(index, activeEntry)}
            width={stageWidth}
          />
        </View>
        {showSidebar && activeEntry ? (
          <GallerySidebar entry={activeEntry} index={index} renderFilePreview={renderFilePreview} sizeLabel={sizeLabel} />
        ) : null}
      </View>
      <FileSystemGalleryStrip
        activePath={activeEntry?.path ?? null}
        draggable={draggable}
        entries={entries}
        getContextMenuActions={getContextMenuActions}
        index={index}
        onActivate={activate}
        onClearSelection={handleClearSelection}
        onContextMenuAction={onContextMenuAction}
        onMarquee={onMarquee}
        onSelectLongPress={selectLongPress}
        renderEntryIcon={renderEntryIcon}
        renderFilePreview={renderFilePreview}
        selectedPaths={selectedPaths}
        selectionMode={selectionMode}
        testID={testID}
      />
    </View>
  );
}
