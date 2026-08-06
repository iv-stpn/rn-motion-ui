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
  draggable,
  getContextMenuActions,
  index,
  loadPreviewImageUrl,
  loadingFolders,
  onContextMenuAction,
  onExternalDrop,
  onMarquee,
  onMove,
  onOpen,
  onSelect,
  pageUrlCache,
  renderEntryIcon,
  renderFilePreview,
  selectedEntry,
  selectedPaths,
  selectionMode,
  testID,
}: FileSystemViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const { onPress: activate, onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode);
  const columnPaths = useMemo(() => trailColumnPaths(currentPath, selectedEntry), [currentPath, selectedEntry]);
  const selectedFile = selectedEntry?.kind === 'file' ? selectedEntry : null;

  const handleLayout = useCallback((event: LayoutChangeEvent) => setViewportWidth(event.nativeEvent.layout.width), []);

  // Stable per-column marquee callbacks, keyed by index. Each one injects the
  // trail paths (the parent folders that opened this sub-column) into the base
  // so a marquee in a sub-column never clears the trail selection — which would
  // collapse the column it's running inside. Column 0 has no trail to protect
  // and falls through to the raw onMarquee unchanged.
  const columnPathsRef = useRef(columnPaths);
  columnPathsRef.current = columnPaths;
  const onMarqueeRef = useRef(onMarquee);
  onMarqueeRef.current = onMarquee;
  const marqueeHandlersRef = useRef(new Map<number, (covered: readonly string[], base: ReadonlySet<string> | null) => void>());
  const getMarqueeHandler = useCallback((colIdx: number) => {
    const existing = marqueeHandlersRef.current.get(colIdx);
    if (existing) return existing;
    const handler = (covered: readonly string[], base: ReadonlySet<string> | null) => {
      // columnPaths[1..colIdx] are the folders selected in the parent columns —
      // they must stay selected or the trail collapses under the marquee.
      const trailPaths = columnPathsRef.current.slice(1, colIdx + 1);
      if (trailPaths.length === 0) {
        onMarqueeRef.current(covered, base);
        return;
      }
      const fullBase = base ? new Set([...base, ...trailPaths]) : new Set(trailPaths);
      onMarqueeRef.current(covered, fullBase);
    };
    marqueeHandlersRef.current.set(colIdx, handler);
    return handler;
  }, []);
  // A pane opening at the far right scrolls itself into view, so pressing into a
  // deep trail keeps the active column at the right edge.
  const handleContentSizeChange = useCallback(() => scrollRef.current?.scrollToEnd({ animated: true }), []);

  const scrollView = (
    <ScrollView
      ref={scrollRef}
      className="flex-1 select-none"
      contentContainerClassName="grow"
      horizontal={true}
      onContentSizeChange={handleContentSizeChange}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
    >
      {columnPaths.map((columnPath, columnIndex) => (
        <FileSystemColumn
          draggable={draggable ?? false}
          entries={index.children.get(columnPath) ?? []}
          folderPath={columnPath}
          getContextMenuActions={getContextMenuActions}
          index={index}
          isLoading={loadingFolders.has(columnPath)}
          key={columnPath || '(root)'}
          onActivate={activate}
          onContextMenuAction={onContextMenuAction}
          onExternalDrop={onExternalDrop}
          onMarquee={getMarqueeHandler(columnIndex)}
          onMove={onMove}
          onSelectLongPress={selectLongPress}
          renderEntryIcon={renderEntryIcon}
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

  // No drop zone at this level: each pane owns one for the folder it displays, so
  // a trail is droppable at every step. A view-wide fallback would have to pick a
  // single destination, and the columns view is precisely the one with no single
  // current folder.
  return (
    <View className="flex-1" onLayout={handleLayout}>
      {scrollView}
    </View>
  );
}
