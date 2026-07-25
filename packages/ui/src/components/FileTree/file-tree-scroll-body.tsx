/** biome-ignore-all lint/style/useExportsLast: props type sits with its component */
// The scrolling body of the tree: the virtualized FlatList plus the two layers
// that ride on top of it — the pinned sticky-header overlay and, while a drag is
// live, a drop-target highlight and a floating label preview. Split out of
// file-tree.tsx so each concern stays small and the scroll/gesture state lives
// next to the list it drives.
//
// Scroll offset is mirrored into both a ref (read synchronously by the drag
// hit-test every gesture frame) and — only when a feature needs it — React
// state (so the sticky stack + drop highlight reposition). Row rendering is
// delegated back to the parent's `renderRow` builder so a sticky header and a
// scrolled row are pixel-identical and share one set of handlers.

import { type ReactElement, type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import type { ListRenderItemInfo, NativeScrollEvent, NativeSyntheticEvent, ViewStyle } from 'react-native';
import { Animated, FlatList, Platform, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Text } from '../Text/text';
import type { FileTreeVisibleRow } from './file-tree.types';
import { computeStickyHeaders } from './file-tree-layout';
import { FileTreeStickyHeaders } from './file-tree-sticky-headers';
import { useFileTreeDrag } from './use-file-tree-drag';
import { useFileTreeDragWeb } from './use-file-tree-drag-web';

export type FileTreeScrollBodyProps = {
  rows: FileTreeVisibleRow[];
  itemHeight: number;
  bodyHeight: number;
  /** Builds one row element from a bare row (shared by the list + sticky stack). */
  renderRow: (row: FileTreeVisibleRow) => ReactNode;
  keyExtractor: (row: FileTreeVisibleRow) => string;
  getItemLayout: (
    data: ArrayLike<FileTreeVisibleRow> | null | undefined,
    index: number,
  ) => { length: number; offset: number; index: number };
  /** Pin ancestor directory rows to the top while scrolling. */
  stickyEnabled: boolean;
  /** Wire long-press → pan drag-and-drop. */
  draggable: boolean;
  /** Read the current selection (a selected row drags the whole selection). */
  getSelected: () => Set<string>;
  /** Commit a resolved move (from `useSyncedFileTree`). */
  commitMove: (dragged: Iterable<string>, targetPath: string | null) => void;
  /** Shown by the list when no rows project (an element — `FileTree` wraps its own). */
  emptyState: ReactElement;
  testID?: string;
};

/** Offset (px) of the drag preview chip from the finger so it isn't occluded. */
const PREVIEW_MARGIN = { marginLeft: 14, marginTop: -10 };

// Web-only style prop (`userSelect` isn't in RN's ViewStyle). Applied while a drag
// is live so the pointer doesn't paint a text selection across the rows it
// crosses; inert on native.
type WebViewStyle = ViewStyle & { userSelect?: string };
const WEB_DRAGGING_STYLE: WebViewStyle = { userSelect: 'none' };

type DropHighlightProps = { rows: FileTreeVisibleRow[]; dropTargetPath: string | null; itemHeight: number; scrollOffset: number };

/** A border box over the row currently under the finger (drop feedback). */
function DropHighlight({ rows, dropTargetPath, itemHeight, scrollOffset }: DropHighlightProps) {
  if (!dropTargetPath) return null;
  const index = rows.findIndex((row) => row.path === dropTargetPath);
  if (index < 0) return null;
  return (
    <View
      pointerEvents="none"
      className="absolute right-0 left-0 rounded-sm border-2 border-primary"
      style={{ top: index * itemHeight - scrollOffset, height: itemHeight, zIndex: 3 }}
    />
  );
}

type DragPreviewProps = { label: string; pos: Animated.ValueXY };

/** The floating label chip that tracks the finger during a drag (no re-renders). */
function DragPreview({ label, pos }: DragPreviewProps) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, zIndex: 4, transform: pos.getTranslateTransform() }}
    >
      <View className="rounded-md border border-border bg-surface-4 px-2 py-1" style={PREVIEW_MARGIN}>
        <Text numberOfLines={1} className="text-foreground text-xs">
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * The virtualized list with the sticky-header and drag layers composed over it.
 * The FlatList is wrapped in a `<GestureDetector>` only when `draggable`; the
 * pan gesture activates after a long-press so ordinary scrolling is untouched
 * until then. Sticky headers + the drop highlight need the live scroll offset,
 * so it's tracked in state only when one of those features is on (otherwise the
 * drag hit-test reads the ref alone and no scroll-driven re-render happens).
 */
export function FileTreeScrollBody(props: FileTreeScrollBodyProps) {
  const { rows, itemHeight, bodyHeight, renderRow, keyExtractor, getItemLayout } = props;
  const { stickyEnabled, draggable, getSelected, commitMove, emptyState, testID } = props;

  const listRef = useRef<FlatList<FileTreeVisibleRow> | null>(null);
  const containerRef = useRef<View | null>(null);
  const scrollOffsetRef = useRef(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const tracksOffset = stickyEnabled || draggable;

  const drag = useFileTreeDrag({
    enabled: draggable,
    rows,
    itemHeight,
    viewportHeight: bodyHeight,
    scrollOffsetRef,
    listRef,
    getSelected,
    commitMove,
  });
  useFileTreeDragWeb({ enabled: draggable, containerRef, session: drag.session });

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = offset;
      if (tracksOffset) setScrollOffset(offset);
    },
    [tracksOffset],
  );

  // Wrap in a fragment so the callback's return type is a ReactElement (FlatList's
  // renderItem rejects the broader ReactNode that renderRow is typed to return).
  const renderItem = useCallback(({ item }: ListRenderItemInfo<FileTreeVisibleRow>) => <>{renderRow(item)}</>, [renderRow]);
  const sticky = useMemo(
    () => (stickyEnabled ? computeStickyHeaders(rows, scrollOffset, itemHeight) : null),
    [stickyEnabled, rows, scrollOffset, itemHeight],
  );

  const list = (
    <FlatList
      ref={listRef}
      data={rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      extraData={renderRow}
      onScroll={tracksOffset ? onScroll : undefined}
      scrollEventThrottle={16}
      style={{ height: bodyHeight }}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={emptyState}
      removeClippedSubviews={true}
      testID={`${testID ?? 'file-tree'}-list`}
    />
  );
  // A long-press pan can only fire when the detector wraps the list, so only pay
  // for it when dragging is on; otherwise the bare FlatList scrolls unimpeded. On
  // web the detector is skipped entirely — `useFileTreeDragWeb` drives the same
  // session from pointer events on the container instead (see that file for why).
  const useNativePan = draggable && Platform.OS !== 'web';
  const body = useNativePan ? <GestureDetector gesture={drag.gesture}>{list}</GestureDetector> : list;

  return (
    <View
      ref={containerRef}
      className="relative"
      style={[{ height: bodyHeight }, drag.render.active ? WEB_DRAGGING_STYLE : null]}
    >
      {body}
      {sticky ? (
        <FileTreeStickyHeaders
          headers={sticky.headers}
          transition={sticky.transition}
          itemHeight={itemHeight}
          renderRow={renderRow}
        />
      ) : null}
      {drag.render.active ? (
        <>
          <DropHighlight
            rows={rows}
            dropTargetPath={drag.render.dropTargetPath}
            itemHeight={itemHeight}
            scrollOffset={scrollOffset}
          />
          <DragPreview label={drag.render.label} pos={drag.render.previewPos} />
        </>
      ) : null}
    </View>
  );
}
