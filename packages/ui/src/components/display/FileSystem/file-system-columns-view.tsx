// The columns view: Finder's browser, one pane per level of the selection
// trail, with a preview pane for a selected file. The web original drove the
// trail from keyboard focus and a deferred value; here selection alone builds
// it and the horizontal scroll follows the deepest pane.

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Text } from '../../typography/Text/text';
import type { FileEntry, FileSystemEntry } from './file-system.types';
import { COLUMN_WIDTH, FileSystemColumn } from './file-system-column';
import { formatByteSize } from './file-system-format';
import { FileSystemInformation } from './file-system-information';
import { fileKindLabel } from './file-system-kinds';
import type { FileSystemViewProps } from './file-system-view';
import { FileVisual } from './file-system-visual';
import { useEntryActivation } from './use-entry-activation';
import { columnDragStateFor, useFileSystemColumnsDrag } from './use-file-system-columns-drag';
import { useFileSystemDragWeb } from './use-file-system-drag-web';

/** Preview pane geometry (px). */
const PREVIEW_MIN_WIDTH = 240;
const PREVIEW_MAX_WIDTH = 512;

// `touchAction` has no Tailwind utility and is absent from RN's ViewStyle, so
// it stays an inline web style — clamped only during a drag, so ordinary touch
// scrolling is unaffected the rest of the time.
type WebViewStyle = import('react-native').ViewStyle & { touchAction?: string };
const WEB_DRAGGING_STYLE: WebViewStyle | null = Platform.OS === 'web' ? { touchAction: 'none' } : null;
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

type DragPreviewProps = { label: string; pos: Animated.ValueXY };

/** Floating label chip that tracks the pointer during a drag (no re-renders). */
function DragPreview({ label, pos }: DragPreviewProps) {
  return (
    <Animated.View className="pointer-events-none absolute top-0 left-0 z-[4]" style={{ transform: pos.getTranslateTransform() }}>
      <View className="rounded-md border border-border bg-surface-4 px-2 py-1">
        <Text className="text-foreground" numberOfLines={1} size="xs">
          {label}
        </Text>
      </View>
    </Animated.View>
  );
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
  const handleClearSelection = useCallback(() => onSelect(null), [onSelect]);
  const columnPaths = useMemo(() => trailColumnPaths(currentPath, selectedEntry), [currentPath, selectedEntry]);
  const selectedFile = selectedEntry?.kind === 'file' ? selectedEntry : null;

  // Refs for drag geometry — mutable, never cause re-renders.
  const containerRef = useRef<View | null>(null);
  const containerHeightRef = useRef(0);
  const horizontalScrollOffsetRef = useRef(0);
  const columnScrollOffsetsRef = useRef<number[]>([]);

  const { drag, session, nativeGesture, previewPos } = useFileSystemColumnsDrag({
    columnPaths,
    columnScrollOffsetsRef,
    containerHeightRef,
    containerRef,
    enabled: draggable ?? false,
    horizontalScrollOffsetRef,
    index,
    onMove,
    selectedPaths,
  });
  useFileSystemDragWeb({ containerRef, enabled: draggable ?? false, session });

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportWidth(event.nativeEvent.layout.width);
    containerHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  const handleHorizontalScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    horizontalScrollOffsetRef.current = e.nativeEvent.contentOffset.x;
  }, []);

  // Stable per-column scroll-offset callbacks, keyed by index. Created lazily
  // so FileSystemColumn's React.memo is not defeated by a new function reference
  // on every render.
  const scrollOffsetHandlersRef = useRef(new Map<number, (offset: number) => void>());
  const getScrollOffsetHandler = useCallback((colIdx: number) => {
    const existing = scrollOffsetHandlersRef.current.get(colIdx);
    if (existing) return existing;
    const handler = (offset: number) => {
      columnScrollOffsetsRef.current[colIdx] = offset;
    };
    scrollOffsetHandlersRef.current.set(colIdx, handler);
    return handler;
  }, []);
  // the active column at the right edge.
  const handleContentSizeChange = useCallback(() => scrollRef.current?.scrollToEnd({ animated: true }), []);

  const scrollView = (
    <ScrollView
      ref={scrollRef}
      className="flex-1 select-none"
      contentContainerClassName="grow"
      horizontal={true}
      onContentSizeChange={handleContentSizeChange}
      onScroll={handleHorizontalScroll}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
    >
      {columnPaths.map((columnPath, columnIndex) => (
        <FileSystemColumn
          dragState={columnDragStateFor(columnIndex, drag)}
          entries={index.children.get(columnPath) ?? []}
          getContextMenuActions={getContextMenuActions}
          index={index}
          isLoading={loadingFolders.has(columnPath)}
          key={columnPath || '(root)'}
          onActivate={activate}
          onClearSelection={handleClearSelection}
          onContextMenuAction={onContextMenuAction}
          onMarquee={onMarquee}
          onScrollOffsetChange={getScrollOffsetHandler(columnIndex)}
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

  return (
    <View
      ref={containerRef}
      className="flex-1"
      onLayout={handleLayout}
      // Prevent the browser's scroll gesture from stealing the pointer while a
      // drag is in flight — pointer capture alone is not enough on touch web.
      style={drag.active ? (WEB_DRAGGING_STYLE ?? undefined) : undefined}
    >
      {nativeGesture === null ? scrollView : <GestureDetector gesture={nativeGesture}>{scrollView}</GestureDetector>}
      {drag.active ? <DragPreview label={drag.previewLabel} pos={previewPos} /> : null}
    </View>
  );
}
