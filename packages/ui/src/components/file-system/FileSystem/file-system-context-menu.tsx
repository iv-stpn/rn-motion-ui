/** biome-ignore-all lint/style/useExportsLast: hook return types head their hooks */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: hooks co-located with their return types */
// Context-menu support for file entries and the view background.
//
// Each entry wraps its content in a HoldContextMenu (trigger="pressable" default),
// which owns the hold gesture, the contextmenu DOM listener on web, and the drag when
// dragOptions are provided. The background uses a 1×1 anchor View absolutely
// positioned at the click/press point so the panel anchors there.
//
// How the menu is opened, by pointer rather than by platform:
//  - Right-click:  a `contextmenu` DOM listener — on each entry's HoldContextMenu
//                  wrapper for entries, on the scroll container for the background.
//  - Hold:         HoldContextMenu's own hold gesture (Holdable / HoldDraggable).
//                  In multi-select mode, `onHold` is overridden to toggle selection
//                  instead; the menu remains reachable via right-click on web.

import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, Platform, View } from 'react-native';
import { HoldContextMenu } from '../../menus/HoldContextMenu/hold-context-menu';
import type { HoldContextMenuItem } from '../../menus/HoldContextMenu/hold-context-menu-item';
import type { MenuItemIcon } from '../../menus/MenuItem/menu-item';
import type { FileSystemContextMenuAction, FileSystemItem } from './file-system.types';

// ── Icon adapter ───────────────────────────────────────────────────────────────

/**
 * Normalises a consumer's `icon` field to a `MenuItemIcon` component.
 *
 * Consumers may pass a sized/coloured `ReactNode` (`<Trash2 size={16} />`).
 * `HoldContextMenuItem.icon` expects a component (`(props) => ReactNode`). When
 * the value is already a function it is returned as-is; otherwise it is wrapped
 * so `IconProps` are ignored — the caller baked size and colour into the node.
 */
function toMenuIcon(icon: ReactNode | MenuItemIcon | undefined): MenuItemIcon | undefined {
  if (!icon) return;
  if (typeof icon === 'function') {
    // biome-ignore lint/plugin: MenuItemIcon is a function type; typeof check narrows correctly at runtime
    return icon as MenuItemIcon;
  }
  // Consumer passed a ReactNode — wrap it; IconProps are ignored because the
  // caller already baked size and colour in.
  const node = icon;
  // biome-ignore lint/plugin: node is ReactNode here (functions were handled above); TS does not narrow the union this precisely
  return () => node as ReactNode;
}

// ── Items builder ──────────────────────────────────────────────────────────────

const EMPTY_ITEMS: readonly HoldContextMenuItem[] = [];

const NO_ACTIONS_ITEM: HoldContextMenuItem = { disabled: true, id: '__no-actions', label: 'No actions available.' };

function holdMenuItems(
  actions: FileSystemContextMenuAction[],
  onAction: (action: FileSystemContextMenuAction) => void,
): readonly HoldContextMenuItem[] {
  if (actions.length === 0) return [NO_ACTIONS_ITEM];
  return actions.map((action) => ({
    destructive: action.destructive,
    disabled: action.disabled,
    icon: toMenuIcon(action.icon),
    id: action.id,
    label: action.label,
    onPress: action.disabled ? undefined : () => onAction(action),
  }));
}

// ── Entry context menu ─────────────────────────────────────────────────────────

export type ContextMenuHookReturn = {
  /**
   * Take the menu down — idempotent.
   *
   * `HoldContextMenu` also closes itself via `onHoldEscape` when a drag escapes
   * after a hold; this is the escape hatch for callers that need to close
   * programmatically from outside the component.
   */
  closeMenu: () => void;
  menuProps: {
    items: readonly HoldContextMenuItem[];
    /** Whether this entry's menu is open. */
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
};

/**
 * Wires up a right-click / hold context menu for one file-system entry.
 *
 * Returns `menuProps` to spread onto `<HoldContextMenu>` (trigger defaults to
 * `'pressable'`, which owns the hold gesture). When `getActions` is omitted the
 * menu is disabled — `items` is empty, so the trigger is inert.
 *
 * Items are resolved eagerly on every path/resolver change (cheap, synchronous)
 * so they are always current when the menu opens — no async gap between a
 * right-click and the panel appearing.
 */
export function useContextMenu(
  item: FileSystemItem,
  getActions: ((item: FileSystemItem) => FileSystemContextMenuAction[]) | undefined,
  onAction: ((action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>) | undefined,
): ContextMenuHookReturn {
  const [open, setOpen] = useState(false);

  // Stable ref so the items memo never forces the callback to change identity.
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  // Resolved eagerly so items are always current when the menu opens regardless
  // of whether the trigger was a hold or a web contextmenu event.
  // item.path is the stable entry identity — if the path does not change the
  // actions are not re-resolved even when the full `item` object is recreated.
  // biome-ignore lint/correctness/useExhaustiveDependencies: item.path is the stable key; re-running on the full item object would re-resolve on every render
  const items = useMemo(
    () => (getActions ? holdMenuItems(getActions(item), (action) => onActionRef.current?.(action, item)) : EMPTY_ITEMS),
    [getActions, item.path],
  );

  const closeMenu = useCallback(() => setOpen(false), []);
  const handleOpenChange = useCallback((next: boolean) => setOpen(next), []);

  return {
    closeMenu,
    menuProps: { items, onOpenChange: handleOpenChange, open: getActions ? open : false },
  };
}

// ── Background context menu ────────────────────────────────────────────────────

export type BackgroundContextMenuHookReturn = {
  /**
   * Pass to the background `Pressable`'s `onLongPress`. `undefined` when
   * `getActions` was not provided so the prop is truly absent.
   */
  onLongPress: ((event: GestureResponderEvent) => void) | undefined;
  /**
   * Render inside the container. A 1×1 `HoldContextMenu` anchor positioned at
   * the press / right-click point. `null` when disabled.
   */
  menuNode: ReactNode;
};

/**
 * Wires up a right-click / long-press context menu for the empty background of
 * a file-system view.
 *
 * On web a `contextmenu` listener on `containerRef` opens the menu. On native
 * `onLongPress` captures the touch coordinates. A 1×1 invisible `HoldContextMenu`
 * wrapper is absolutely positioned at the press / click point so the panel can
 * anchor there via the normal `measureInWindow` path.
 *
 * Entry context menus call `stopPropagation` on their own `contextmenu` events
 * (via `useHoldActivation`), so only genuine background right-clicks reach this
 * listener.
 */
export function useBackgroundContextMenu(
  containerRef: RefObject<View | null>,
  getActions: (() => FileSystemContextMenuAction[]) | undefined,
  onAction: ((action: FileSystemContextMenuAction) => void | Promise<void>) | undefined,
): BackgroundContextMenuHookReturn {
  const [open, setOpen] = useState(false);
  const [anchorPos, setAnchorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const getActionsRef = useRef(getActions);
  getActionsRef.current = getActions;
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  // Background actions are context-free, so resolving at render time is fine.
  // If `getActions` identity is stable (useCallback at the call site) this memo
  // rarely re-runs.
  const items = useMemo(
    () => (getActions ? holdMenuItems(getActions(), (action) => onActionRef.current?.(action)) : EMPTY_ITEMS),
    [getActions],
  );

  const openAt = useCallback((localX: number, localY: number) => {
    if (!getActionsRef.current) return;
    setAnchorPos({ x: localX, y: localY });
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => setOpen(next), []);

  // Web: attach contextmenu to the container. Entry menus call stopPropagation
  // on their own contextmenu events, so only genuine background right-clicks here.
  // biome-ignore lint/plugin: a native contextmenu DOM listener has no RN prop equivalent; Platform guard makes this branch unreachable off web
  useEffect(() => {
    if (Platform.OS !== 'web' || !getActions) return;
    // biome-ignore lint/plugin: RNW resolves View refs to HTMLElement; RN's View type cannot express that
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const handler = (e: Event) => {
      e.preventDefault();
      // biome-ignore lint/plugin: MouseEvent is the concrete type at runtime; Event is the generic DOM listener signature
      const me = e as MouseEvent;
      // biome-ignore lint/plugin: node is non-null here (checked above); TypeScript does not narrow through closures
      const domRect = (node as HTMLElement).getBoundingClientRect();
      openAt(me.clientX - domRect.left, me.clientY - domRect.top);
    };
    node.addEventListener('contextmenu', handler);
    return () => node.removeEventListener('contextmenu', handler);
  }, [containerRef, getActions, openAt]);

  if (!getActions) return { menuNode: null, onLongPress: undefined };

  // Native long-press: capture coordinates from the gesture event.
  const onLongPress = (event: GestureResponderEvent) => {
    openAt(event.nativeEvent.locationX, event.nativeEvent.locationY);
  };

  // 1×1 anchor positioned at the press/click point. Its outer View is the node
  // `HoldContextMenu` measures with `measureInWindow` to place the panel.
  // `openOnContextMenu={false}` prevents the anchor's own contextmenu listener
  // from double-firing alongside the container's.
  const menuNode = (
    <HoldContextMenu
      items={items}
      onOpenChange={handleOpenChange}
      open={open}
      openOnContextMenu={false}
      style={{ height: 1, left: anchorPos.x, position: 'absolute', top: anchorPos.y, width: 1 }}
      trigger="passive"
    >
      <View />
    </HoldContextMenu>
  );

  return { menuNode, onLongPress };
}
