/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: the drop-target test id belongs with the node it names */
// Render layer for the icons view: one tile, and a row of them.
//
// The tile's contents live in their own component (IconTileFace) because the
// drag ghost has to be the same picture as the tile it was lifted from — glyph,
// label chip and all. Anything that would make the two diverge belongs in the
// face. The ghost itself is no longer drawn here: `<Draggable>` lifts the child
// it wraps, so a single-tile drag ghosts this very node, and a group drag ghosts
// what the manager's `renderPreview` returns.

import { useCallback } from 'react';
import { type GestureResponderEvent, Pressable, View } from 'react-native';
import { HeartLine as Heart } from 'rn-motion-ui-icons/icons/heart-line';
import { PinLine as Pin } from 'rn-motion-ui-icons/icons/pin-line';
import { cn } from '../../../lib/cn';
import { useThemeColors } from '../../../theme/use-theme-color';
import { useIsLifting } from '../../gestures/DragManager/multi-drag-scope';
import { MultiDraggable } from '../../gestures/DragManager/multi-draggable';
import type { DragzoneRenderState } from '../../gestures/drag.types';
import { HoldContextMenu } from '../../menus/HoldContextMenu/hold-context-menu';
import { Text } from '../../typography/Text/text';
import { FileSystemFolderGlyph } from './FileIcon/file-icons';
import type { FileSystemEntry, FileSystemExternalDropEvent, FileSystemMoveEvent } from './file-system.types';
import { useContextMenu } from './file-system-context-menu';
import { FileSystemDropzone } from './file-system-dropzone';
import { GLYPH_BOX_HEIGHT, GLYPH_BOX_WIDTH, ROW_GAP, TILE_HEIGHT } from './file-system-icons-grid';
import { fileSystemEntryTestID } from './file-system-test-id';
import type { FileSystemViewProps } from './file-system-view';
import { FileVisual } from './file-system-visual';
import { useEntryLongPress } from './use-entry-activation';

// Tile *geometry* lives in file-system-icons-grid.ts — the drag session resolves
// pointer positions with those constants, and the hover highlight derives the
// glyph box's rect from them, so no side can drift. What's here is glyph sizing,
// which only the render cares about.
const FOLDER_GLYPH_SIZE = 52;
/** Landscape thumbnails get the wider face so they fill the tile. */
const LANDSCAPE_RATIO = 1.2;
const PORTRAIT_TILE_WIDTH = 48;
const LANDSCAPE_TILE_WIDTH = 76;
const TILE_PREVIEW_RATIO = 0.78;

/** How faint the tile left behind under a drag reads. */
const DRAG_SOURCE_CLASSNAME = 'opacity-40';

/**
 * The label chip of the tile a drop would land in. Fixed rather than a prop, for
 * the same reason the hover highlight's test id is: a test asserting the drop
 * mark lands on the name under the glyph has to find this node and measure it.
 * Only present on the drop target, so the query stays unambiguous.
 */
export const FS_TILE_DROP_TARGET_TEST_ID = 'file-system-icons-drop-target';

type IconTileFaceProps = Pick<
  FileSystemViewProps,
  'loadPreviewImageUrl' | 'pageUrlCache' | 'renderEntryIcon' | 'renderFilePreview'
> & {
  entry: FileSystemEntry;
  /** A drop would land here — the label chip fills, under the hover-tinted glyph. */
  isDropTarget?: boolean;
  isSelected: boolean;
  width: number;
};

/**
 * A tile's contents: glyph box, then the label chip. Shared with the ghost.
 *
 * Two shapes carry every state. Hover tints the glyph box alone — as the sliding
 * highlight behind the tile, not a class here. Selection fills the glyph box and
 * turns the label chip solid. A pending drop fills the label chip the same way
 * selection does, so the folder about to receive the drop reads as the name
 * lighting up beneath a hovered glyph: no outline, nothing added to the layout,
 * just the two shapes the tile already has going up a strength.
 */
function IconTileFace({ entry, isDropTarget = false, isSelected, renderEntryIcon, width, ...visualProps }: IconTileFaceProps) {
  const isLandscape = entry.kind === 'file' && (entry.previewAspectRatio ?? 0) > LANDSCAPE_RATIO;
  const colors = useThemeColors();
  const active = isSelected || isDropTarget;

  return (
    <View className="items-center gap-1.5" style={{ height: TILE_HEIGHT, width }}>
      <View
        className={cn(
          'shrink-0 items-center justify-center rounded-lg p-1',
          isSelected ? 'bg-surface-selected' : isDropTarget && 'bg-surface-hover',
        )}
        style={{ height: GLYPH_BOX_HEIGHT, width: GLYPH_BOX_WIDTH }}
      >
        {entry.kind === 'folder'
          ? (renderEntryIcon?.(entry, FOLDER_GLYPH_SIZE) ?? <FileSystemFolderGlyph size={FOLDER_GLYPH_SIZE} />)
          : (renderEntryIcon?.(entry, GLYPH_BOX_HEIGHT) ?? (
              <FileVisual
                file={entry}
                previewAspectRatio={TILE_PREVIEW_RATIO}
                width={isLandscape ? LANDSCAPE_TILE_WIDTH : PORTRAIT_TILE_WIDTH}
                {...visualProps}
              />
            ))}
      </View>
      {/* The label chip carries two of the three states, and the same fill for
          both: a drop lands *in* this folder, so marking it the way selection
          does says "this one" without adding a third visual language.
          `self-center` shrinks the chip to its content width; `maxWidth` caps it
          at the tile boundary so long names still wrap rather than overflow. */}
      <View
        className={cn('self-center rounded-sm px-1.5 py-px', active && 'bg-info')}
        style={{ maxWidth: width }}
        testID={isDropTarget ? FS_TILE_DROP_TARGET_TEST_ID : undefined}
      >
        <Text
          className={cn('shrink text-center leading-tight', active ? 'text-white' : 'text-foreground')}
          numberOfLines={2}
          size="xs"
        >
          {entry.pinnedAt ? (
            <>
              <View style={{ height: 8, width: 8 }}>
                <Pin color={active ? colors.white : colors.primary} size={8} />
              </View>{' '}
            </>
          ) : null}
          {entry.name}
          {entry.favoritedAt ? (
            <>
              {' '}
              <View style={{ height: 8, width: 8 }}>
                <Heart color={active ? colors.white : colors.danger} size={8} />
              </View>
            </>
          ) : null}
        </Text>
      </View>
    </View>
  );
}

type IconTileProps = Omit<IconTileFaceProps, 'isDropTarget'> &
  Pick<FileSystemViewProps, 'getContextMenuActions' | 'onContextMenuAction'> & {
    /** Whether this view drags at all — off, and the tile is neither source nor target. */
    draggable: boolean;
    onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
    onExternalDrop?: (event: FileSystemExternalDropEvent) => void;
    onMove?: (event: FileSystemMoveEvent) => void;
    /** Long-press toggles this tile's selection; `undefined` leaves the gesture to the context menu. */
    onSelectLongPress?: (entry: FileSystemEntry) => void;
    /** Already resolved for this entry by `IconRow` — see `fileSystemEntryTestID`. */
    testID?: string;
  };

/**
 * One tile: a drag source always, and a drop target when it is a folder.
 *
 * The zone is nested inside the source rather than beside it, because a folder
 * tile is both ends of the gesture and the zone's box has to be exactly the
 * tile's for the rect hit test to agree with what the pointer is over.
 */
function IconTile({
  draggable,
  entry,
  getContextMenuActions,
  isSelected,
  onActivate,
  onContextMenuAction,
  onExternalDrop,
  onMove,
  onSelectLongPress,
  testID,
  width,
  ...faceProps
}: IconTileProps) {
  const handlePress = useCallback((event: GestureResponderEvent) => onActivate(entry, event), [entry, onActivate]);
  const { menuProps, onLongPress: openContextMenu } = useContextMenu(entry, getContextMenuActions, onContextMenuAction);
  const onLongPress = useEntryLongPress(entry, onSelectLongPress, openContextMenu);
  // Every tile the drag carries fades, not just the one that was grabbed — which
  // is the whole point of dragging a selection.
  const isDragSource = useIsLifting(entry.path);

  const face = (isDropTarget: boolean) => (
    <HoldContextMenu {...menuProps} style={{ width }}>
      <Pressable
        accessibilityLabel={entry.name}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        // See ListRow: native reads the state, web reads the ARIA attribute.
        aria-selected={isSelected}
        // The tile keeps its slot while dragged and just fades — the same "left
        // behind" cue a desktop file manager gives, and it keeps the grid from
        // reflowing under a drag that may still be cancelled.
        className={cn(isDragSource && DRAG_SOURCE_CLASSNAME)}
        onLongPress={onLongPress}
        onPress={handlePress}
        testID={testID}
      >
        {/* The source wears the selected face for the length of the drag: the
            sliding highlight has moved on by then, so without this the tiles the
            drag came from are the only cells on screen with no mark at all. */}
        <IconTileFace
          entry={entry}
          isDropTarget={isDropTarget}
          isSelected={isSelected || isDragSource}
          width={width}
          {...faceProps}
        />
      </Pressable>
    </HoldContextMenu>
  );

  return (
    <MultiDraggable disabled={!draggable} effectAllowed="move" id={entry.path}>
      {entry.kind === 'folder' ? (
        <FileSystemDropzone destination={entry.path} disabled={!draggable} onExternalDrop={onExternalDrop} onMove={onMove}>
          {({ isOver }: DragzoneRenderState) => face(isOver)}
        </FileSystemDropzone>
      ) : (
        face(false)
      )}
    </MultiDraggable>
  );
}

export type IconRowProps = Omit<IconTileProps, 'entry' | 'isSelected' | 'testID' | 'width'> & {
  row: FileSystemEntry[];
  selectedPaths: ReadonlySet<string>;
  tileWidth: number;
  /** The browser's root `testID`; each tile derives its own from it. */
  testID?: string;
};

export function IconRow({ row, selectedPaths, testID, tileWidth, ...tileProps }: IconRowProps) {
  return (
    <View className="flex-row gap-1" style={{ marginBottom: ROW_GAP }}>
      {row.map((entry) => (
        <IconTile
          entry={entry}
          isSelected={selectedPaths.has(entry.path)}
          key={entry.path}
          testID={fileSystemEntryTestID(testID, entry.path)}
          width={tileWidth}
          {...tileProps}
        />
      ))}
    </View>
  );
}
