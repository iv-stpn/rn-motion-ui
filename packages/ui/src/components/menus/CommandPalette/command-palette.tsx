import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, type StyleProp, TextInput, View, type ViewStyle } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { SearchLine as Search } from 'rn-motion-ui-icons/icons/search-line';
import { useBreakpointAtLeast } from '../../../hooks/use-breakpoint';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import type { SurfaceElevation } from '../../../lib/elevated';
import { useThemeColor } from '../../../theme/use-theme-color';
import { CloseButton } from '../../buttons/CloseButton/close-button';
import { ThemedIcon } from '../../icon/themed-icon';
import { MenuItem } from '../../rows/menu-item';
import { Text } from '../../typography/Text/text';
import { AdaptiveModal } from '../AdaptiveModal/adaptive-modal';
import type { OverlayType } from '../Overlay/overlay-type';

// Renders inside AdaptiveModal with `customLayout` + `scrollable={false}`: the
// palette owns its layout (a fixed search bar over a scrollable list) while
// AdaptiveModal supplies the adaptive surface (narrow → fullSheet, wide →
// centered modal), backdrop, exit animation and mount-gating. The web
// Cmd/Ctrl+K shortcut has no RN equivalent, so `shortcut` is kept for API
// parity but is a no-op. Rows are tapped rather than arrow-navigated; the
// active row highlight tracks the tapped/last-focused item and fades in via
// moti. On wide screens the `ESC` kbd chip is the close button and rows show
// their keyboard-shortcut hints; on narrow (touch) screens those shortcuts are
// meaningless and a proper close button sits in the top right instead.

const ESC_LABEL = 'ESC';

/** The group caption above each run of rows. */
const GROUP_LABEL_CLASS = 'px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider';

/** Props passed to a command palette icon renderer. */
export type CommandIconProps = IconProps;

/** Icon renderer — compatible with this project's icon set signature. */
export type CommandIcon = (props: CommandIconProps) => ReactNode;

export type CommandItem = {
  id: string;
  label: string;
  group?: string;
  hint?: string;
  keywords?: string[];
  icon?: CommandIcon;
  badge?: ReactNode;
  onSelect: () => void;
  testID?: string;
};

// biome-ignore lint/style/useExportsLast: props type before fuzzyMatch helper — collocated for readability
export type CommandPaletteProps = {
  items: CommandItem[];
  /** Kept for web parity; on RN there is no window shortcut, so this is a no-op. */
  shortcut?: string;
  placeholder?: string;
  emptyMessage?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** The scrim behind the panel: `"blur"`, `"opacity"`, or `"none"`. Defaults to `"blur"`. */
  overlay?: OverlayType;
  /** Overrides `overlay` on the small-screen bottom sheet. When omitted, the sheet uses `overlay`. */
  smallScreenOverlay?: OverlayType;
  /** When false, pressing outside the palette will not close it. Defaults to true. */
  closeOnOutsidePress?: boolean;
  /** Surface elevation (0–8) — drives the drop shadow + dark-mode rim. `0` is the flat resting surface (no shadow or border). Defaults to 6. */
  elevation?: SurfaceElevation;
  /**
   * Root testID. Each row derives `-item-<id>` from it and each group heading
   * `-group-<name>` — the heading is plain text with no role to query by. An
   * item's own `testID` wins over its derived one.
   */
  testID?: string;
  /** Replace the search input icon. Default: `<Search size={16} color={mutedForeground} />`. */
  searchIcon?: ReactNode;
};

function fuzzyMatch(needle: string, hay: string) {
  if (!needle) return true;
  const n = needle.toLowerCase();
  const h = hay.toLowerCase();
  let i = 0;
  for (const ch of h) {
    if (ch === n[i]) i += 1;
    if (i === n.length) return true;
  }
  return false;
}

type CommandRowProps = {
  item: CommandItem;
  index: number;
  isActive: boolean;
  hasIcons: boolean;
  /** Whether to show the item's keyboard-shortcut hint (wide screens only). */
  showShortcuts: boolean;
  reduce: boolean;
  onActivate: (index: number) => void;
  onSelect: (item: CommandItem) => void;
  /** The palette's root `testID`; the row derives its own from it. */
  testID?: string;
};

function CommandRow({ item, index, isActive, hasIcons, showShortcuts, reduce, onActivate, onSelect, testID }: CommandRowProps) {
  const handlePressIn = useCallback(() => onActivate(index), [onActivate, index]);
  const handlePress = useCallback(() => onSelect(item), [onSelect, item]);

  // Compose badge + hint into a single trailing node when either is present.
  const trailing =
    item.badge || (showShortcuts && item.hint) ? (
      <>
        {item.badge ? <View className="shrink-0">{item.badge}</View> : null}
        {showShortcuts && item.hint ? (
          <Text className="rounded border-[1.5px] border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {item.hint}
          </Text>
        ) : null}
      </>
    ) : undefined;

  return (
    <MenuItem
      accessibilityRole="menuitem"
      accessibilityLabel={item.label}
      onPressIn={handlePressIn}
      onPress={handlePress}
      testID={item.testID ?? (testID ? `${testID}-item-${item.id}` : undefined)}
      icon={item.icon}
      label={item.label}
      active={isActive}
      trailing={trailing}
      iconPlaceholder={hasIcons && !item.icon}
      reduce={reduce}
      className="rounded-md"
    />
  );
}

export function CommandPalette({
  items,
  placeholder = 'Type a command or search…',
  emptyMessage = 'No results found.',
  open: controlledOpen,
  onOpenChange,
  style,
  accessibilityLabel = 'Command palette',
  testID,
  searchIcon,
  overlay = 'blur',
  smallScreenOverlay,
  closeOnOutsidePress = true,
  elevation = 6,
}: CommandPaletteProps) {
  const reduce = useReducedMotion();
  const placeholderColor = useThemeColor('muted-foreground');
  // Wide = the palette renders as a centred modal (≥ `sm`, matching the
  // AdaptiveModal wide breakpoint); narrow = the full-sheet touch surface where
  // keyboard shortcuts don't exist and a tap-to-close button takes their place.
  const isWideScreen = useBreakpointAtLeast('sm');

  const [internalOpen, setInternalOpen] = useState(false);

  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;

  const [query, setQuery] = useState('');
  // `-1` means no row is highlighted; the highlight appears only once a row is
  // tapped/pressed (onPressIn → onActivate). Defaulting to 0 preselects the
  // first item on every open, which reads as an accidental selection.
  const [active, setActive] = useState(-1);

  const setOpen = useCallback(
    (v: boolean) => {
      if (!controlled) setInternalOpen(v);
      onOpenChange?.(v);
    },
    [controlled, onOpenChange],
  );

  // biome-ignore lint/plugin: query and active cursor must reset on each open — this responds to the open event, not derivable from render-time state
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(-1);
    }
  }, [open]);

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    setActive(-1);
  }, []);

  const filtered = useMemo(() => {
    if (!query) return items;
    return items.filter((it) => {
      const haystacks = [it.label, it.group ?? '', ...(it.keywords ?? [])];
      return haystacks.some((h) => fuzzyMatch(query, h));
    });
  }, [items, query]);

  const hasIcons = useMemo(() => items.some((it) => it.icon), [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const it of filtered) {
      const g = it.group ?? 'Results';
      const groupItems = map.get(g) ?? [];
      groupItems.push(it);
      map.set(g, groupItems);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleClose = useCallback(() => setOpen(false), [setOpen]);
  const handleSelect = useCallback(
    (item: CommandItem) => {
      item.onSelect();
      setOpen(false);
    },
    [setOpen],
  );

  let cursor = 0;

  return (
    <AdaptiveModal
      open={open}
      onOpenChange={handleClose}
      customLayout={true}
      scrollable={false}
      smallScreenMode="fullSheet"
      largeScreenMode="modal"
      overlay={overlay}
      smallScreenOverlay={smallScreenOverlay}
      closeOnOutsidePress={closeOnOutsidePress}
      elevation={elevation}
    >
      <View testID={testID} accessibilityLabel={accessibilityLabel} style={style}>
        <View className="flex-row items-center gap-3 border-border border-b-[1.5px] px-4">
          {searchIcon ?? <ThemedIcon icon={Search} variant="ghost" size={16} />}
          <TextInput
            autoFocus={true}
            value={query}
            onChangeText={updateQuery}
            placeholder={placeholder}
            placeholderTextColor={placeholderColor}
            accessibilityLabel={placeholder}
            className="h-12 flex-1 font-sans-normal text-foreground text-sm outline-none"
          />
          {isWideScreen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={handleClose}
              className="rounded border-[1.5px] border-border bg-surface-2 px-1.5 py-0.5"
            >
              <Text className="text-[10px] text-muted-foreground">{ESC_LABEL}</Text>
            </Pressable>
          ) : (
            <CloseButton onPress={handleClose} size="sm" />
          )}
        </View>
        <ScrollView className="max-h-[60vh] px-2 py-2" keyboardShouldPersistTaps="handled">
          {filtered.length === 0 ? (
            <View className="p-8">
              <Text className="text-center text-muted-foreground text-sm">{emptyMessage}</Text>
            </View>
          ) : (
            grouped.map(([group, list]) => (
              <View key={group} className="mb-1">
                <Text weight="semibold" className={GROUP_LABEL_CLASS} testID={testID ? `${testID}-group-${group}` : undefined}>
                  {group}
                </Text>
                {list.map((it) => {
                  const idx = cursor;
                  cursor += 1;
                  return (
                    <CommandRow
                      key={it.id}
                      item={it}
                      index={idx}
                      isActive={idx === active}
                      hasIcons={hasIcons}
                      showShortcuts={isWideScreen}
                      reduce={reduce}
                      onActivate={setActive}
                      onSelect={handleSelect}
                      testID={testID}
                    />
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </AdaptiveModal>
  );
}
