import { useCallback, useMemo, useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import type { FileSystemContextMenuAction, FileSystemEntry, FileSystemItem } from './file-system.types';
import { useContextMenu } from './file-system-context-menu';

export type FileSystemRowInteractionOptions = {
  entry: FileSystemEntry;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  /** Long-press toggles this row/tile's selection; `undefined` leaves the gesture to the context menu. */
  onSelectLongPress?: (entry: FileSystemEntry) => void;
};

export type FileSystemRowInteractionReturn = {
  dragOptions: undefined;
  handleOpenChange: (open: boolean) => void;
  handlePress: (event: GestureResponderEvent) => void;
  handlePressIn: () => void;
  menuProps: ReturnType<typeof useContextMenu>['menuProps'];
  onHoldAction: (() => void) | undefined;
};

/**
 * Context menu + hold-prevention bookkeeping shared by every row and tile across
 * all five FileSystem views.
 *
 * The hold gesture must not also register as a tap, so the menu-open callback
 * sets a flag that the press handler checks. In multi-select mode the same hold
 * toggles selection instead of opening the menu — `onHoldAction` captures that
 * branch.
 *
 * `dragOptions` is always `undefined` here; views that need multi-drag payloads
 * layer {@link useFileSystemDragOptions} on top.
 */
export function useFileSystemRowInteraction({
  entry,
  getContextMenuActions,
  onActivate,
  onContextMenuAction,
  onSelectLongPress,
}: FileSystemRowInteractionOptions): FileSystemRowInteractionReturn {
  const { menuProps } = useContextMenu(entry, getContextMenuActions, onContextMenuAction);

  // A hold (menu-open or multi-select toggle) must not also register as a tap.
  const heldRef = useRef(false);
  const onOpenChangeRef = useRef(menuProps.onOpenChange);
  onOpenChangeRef.current = menuProps.onOpenChange;
  const handleOpenChange = useCallback((open: boolean) => {
    if (open) heldRef.current = true;
    onOpenChangeRef.current(open);
  }, []);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (heldRef.current) {
        heldRef.current = false;
        return;
      }
      onActivate(entry, event);
    },
    [entry, onActivate],
  );

  const handlePressIn = useCallback(() => {
    heldRef.current = false;
  }, []);

  // In multi-select mode, hold toggles selection instead of opening the menu.
  const onHoldAction = useMemo(
    () =>
      onSelectLongPress
        ? () => {
            heldRef.current = true;
            onSelectLongPress(entry);
          }
        : undefined,
    [entry, onSelectLongPress],
  );

  return { dragOptions: undefined, handleOpenChange, handlePress, handlePressIn, menuProps, onHoldAction };
}
