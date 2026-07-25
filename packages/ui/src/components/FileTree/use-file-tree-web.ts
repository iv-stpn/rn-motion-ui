/** biome-ignore-all lint/style/useExportsLast: exported types + module-private helpers interleave by concern */
// Web-only interaction glue. RNW routes taps/long-presses through each row's
// Pressable, but right-click, double-click and keyboard navigation never reach
// it. This hook installs a single container-level delegate that maps those DOM
// events back to rows (via the `data-fttree-path` attribute) and drives the same
// controller handlers the touch path uses. A no-op on native (the effect returns
// before touching the DOM), so the component wires it unconditionally.

import { type RefObject, useEffect } from 'react';
import { Platform, type View } from 'react-native';
import type { FileTreeVisibleRow } from './file-tree.types';
import type { FileTreeController } from './file-tree-controller';
import { type FileTreeKeyAction, resolveKeyAction, rowPathFromEventTarget } from './file-tree-web-dom';
import type { FileTreeActivateOptions } from './use-file-tree';

/** The controller handlers the delegate drives (same set the touch path calls). */
export type FileTreeWebHandlers = {
  controller: FileTreeController;
  activate: (row: FileTreeVisibleRow, options?: FileTreeActivateOptions) => void;
  toggleExpand: (path: string) => void;
  onStartRename: (path: string) => void;
  renamable: boolean;
};

/** The visible row for a path, or null when it has scrolled out / no longer exists. */
function rowByPath(controller: FileTreeController, path: string | null): FileTreeVisibleRow | null {
  if (!path) return null;
  return controller.getVisibleRows().find((row) => row.path === path) ?? null;
}

/** Apply a resolved keyboard action against the controller + handlers. */
function runKeyAction(action: FileTreeKeyAction, handlers: FileTreeWebHandlers, focused: FileTreeVisibleRow | null): void {
  const { controller, activate, toggleExpand, onStartRename, renamable } = handlers;
  switch (action.kind) {
    case 'move':
      controller.moveFocus(action.delta);
      break;
    case 'edge': {
      const rows = controller.getVisibleRows();
      controller.setFocus((action.edge === 'first' ? rows[0] : rows.at(-1))?.path ?? null);
      break;
    }
    case 'toggle':
      if (focused) toggleExpand(focused.path);
      break;
    case 'activate':
      if (focused) activate(focused, { modifiers: {} });
      break;
    case 'rename':
      if (focused && renamable) onStartRename(focused.path);
      break;
    case 'clear':
      controller.clearSelection();
      break;
    default:
      break;
  }
}

/** Build the three DOM listeners; returns them so the effect can add + remove the same refs. */
function buildListeners(handlers: FileTreeWebHandlers) {
  const { controller, activate, onStartRename, renamable } = handlers;

  const onContextMenu = (event: MouseEvent) => {
    const path = rowPathFromEventTarget(event.target);
    const row = rowByPath(controller, path);
    if (!row) return;
    event.preventDefault();
    activate(row, { modifiers: { secondary: true }, x: event.clientX, y: event.clientY });
  };

  const onDoubleClick = (event: MouseEvent) => {
    if (!renamable) return;
    const path = rowPathFromEventTarget(event.target);
    if (path) onStartRename(path);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const focused = rowByPath(controller, controller.getFocusedPath());
    const action = resolveKeyAction(event.key, focused);
    if (!action) return;
    event.preventDefault();
    runKeyAction(action, handlers, focused);
  };

  return { onContextMenu, onDoubleClick, onKeyDown };
}

/**
 * Install the web delegate on the container node. Rebinds whenever a handler
 * identity changes (the synced-tree handlers are `useCallback`-stable, so that is
 * rare). The container is made focusable (`tabIndex = 0`) so it captures keydown
 * even after virtualization unmounts the row that held DOM focus.
 */
export function useFileTreeWebInteractions(containerRef: RefObject<View | null>, handlers: FileTreeWebHandlers): void {
  const { controller, activate, toggleExpand, onStartRename, renamable } = handlers;
  // biome-ignore lint/plugin: DOM event delegation is an external side effect — RNW routes only tap/long-press through the row Pressable, so right-click / double-click / keyboard must be bound on the host node directly.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // biome-ignore lint/plugin: on web RNW renders the View to a DOM element, so the ref is really an HTMLElement; RN's View type can't express that.
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const listeners = buildListeners({ controller, activate, toggleExpand, onStartRename, renamable });
    if (node.tabIndex < 0) node.tabIndex = 0;
    node.addEventListener('contextmenu', listeners.onContextMenu);
    node.addEventListener('dblclick', listeners.onDoubleClick);
    node.addEventListener('keydown', listeners.onKeyDown);
    return () => {
      node.removeEventListener('contextmenu', listeners.onContextMenu);
      node.removeEventListener('dblclick', listeners.onDoubleClick);
      node.removeEventListener('keydown', listeners.onKeyDown);
    };
  }, [containerRef, controller, activate, toggleExpand, onStartRename, renamable]);
}
