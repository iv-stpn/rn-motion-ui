import { useModalRender } from '@rn-motion-ui/hooks/use-modal-render';
import { useReducedMotion } from '@rn-motion-ui/hooks/use-reduced-motion';
import { AnimatePresence } from '@rn-motion-ui/moti/presence';
import { MotiView } from '@rn-motion-ui/moti/view';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  type StyleProp,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SPRING_LAYOUT, SPRING_PANEL } from '../../lib/ease';
import { Search } from '../../lib/icons';

// RN FALLBACK vs web: the web palette is a `createPortal` overlay with a
// `backdrop-filter` blur, a global Cmd/Ctrl+K listener, body-scroll lock and
// arrow-key/Enter list navigation. RN uses a transparent `Modal` (no window
// keydown, so the `shortcut` prop is kept for API parity but is a no-op) and a
// `TextInput` + scrollable rows. Rows are tapped rather than arrow-navigated;
// the active row highlight tracks the tapped/last-focused item and fades in via
// moti. The `ESC` kbd chip is a real close button here (no hardware ESC key).
// The backdrop blur is dropped (no RN filter) for a dimmed scrim, and the web
// `shadow-2xl` is mirrored with an inline shadow/elevation so the panel floats.
// The panel sits ~18% down the viewport and the list caps at ~60% of height,
// matching the web `pt-[18vh]` / `max-h-[60vh]`.

// Mirrors the web `shadow-2xl` so the panel reads as floating above the scrim.
const PANEL_SHADOW = {
  ...Platform.select({
    default: { shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.25, shadowRadius: 40 },
    web: { boxShadow: '0px 24px 40px rgba(0, 0, 0, 0.25)' },
  }),
  elevation: 24,
};

const ESC_LABEL = 'ESC';

/** Props passed to a command palette icon renderer. */
export type CommandIconProps = { size?: number; color?: string };

/** Icon renderer matching the `../../lib/icons` signature. */
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
  testID?: string;
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
  reduce: boolean;
  onActivate: (index: number) => void;
  onSelect: (item: CommandItem) => void;
};

function CommandRow({ item, index, isActive, hasIcons, reduce, onActivate, onSelect }: CommandRowProps) {
  const Icon = item.icon;
  const handlePressIn = useCallback(() => onActivate(index), [onActivate, index]);
  const handlePress = useCallback(() => onSelect(item), [onSelect, item]);

  let iconSlot: ReactNode = null;
  if (Icon) iconSlot = <Icon size={16} color={isActive ? '#111111' : '#71717a'} />;
  else if (hasIcons) iconSlot = <View style={{ width: 16, height: 16 }} />;

  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={item.label}
      onPressIn={handlePressIn}
      onPress={handlePress}
      className="relative flex-row items-center gap-3 rounded-md px-2 py-2"
    >
      {isActive ? (
        <MotiView
          key={`hl-${item.id}`}
          className="bg-primary/5"
          from={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { type: 'timing', duration: 0 } : SPRING_LAYOUT}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 6,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {iconSlot}
      <Text numberOfLines={1} className={isActive ? 'flex-1 text-foreground text-sm' : 'flex-1 text-muted-foreground text-sm'}>
        {item.label}
      </Text>
      {item.badge ? <View className="shrink-0">{item.badge}</View> : null}
      {item.hint ? (
        <Text className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {item.hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: search + keyboard + item selection state handled in one render pass
export function CommandPalette({
  items,
  placeholder = 'Type a command or search…',
  emptyMessage = 'No results found.',
  open: controlledOpen,
  onOpenChange,
  style,
  accessibilityLabel = 'Command palette',
  testID,
}: CommandPaletteProps) {
  const reduce = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;
  const { rendered, onExitComplete: handleExitComplete } = useModalRender(open);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

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
      setActive(0);
    }
  }, [open]);

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    setActive(0);
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

  if (!rendered) return null;

  let cursor = 0;

  return (
    <Modal transparent={true} visible={rendered} animationType="none" onRequestClose={handleClose}>
      <AnimatePresence onExitComplete={handleExitComplete}>
        {open ? (
          <View key="command-overlay" style={{ flex: 1 }} testID={testID}>
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: reduce ? 100 : 160 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            >
              <Pressable accessibilityLabel="Close" onPress={handleClose} className="bg-surface/60" style={{ flex: 1 }} />
            </MotiView>
            <View
              className="flex-1 items-center px-4"
              style={{ paddingTop: Math.round(windowHeight * 0.18), pointerEvents: 'box-none' }}
            >
              <MotiView
                accessibilityLabel={accessibilityLabel}
                from={{ opacity: 0, scale: reduce ? 1 : 0.97, translateY: reduce ? 0 : -8 }}
                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                exit={{ opacity: 0, scale: reduce ? 1 : 0.97, translateY: reduce ? 0 : -8 }}
                transition={reduce ? { type: 'timing', duration: 100 } : SPRING_PANEL}
                className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card"
                style={[PANEL_SHADOW, style]}
              >
                <View className="flex-row items-center gap-3 border-border border-b px-4">
                  <Search size={16} color="#71717a" />
                  <TextInput
                    autoFocus={true}
                    value={query}
                    onChangeText={updateQuery}
                    placeholder={placeholder}
                    placeholderTextColor="#71717a"
                    accessibilityLabel={placeholder}
                    className="h-12 flex-1 text-foreground text-sm"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    onPress={handleClose}
                    className="rounded border border-border bg-surface px-1.5 py-0.5"
                  >
                    <Text className="text-[10px] text-muted-foreground">{ESC_LABEL}</Text>
                  </Pressable>
                </View>
                <ScrollView
                  className="p-2"
                  style={{ maxHeight: Math.round(windowHeight * 0.6) }}
                  keyboardShouldPersistTaps="handled"
                >
                  {filtered.length === 0 ? (
                    <View className="p-8">
                      <Text className="text-center text-muted-foreground text-sm">{emptyMessage}</Text>
                    </View>
                  ) : (
                    grouped.map(([group, list]) => (
                      <View key={group} className="mb-1">
                        <Text className="px-2 py-1.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
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
                              reduce={reduce}
                              onActivate={setActive}
                              onSelect={handleSelect}
                            />
                          );
                        })}
                      </View>
                    ))
                  )}
                </ScrollView>
              </MotiView>
            </View>
          </View>
        ) : null}
      </AnimatePresence>
    </Modal>
  );
}
