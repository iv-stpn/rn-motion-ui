/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: hook and helper components kept together — all are internal to this module */
// Context-menu support for file entries: right-click on web, long-press on
// native. Implemented as a hook so each row or tile can wire it without an
// extra wrapper component changing the layout tree.
//
// Platform split (mirrors use-file-tree-web.ts):
//  - Web:    a `contextmenu` DOM listener on the entry's wrapper ref.
//  - Native: `onLongPress` on the row Pressable.
//
// Positioning: AdaptiveDropdown only calls measureInWindow inside its own
// toggle Pressable — a controlled `open` prop never triggers it, so the panel
// always landed at (0,0). We use a plain Modal instead: on wide screens the
// panel is fixed at the cursor coordinates captured from the DOM event; on
// narrow/native it slides up as a bottom sheet.
//
// Single-open coordination: FileSystemContextMenuProvider holds a shared ref
// that always points to the currently-open menu's closer. Opening a new menu
// calls the previous closer first, so only one panel is visible at a time —
// no intermediate tap on the backdrop required.

import {
  createContext,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { cn } from '../../lib/cn';
import { useThemeColors } from '../../theme/use-theme-color';
import { Text } from '../Text/text';
import type { FileSystemContextMenuAction, FileSystemItem } from './file-system.types';

const NO_ACTIONS_LABEL = 'No actions available.';
const MENU_WIDTH = 220;
const VIEWPORT_PADDING = 8;
/** react-native-web honours 'fixed' but the type union omits it. */
// biome-ignore lint/plugin: 'fixed' is valid on web; not in RN's LayoutPosition union
const WEB_FIXED = { position: 'fixed' } as unknown as object;

// ── Shared single-open registry ────────────────────────────────────────────────

type ContextMenuCloser = { close: () => void } | null;

/** Each FileSystem tree mounts one provider; useContextMenu reads the nearest one. */
const FileSystemContextMenuContext = createContext<MutableRefObject<ContextMenuCloser>>({ current: null });

export type FileSystemContextMenuProviderProps = { children: ReactNode };

export function FileSystemContextMenuProvider({ children }: FileSystemContextMenuProviderProps) {
  const registryRef = useRef<ContextMenuCloser>(null);
  return <FileSystemContextMenuContext.Provider value={registryRef}>{children}</FileSystemContextMenuContext.Provider>;
}

// ── Action row ─────────────────────────────────────────────────────────────────

export type ContextMenuActionRowProps = {
  action: FileSystemContextMenuAction;
  onPress: (action: FileSystemContextMenuAction) => void;
};

export function ContextMenuActionRow({ action, onPress }: ContextMenuActionRowProps) {
  const [hovered, setHovered] = useState(false);
  const colors = useThemeColors();
  const handlePress = useCallback(() => onPress(action), [action, onPress]);
  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);

  const labelColor = action.destructive ? colors.danger : colors.foreground;

  return (
    <Pressable
      accessibilityRole="menuitem"
      // `disabled` carries the state to the accessibility tree on both platforms
      // and blocks the press; dimming alone would leave the row announced as live.
      disabled={action.disabled}
      className={cn(
        'h-9 flex-row items-center gap-2 rounded-md px-2',
        hovered && !action.disabled && 'bg-surface-hover',
        action.disabled && 'opacity-40',
      )}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPress={handlePress}
    >
      {action.icon ? <View className="w-4 items-center">{action.icon}</View> : null}
      <Text className="flex-1" size="sm" style={{ color: labelColor }}>
        {action.label}
      </Text>
    </Pressable>
  );
}

// ── Floating panel (wide screen, cursor-anchored) ──────────────────────────────

type ContextMenuPanelProps = {
  actions: FileSystemContextMenuAction[];
  onAction: (action: FileSystemContextMenuAction) => void;
  onClose: () => void;
  pos: { x: number; y: number } | null;
  title: string;
};

type LayoutEvent = { nativeEvent: { layout: { height: number } } };

function ContextMenuPanel({ actions, onAction, onClose, pos, title }: ContextMenuPanelProps) {
  const { width: vpWidth, height: vpHeight } = useWindowDimensions();
  const isWide = vpWidth >= 768;
  const [panelHeight, setPanelHeight] = useState(0);

  const clampedX = pos ? Math.min(pos.x, vpWidth - MENU_WIDTH - VIEWPORT_PADDING) : 0;
  const clampedY = pos ? Math.min(pos.y, vpHeight - panelHeight - VIEWPORT_PADDING) : 0;

  const handleLayout = useCallback(({ nativeEvent }: LayoutEvent) => setPanelHeight(nativeEvent.layout.height), []);

  const content = <ContextMenuContent actions={actions} onAction={onAction} />;

  if (isWide && pos !== null) {
    // Floating panel anchored to the cursor via `position: fixed`.
    return (
      <Modal animationType="none" onRequestClose={onClose} statusBarTranslucent={true} transparent={true} visible={true}>
        {/* Full-screen backdrop — dismiss on tap outside the panel */}
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        {/* Panel — sits above the backdrop in stacking order */}
        <View
          className="overflow-hidden rounded-2xl border border-border bg-surface-5 py-1 shadow-lg"
          onLayout={handleLayout}
          // biome-ignore lint/plugin: 'fixed' is valid on web; absent from RN LayoutPosition union
          style={[WEB_FIXED as object, { left: clampedX, top: clampedY, width: MENU_WIDTH, zIndex: 999 }]}
        >
          {content}
        </View>
      </Modal>
    );
  }

  // Narrow screen / native: bottom sheet.
  return (
    <Modal animationType="slide" onRequestClose={onClose} statusBarTranslucent={true} transparent={true} visible={true}>
      <Pressable className="flex-1" onPress={onClose} />
      <View className="rounded-t-2xl border-border border-t bg-surface-1 pb-8">
        <View className="h-14 flex-row items-center border-border border-b px-4">
          <Text className="flex-1 font-semibold text-base text-foreground" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View className="px-2 py-1">{content}</View>
      </View>
    </Modal>
  );
}

// ── Menu content ───────────────────────────────────────────────────────────────

export type ContextMenuContentProps = {
  actions: FileSystemContextMenuAction[];
  onAction: (action: FileSystemContextMenuAction) => void;
};

export function ContextMenuContent({ actions, onAction }: ContextMenuContentProps) {
  if (actions.length === 0)
    return (
      <Text className="px-2 py-3 text-muted-foreground" size="sm">
        {NO_ACTIONS_LABEL}
      </Text>
    );

  return (
    <>
      {actions.map((action) => (
        <ContextMenuActionRow key={action.id} action={action} onPress={onAction} />
      ))}
    </>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export type ContextMenuHookReturn = {
  /**
   * Attach to the View wrapping the entry row or tile. On web this element
   * receives the native `contextmenu` DOM event; on native it is a no-op.
   */
  wrapperRef: RefObject<View | null>;
  /**
   * Pass to the entry Pressable's `onLongPress`. `undefined` when
   * `getContextMenuActions` was not provided so the prop is truly absent.
   */
  onLongPress: (() => void) | undefined;
  /**
   * Render this node inside the entry's row/tile. It is a Modal-backed panel
   * that positions itself at the cursor on wide screens and slides up as a
   * bottom sheet on narrow screens / native. `null` when disabled.
   */
  contextMenuNode: ReactNode;
};

/**
 * Wires up a right-click / long-press context menu for one file-system entry.
 *
 * @param item       The `FileSystemItem` passed back to the callbacks.
 * @param getActions Synchronous resolver for menu actions — omit to disable.
 * @param onAction   Called with the chosen action (may be async).
 */
export function useContextMenu(
  item: FileSystemItem,
  getActions: ((item: FileSystemItem) => FileSystemContextMenuAction[]) | undefined,
  onAction: ((action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>) | undefined,
): ContextMenuHookReturn {
  const registryRef = useContext(FileSystemContextMenuContext);
  const wrapperRef = useRef<View | null>(null);
  const [open, setOpen] = useState(false);
  const [actions, setActions] = useState<FileSystemContextMenuAction[]>([]);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Stable refs so the DOM effect never needs to re-bind when identity changes.
  const getActionsRef = useRef(getActions);
  getActionsRef.current = getActions;
  const itemRef = useRef(item);
  itemRef.current = item;

  const closeMenu = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  const openMenu = useCallback(
    (cursorPos: { x: number; y: number } | null) => {
      if (!getActionsRef.current) return;
      // Close any currently open context menu before opening this one.
      registryRef.current?.close();
      // Resolve actions synchronously — no spinner, no async wait.
      const result = getActionsRef.current(itemRef.current);
      setActions(result);
      setPos(cursorPos);
      setOpen(true);
      // Register this menu as the currently open one.
      registryRef.current = { close: closeMenu };
    },
    [closeMenu, registryRef],
  );

  const handleAction = useCallback(
    (action: FileSystemContextMenuAction) => {
      setOpen(false);
      onAction?.(action, itemRef.current);
    },
    [onAction],
  );

  const openFromLongPress = useCallback(() => openMenu(null), [openMenu]);

  // biome-ignore lint/plugin: attaching a web-only DOM event; Platform guard makes this branch unreachable on native
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!getActions) return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web; no type-safe alternative
    const node = wrapperRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const handler = (e: Event) => {
      e.preventDefault();
      // biome-ignore lint/plugin: MouseEvent is the concrete type at runtime; Event is the generic DOM listener signature
      const me = e as MouseEvent;
      openMenu({ x: me.clientX, y: me.clientY });
    };
    node.addEventListener('contextmenu', handler);
    return () => node.removeEventListener('contextmenu', handler);
  }, [getActions, openMenu]);

  if (!getActions) return { wrapperRef, onLongPress: undefined, contextMenuNode: null };

  const contextMenuNode = open ? (
    <ContextMenuPanel actions={actions} onAction={handleAction} onClose={closeMenu} pos={pos} title={item.name ?? item.path} />
  ) : null;

  return { wrapperRef, onLongPress: openFromLongPress, contextMenuNode };
}
