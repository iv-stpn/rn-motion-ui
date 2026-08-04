/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: the drop-target test id belongs with the node it names */
// Render layer for the icons view: one tile, a row of them, and the drag ghost.
//
// The tile's contents live in their own component (IconTileFace) because the
// ghost has to be the same picture as the tile it was lifted from — glyph, label
// chip and all. Anything that would make the two diverge belongs in the face.

import { useCallback } from 'react';
import { Animated, type GestureResponderEvent, Pressable, View } from 'react-native';
import { cn } from '../../../lib/cn';
import { Heart, Pin } from '../../../lib/icons';
import { useThemeColors } from '../../../theme/use-theme-color';
import { HoldContextMenu } from '../../menus/HoldContextMenu/hold-context-menu';
import { Text } from '../../typography/Text/text';
import type { FileSystemEntry } from './file-system.types';
import { useContextMenu } from './file-system-context-menu';
import { FileSystemFolderGlyph } from './file-system-icons';
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

/** How far the lifted copy is scaled up, and how much of it shows through. */
const GHOST_SCALE = 1.06;
const GHOST_OPACITY = 0.85;
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

type IconTileProps = IconTileFaceProps &
  Pick<FileSystemViewProps, 'getContextMenuActions' | 'onContextMenuAction'> & {
    /** This tile is the one being dragged — faded, since the ghost now carries it. */
    isDragSource: boolean;
    onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
    /** Long-press toggles this tile's selection; `undefined` leaves the gesture to the context menu. */
    onSelectLongPress?: (entry: FileSystemEntry) => void;
    /** Already resolved for this entry by `IconRow` — see `fileSystemEntryTestID`. */
    testID?: string;
  };

function IconTile({
  entry,
  getContextMenuActions,
  isDragSource,
  isDropTarget,
  isSelected,
  onActivate,
  onContextMenuAction,
  onSelectLongPress,
  testID,
  width,
  ...faceProps
}: IconTileProps) {
  const handlePress = useCallback((event: GestureResponderEvent) => onActivate(entry, event), [entry, onActivate]);
  const { menuProps, onLongPress: openContextMenu } = useContextMenu(entry, getContextMenuActions, onContextMenuAction);
  const onLongPress = useEntryLongPress(entry, onSelectLongPress, openContextMenu);

  return (
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
        {/* The source wears the selected face for the length of the drag. The
            sliding highlight has moved to the drop target by then, and a pointer
            under capture sends no boundary events, so without this the tile the
            drag came from is the only cell on screen with no mark at all — even
            though it is still the subject of the gesture. */}
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
}

export type IconRowProps = Omit<IconTileProps, 'entry' | 'isDragSource' | 'isDropTarget' | 'isSelected' | 'testID' | 'width'> & {
  /** Paths the drag is carrying, so every tile it lifted can fade — not just the one under the pointer. */
  draggedPaths: ReadonlySet<string>;
  /** Path of the folder under the pointer, so its tile can outline. */
  dragTargetPath: string | null;
  row: FileSystemEntry[];
  selectedPaths: ReadonlySet<string>;
  tileWidth: number;
  /** The browser's root `testID`; each tile derives its own from it. */
  testID?: string;
};

export function IconRow({ draggedPaths, dragTargetPath, row, selectedPaths, testID, tileWidth, ...tileProps }: IconRowProps) {
  return (
    <View className="flex-row gap-1" style={{ marginBottom: ROW_GAP }}>
      {row.map((entry) => (
        <IconTile
          entry={entry}
          isDragSource={draggedPaths.has(entry.path)}
          isDropTarget={entry.path === dragTargetPath}
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

export type DragGhostProps = Omit<IconTileFaceProps, 'isDropTarget' | 'isSelected'> & { pos: Animated.ValueXY };

/**
 * The lifted copy of the dragged tile, tracking the pointer. Its position comes
 * from an `Animated.ValueXY` the drag session writes to directly, so the whole
 * drag runs without a React re-render. The translate is listed before the scale
 * so the grow happens about the ghost's own centre instead of also shifting it.
 *
 * Always painted selected, and never a drop target: it is the picture lifted off
 * the source tile, which wears the selected face for the length of the drag, and
 * a ghost is the subject of the gesture rather than a destination for it.
 */
export function DragGhost({ pos, ...faceProps }: DragGhostProps) {
  return (
    <Animated.View
      style={{
        left: 0,
        opacity: GHOST_OPACITY,
        pointerEvents: 'none',
        position: 'absolute',
        top: 0,
        transform: [...pos.getTranslateTransform(), { scale: GHOST_SCALE }],
        zIndex: 4,
      }}
    >
      <IconTileFace isSelected={true} {...faceProps} />
    </Animated.View>
  );
}
