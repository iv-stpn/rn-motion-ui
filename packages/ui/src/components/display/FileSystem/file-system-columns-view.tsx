// The columns view: Finder's browser, one pane per level of the selection
// trail, with a preview pane for a selected file. The web original drove the
// trail from keyboard focus and a deferred value; here selection alone builds
// it and the horizontal scroll follows the deepest pane.

import { useCallback, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, ScrollView, View } from 'react-native';
import { Text } from '../../typography/Text/text';
import type { FileEntry, FileSystemEntry } from './file-system.types';
import { COLUMN_WIDTH, FileSystemColumn } from './file-system-column';
import { formatByteSize } from './file-system-format';
import { FileSystemInformation } from './file-system-information';
import { fileKindLabel } from './file-system-kinds';
import type { FileSystemViewProps } from './file-system-view';
import { FileVisual } from './file-system-visual';
import { useEntryActivation } from './use-entry-activation';

/** Preview pane geometry (px). */
const PREVIEW_MIN_WIDTH = 240;
const PREVIEW_MAX_WIDTH = 512;
const PREVIEW_PADDING = 16;
const PREVIEW_ASPECT_RATIO = 0.78;
const KIND_SIZE_SEPARATOR = ' · ';

/**
 * The folder paths the trail walks through, root-first: the current folder plus
 * one pane per segment down to the selected entry's folder.
 */
function trailColumnPaths(currentPath: string, selectedEntry: FileSystemEntry | null): string[] {
  const paths = [currentPath];
  if (!selectedEntry?.path.startsWith(currentPath)) return paths;

  const targetFolder = selectedEntry.kind === 'folder' ? selectedEntry.path : selectedEntry.parentPath;
  let walkedPath = currentPath;

  for (const segment of targetFolder.slice(currentPath.length).split('/')) {
    if (segment) {
      walkedPath = `${walkedPath}${segment}/`;
      paths.push(walkedPath);
    }
  }
  return paths;
}

type PreviewPaneProps = Pick<FileSystemViewProps, 'index' | 'loadPreviewImageUrl' | 'pageUrlCache' | 'renderFilePreview'> & {
  file: FileEntry;
  /** Measured viewport width, so the thumbnail can grow with the pane. */
  viewportWidth: number;
};

/** The trailing pane for a selected file: thumbnail, name, kind and metadata. */
function PreviewPane({ file, index, viewportWidth, ...visualProps }: PreviewPaneProps) {
  const size = formatByteSize(file.size);
  const kindLabel = fileKindLabel(file);
  const subtitle = size ? `${kindLabel}${KIND_SIZE_SEPARATOR}${size}` : kindLabel;
  const paneWidth = Math.max(PREVIEW_MIN_WIDTH, Math.min(PREVIEW_MAX_WIDTH, viewportWidth - COLUMN_WIDTH));
  const visualWidth = Math.round(paneWidth - PREVIEW_PADDING * 2);

  return (
    <ScrollView
      className="shrink-0"
      contentContainerClassName="items-center gap-3 p-4"
      showsVerticalScrollIndicator={false}
      style={{ width: paneWidth }}
    >
      <FileVisual file={file} pageable={true} previewAspectRatio={PREVIEW_ASPECT_RATIO} width={visualWidth} {...visualProps} />
      <View className="w-full items-center">
        <Text className="text-center" size="sm" weight="semibold">
          {file.name}
        </Text>
        <Text className="text-center text-muted-foreground" size="xs">
          {subtitle}
        </Text>
      </View>
      <View className="w-full">
        <FileSystemInformation entry={file} index={index} />
      </View>
    </ScrollView>
  );
}

export function FileSystemColumnsView({
  currentPath,
  getContextMenuActions,
  index,
  loadPreviewImageUrl,
  loadingFolders,
  onContextMenuAction,
  onMarquee,
  onOpen,
  onSelect,
  pageUrlCache,
  renderFilePreview,
  selectedEntry,
  selectedPaths,
  selectionMode,
  testID,
}: FileSystemViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const { onPress: activate, onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode);
  const handleClearSelection = useCallback(() => onSelect(null), [onSelect]);
  const columnPaths = useMemo(() => trailColumnPaths(currentPath, selectedEntry), [currentPath, selectedEntry]);
  const selectedFile = selectedEntry?.kind === 'file' ? selectedEntry : null;

  const handleLayout = useCallback((event: LayoutChangeEvent) => setViewportWidth(event.nativeEvent.layout.width), []);

  // A deeper selection scrolls the newest pane into view, the way Finder keeps
  // the active column at the right edge.
  const handleContentSizeChange = useCallback(() => scrollRef.current?.scrollToEnd({ animated: true }), []);

  return (
    <ScrollView
      className="flex-1 select-none"
      contentContainerClassName="grow"
      horizontal={true}
      onContentSizeChange={handleContentSizeChange}
      onLayout={handleLayout}
      ref={scrollRef}
      showsHorizontalScrollIndicator={false}
    >
      {columnPaths.map((columnPath, columnIndex) => (
        <FileSystemColumn
          entries={index.children.get(columnPath) ?? []}
          getContextMenuActions={getContextMenuActions}
          index={index}
          isLoading={loadingFolders.has(columnPath)}
          key={columnPath || '(root)'}
          onActivate={activate}
          onClearSelection={handleClearSelection}
          onContextMenuAction={onContextMenuAction}
          onMarquee={onMarquee}
          onSelectLongPress={selectLongPress}
          selectedPaths={selectedPaths}
          selectionMode={selectionMode}
          testID={testID}
          trailChildPath={columnPaths[columnIndex + 1] ?? null}
        />
      ))}
      {selectedFile ? (
        <PreviewPane
          file={selectedFile}
          index={index}
          loadPreviewImageUrl={loadPreviewImageUrl}
          pageUrlCache={pageUrlCache}
          renderFilePreview={renderFilePreview}
          viewportWidth={viewportWidth}
        />
      ) : null}
    </ScrollView>
  );
}
