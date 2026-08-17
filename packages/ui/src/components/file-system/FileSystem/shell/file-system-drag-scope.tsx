/** biome-ignore-all lint/style/useComponentExportOnlyModules: the ghost is only ever rendered by the scope below it */
// The one <MultiDragManager> every FileSystem drag runs under.
//
// Three jobs, all of which need a place in the tree rather than a hook:
//
// 1. The selection. A row knows it is selected; it does not know the other two
//    selected rows exist. The manager holds the set, so lifting any member carries
//    all of them and the ones left behind can ask `useIsLifting` whether they are
//    moving too.
// 2. The payload. `getGroupData` resolves paths against the index once per lift, so
//    every destination reads the same entries off the transfer no matter which view
//    the drop landed in — or whether it landed in this component at all.
// 3. The ghost's frame. Every view drags out of a scroll container, and a ghost
//    drawn inside one is clipped at its edge. The manager draws it in its own box
//    instead, which spans the whole file area.

import { type ReactNode, type RefObject, useCallback, useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { ArrowRightLine } from 'rn-motion-ui-icons/icons/arrow-right-line';
import { useThemeColors } from '../../../../theme/use-theme-color';
import { readMultiDragIds } from '../../../gestures/DragManager/multi-drag';
import { MultiDragManager } from '../../../gestures/DragManager/multi-drag-manager';
import type { DragRect } from '../../../gestures/drag.types';
import { ghostOffset } from '../../../gestures/drag-geometry';
import { getDragSnapshot } from '../../../gestures/drag-store';
import { useDragMove, useDragSnapshot } from '../../../gestures/use-drag-store';
import { Text } from '../../../typography/Text/text';
import { FileSystemFolderGlyph, FileTypeIcon } from '../../FileIcon/file-icons';
import { type FileSystemDragItem, fileSystemDragData, fileSystemDragItems, fileSystemDragLabel } from '../logic/file-system-drag';
import { useFileSystemEntries, useFileSystemSelection, useFileSystemSelectionActions } from '../store/file-system-context';
import { FileSystemDropIndicator } from './file-system-drop-indicator';
import { zoneDestinationFor } from './file-system-dropzone';

type FileSystemGroupGhostProps = { items: readonly FileSystemDragItem[] };

/** Sizing for the icons inside a group ghost chip. */
const GHOST_ICON_SIZE = 14;
const GHOST_FOLDER_GLYPH_SIZE = 14;
/** How far each stacked icon offsets from the one beneath it (px). */
const STACK_OFFSET = 6;
/** How many items to show in the stack. */
const STACK_DEPTH = 3;

/**
 * The ghost for a multi-entry drag: a visual stack of (at most) the first three
 * items, plus a count label.
 *
 * Each icon is a folder glyph or a file-type icon — no thumbnail lookup, because
 * the drag payload carries only names and paths, not URLs. The stack reads like
 * the physical deck of items a file manager would show under the cursor.
 *
 * A single-entry drag has no ghost of its own here — `renderPreview` returns
 * nothing for it, and a `<Draggable>` given no preview lifts a copy of its own
 * child. So dragging one row shows that row, which is both free and the better
 * picture.
 */
function FileSystemGroupGhost({ items }: FileSystemGroupGhostProps) {
  const visible = items.slice(0, STACK_DEPTH);

  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-md border border-border bg-surface-4 px-2 py-1.5">
      {/* Stacked icon deck: back-to-front, each offset slightly right of the last. */}
      <View
        className="relative"
        style={{
          height: GHOST_ICON_SIZE + STACK_OFFSET * (visible.length - 1),
          width: GHOST_ICON_SIZE + STACK_OFFSET * (visible.length - 1),
        }}
      >
        {visible.map((item, i) => {
          const left = i * STACK_OFFSET;
          const top = (visible.length - 1 - i) * STACK_OFFSET;
          return (
            <View
              className="absolute rounded-sm bg-surface-2"
              key={item.path}
              style={{ height: GHOST_ICON_SIZE, left, top, width: GHOST_ICON_SIZE }}
            >
              {item.kind === 'folder' ? (
                <FileSystemFolderGlyph size={GHOST_FOLDER_GLYPH_SIZE} />
              ) : (
                <FileTypeIcon fileName={item.name} size={GHOST_ICON_SIZE} />
              )}
            </View>
          );
        })}
      </View>
      <Text className="text-foreground" numberOfLines={1} size="xs">
        {fileSystemDragLabel(items)}
      </Text>
    </View>
  );
}

/** How far below the ghost's bottom edge the drop-hint chip sits. */
const DROP_HINT_OFFSET = 8;

type FileSystemDropHintProps = { containerRef: RefObject<View | null> };

/**
 * The "→ Move into <folder>" chip that follows the drag ghost while a drag hangs
 * over a folder — the Windows Explorer drop cue, on every view.
 *
 * Position mirrors the manager's ghost placement (see `DragManagerOverlay`):
 * the ghost is anchored to the grab point within the source rect under a pan
 * transport, and to the cursor with the source's left edge under HTML5. The chip
 * rides a fixed offset below the ghost's bottom edge, on the same move channel
 * the ghost moves on, so it tracks the pointer without a single re-render.
 */
function FileSystemDropHint({ containerRef }: FileSystemDropHintProps) {
  const { drag, overZoneId } = useDragSnapshot();
  const { index } = useFileSystemEntries();
  const colors = useThemeColors();
  const pos = useRef(new Animated.ValueXY()).current;
  const frameRef = useRef<DragRect | null>(null);

  // The manager re-measures its own frame at lift; the hint needs the same
  // window→frame conversion, so re-measure the shared container once per drag.
  // biome-ignore lint/plugin: measuring the container for an animated overlay is a layout side-effect, not derived render state
  useEffect(() => {
    if (drag === null) return;
    const node = containerRef.current;
    if (node === null) return;
    node.measureInWindow((x, y, width, height) => {
      frameRef.current = { height, width, x, y };
    });
  }, [containerRef, drag]);

  useDragMove((point) => {
    const activeDrag = getDragSnapshot().drag;
    const frame = frameRef.current;
    if (activeDrag === null || frame === null) return;
    const { grab, rect } = activeDrag.origin;
    const sourceX = rect?.x ?? grab.x;
    let ghostX: number;
    let ghostY: number;
    if (activeDrag.transport === 'html5') {
      ghostX = sourceX - frame.x + (point.x - grab.x);
      ghostY = point.y - frame.y;
    } else {
      const offset = ghostOffset({ grab, host: frame, origin: rect, point });
      ghostX = offset.x;
      ghostY = offset.y;
    }
    pos.setValue({ x: ghostX, y: ghostY + (rect?.height ?? 0) + DROP_HINT_OFFSET });
  });

  if (drag === null || overZoneId === null) return null;
  const destination = zoneDestinationFor(overZoneId);
  // No hint over the root or an unknown zone — there is no folder name to say.
  if (destination === undefined || destination === '') return null;
  const folder = index.folders.get(destination);
  if (folder === undefined) return null;

  return (
    <Animated.View
      className="pointer-events-none absolute top-0 left-0 z-[60]"
      pointerEvents="none"
      style={{ transform: pos.getTranslateTransform() }}
    >
      <View className="flex-row items-center gap-1.5 self-start rounded-md border border-border bg-surface-4 px-2 py-1.5">
        <ArrowRightLine color={colors['muted-foreground']} size={14} />
        <Text className="text-foreground" numberOfLines={1} size="xs">
          {`Move into ${folder.name}`}
        </Text>
      </View>
    </Animated.View>
  );
}

export type FileSystemDragScopeProps = { children: ReactNode };

/**
 * Wraps the file area in the manager its `<MultiDraggable>`s and `<Dragzone>`s
 * need. Mounted once, around the body, by `<FileSystem>` itself.
 *
 * **Not isolated.** A drag lifted here can land on any `<Dragzone>` on the page:
 * a sidebar's trash, an upload panel, the other pane of a two-pane manager. That
 * is the point of publishing the entries under a MIME type rather than passing
 * them in memory, and a zone that does not want them refuses in its own `accepts`.
 * The flip side is that two FileSystems on one page can drop into each other —
 * correct when they show the same tree, and a consumer that means them to be
 * independent isolates them with a `<DragManager isolate>` of its own.
 */
export function FileSystemDragScope({ children }: FileSystemDragScopeProps) {
  const { index } = useFileSystemEntries();
  const { selectedPaths } = useFileSystemSelection();
  const { clearSelection } = useFileSystemSelectionActions();
  const containerRef = useRef<View | null>(null);

  // Resolved against the index at lift time rather than carried on each row: a
  // group's payload has to describe entries whose own components were never asked
  // anything, and only the index has all of them.
  const getGroupData = useCallback((paths: readonly string[]) => fileSystemDragData(fileSystemDragItems(index, paths)), [index]);

  const renderPreview = useCallback(
    (paths: readonly string[]) => {
      if (paths.length < 2) return null;
      return <FileSystemGroupGhost items={fileSystemDragItems(index, paths)} />;
    },
    [index],
  );

  // When a drag starts from an unselected item, clear any prior selection so the
  // stale highlight doesn't read as "this is all moving too". The lifted item's
  // identity is not on the source — `drag.source.id` is the `<Draggable>`'s own
  // id, never an entry path. The ids the lift actually carries are on the transfer,
  // and `defaultResolveIds` makes those exactly the selection when the lifted item
  // was selected, and just that item when it was not.
  const handleDragStart = useCallback(
    ({ drag }: import('../../../gestures/drag.types').DragManagerEvent) => {
      const carried = readMultiDragIds(drag.transfer);
      const liftsSelection = carried.length === selectedPaths.size && carried.every((id) => selectedPaths.has(id));
      if (!liftsSelection) clearSelection();
    },
    [clearSelection, selectedPaths],
  );

  return (
    <View className="min-h-0 flex-1" ref={containerRef}>
      <MultiDragManager
        className="min-h-0 flex-1"
        getGroupData={getGroupData}
        onDragStart={handleDragStart}
        renderPreview={renderPreview}
        selectedIds={selectedPaths}
      >
        {children}
        {/* The shared drop outline, one leaf over the whole file area. Inside the
            manager so it shares the manager's scope — that is how it tells this
            instance's zones from a second FileSystem's on the same page. Rows no
            longer paint their own — see file-system-drop-indicator. */}
        <FileSystemDropIndicator containerRef={containerRef} />
      </MultiDragManager>
      <FileSystemDropHint containerRef={containerRef} />
    </View>
  );
}
