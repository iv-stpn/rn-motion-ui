/** biome-ignore-all lint/style/useExportsLast: hook return types head their hooks */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: hooks co-located with their return types */
// Context-menu support for file entries and the view background.
//
// Each entry wraps its content in a `HoldItem` (the `HoldMenu` trigger), which owns
// the hold gesture, the contextmenu DOM listener on web, and the drag when
// dragOptions are provided. The background keeps a `FileSystemBackgroundMenu`
// anchored at the click/press point, because `HoldItem` has no imperative open —
// it can only anchor to its own measured wrapper, never to an arbitrary point a
// background click names.
//
// How the menu is opened, by pointer rather than by platform:
//  - Right-click:  a `contextmenu` DOM listener — on each entry's `HoldItem`
//                  wrapper for entries, on the scroll container for the background.
//  - Hold:         `HoldItem`'s own hold gesture. In multi-select mode, `onHold` is
//                  overridden to toggle selection instead; the menu remains
//                  reachable via right-click on web.

import { type ReactElement, type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, Platform, type View } from 'react-native';
import type { MenuItemProps } from '../../../menus/HoldMenu/hold-menu';
import type { MenuActionEntry, MenuEntry } from '../../../rows/menu';
import type { MenuItemIcon } from '../../../rows/menu-item';
import { HOLD_MENU_ROW_CLASS } from '../../../rows/menu-placement';
import type { FileSystemContextMenuAction, FileSystemItem } from '../types/file-system.types';
import { FileSystemBackgroundMenu } from './file-system-background-menu';

// ── Icon adapters ─────────────────────────────────────────────────────────────

/**
 * Normalises a consumer's `icon` field to a `HoldMenu` `MenuItemProps.icon` —
 * a render function producing the row's leading element.
 *
 * Consumers may pass a sized/coloured `ReactNode` (`<Trash2 size={16} />`) or a
 * component matching `MenuItemIcon` (`(props) => ReactNode`). `HoldMenu` calls
 * its icon function with no arguments, so a `MenuItemIcon` is wrapped with the
 * row's own 18 px size baked in (HoldMenu threads no colour into function icons);
 * a plain `ReactNode` is wrapped unchanged — the caller already baked size and
 * colour into it.
 */
function toMenuItemIcon(icon: ReactNode | MenuItemIcon | undefined): (() => ReactElement) | undefined {
  if (!icon) return;
  if (typeof icon === 'function') {
    // biome-ignore lint/plugin: MenuItemIcon is a function type; typeof check narrows correctly at runtime
    const Icon = icon as MenuItemIcon;
    return () => <Icon size={18} />;
  }
  // Consumer passed a ReactNode — wrap it; IconProps are ignored because the
  // caller already baked size and colour in.
  const node = icon;
  // biome-ignore lint/plugin: node is ReactNode here (functions were handled above); TS does not narrow the union this precisely
  return () => <>{node as ReactNode}</>;
}

/**
 * Normalises a consumer's `icon` field to a `MenuItemIcon` component for the
 * background `Menu` entries.
 *
 * Consumers may pass a sized/coloured `ReactNode` (`<Trash2 size={16} />`).
 * `MenuActionEntry.icon` expects a component (`(props) => ReactNode`). When
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

// ── Items builders ────────────────────────────────────────────────────────────

const EMPTY_MENU_ITEMS: MenuItemProps[] = [];
const NO_ACTIONS_MENU_ITEM: MenuItemProps = { disabled: true, text: 'No actions available.' };

const EMPTY_MENU_ENTRIES: readonly MenuEntry[] = [];
const NO_ACTIONS_MENU_ENTRY: MenuActionEntry = { disabled: true, id: '__no-actions', label: 'No actions available.' };

/** Entry menu rows — `HoldMenu`'s `MenuItemProps`, one per consumer action. */
function menuItems(
  actions: FileSystemContextMenuAction[],
  onAction: (action: FileSystemContextMenuAction) => void,
): MenuItemProps[] {
  if (actions.length === 0) return [NO_ACTIONS_MENU_ITEM];
  return actions.map((action) => ({
    isDestructive: action.destructive,
    disabled: action.disabled,
    icon: toMenuItemIcon(action.icon),
    onPress: action.disabled ? undefined : () => onAction(action),
    text: action.label,
  }));
}

/** Background menu rows — `Menu` entries, one per consumer action. */
function backgroundMenuEntries(
  actions: FileSystemContextMenuAction[],
  onAction: (action: FileSystemContextMenuAction) => void,
): readonly MenuEntry[] {
  if (actions.length === 0) return [NO_ACTIONS_MENU_ENTRY];
  return actions.map((action) => ({
    className: HOLD_MENU_ROW_CLASS,
    destructive: action.destructive,
    disabled: action.disabled,
    icon: toMenuIcon(action.icon),
    id: action.id,
    label: action.label,
    onSelect: action.disabled ? undefined : () => onAction(action),
  }));
}

// ── Entry context menu ─────────────────────────────────────────────────────────

export type ContextMenuHookReturn = {
  menuProps: {
    items: MenuItemProps[];
    /** Whether this entry's menu is open. */
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
};

/**
 * Wires up a right-click / hold context menu for one file-system entry.
 *
 * Returns `menuProps` for a `HoldItem`: `items` to hand it, plus `open` /
 * `onOpenChange` for callers that need to watch the menu's state (the mobile
 * kebab flips to a checkbox only once the menu closes). When `getActions` is
 * omitted the menu is disabled — `items` is empty, so the trigger is inert.
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
    () => (getActions ? menuItems(getActions(item), (action) => onActionRef.current?.(action, item)) : EMPTY_MENU_ITEMS),
    [getActions, item.path],
  );

  // `HoldItem` owns its own open state; this mirror exists so callers (the mobile
  // kebab's slot) can react to it. Driven by `onOpenChange`, which `HoldItem`
  // fires on both open and close.
  const handleOpenChange = useCallback((next: boolean) => setOpen(next), []);

  return {
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
   * Render inside the container. A `FileSystemBackgroundMenu` anchored at the
   * press / right-click point. `null` when disabled.
   */
  menuNode: ReactNode;
};

/**
 * Wires up a right-click / long-press context menu for the empty background of
 * a file-system view.
 *
 * On web a `contextmenu` listener on `containerRef` opens the menu. On native
 * `onLongPress` captures the touch coordinates. A `FileSystemBackgroundMenu` is
 * anchored at the press / click point so the panel can open there via the normal
 * `measureInWindow` path.
 *
 * This is the one menu that cannot migrate to `HoldMenu`: `HoldItem` has no
 * imperative open and anchors to its own measured wrapper, so it cannot open at
 * an arbitrary background point. `FileSystemBackgroundMenu` keeps that — the same
 * 1×1-anchor trick `HoldContextMenu` used to, without a gesture.
 *
 * Entry context menus call `stopPropagation` on their own `contextmenu` events
 * (via `HoldItem`'s `handleContextMenu`), so only genuine background
 * right-clicks reach this listener.
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
    () => (getActions ? backgroundMenuEntries(getActions(), (action) => onActionRef.current?.(action)) : EMPTY_MENU_ENTRIES),
    [getActions],
  );

  const openAt = useCallback((localX: number, localY: number) => {
    if (!getActionsRef.current) return;
    setAnchorPos({ x: localX, y: localY });
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

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

  // Anchored at the press/click point. The component positions a 1×1 View there
  // and measures it with `measureInWindow` to place the panel — the same trick
  // `HoldContextMenu`'s passive trigger used, minus the gesture and its own
  // contextmenu listener (the container's listener above is the only one).
  const menuNode = <FileSystemBackgroundMenu anchor={anchorPos} items={items} onClose={handleClose} open={open} />;

  return { menuNode, onLongPress };
}
