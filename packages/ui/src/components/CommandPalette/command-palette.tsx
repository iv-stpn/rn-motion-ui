import { AnimatePresence, MotiView } from 'moti';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  type StyleProp,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
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
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 24 },
  shadowOpacity: 0.25,
  shadowRadius: 40,
  elevation: 24,
} as const;

/** Icon renderer matching the `../../lib/icons` signature. */
export type CommandIcon = (props: { size?: number; color?: string }) => ReactNode;

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

export interface CommandPaletteProps {
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
}

function fuzzyMatch(needle: string, hay: string) {
  if (!needle) return true;
  const n = needle.toLowerCase();
  const h = hay.toLowerCase();
  let i = 0;
  for (const ch of h) {
    if (ch === n[i]) i++;
    if (i === n.length) return true;
  }
  return false;
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
}: CommandPaletteProps) {
  const reduce = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;
  const [rendered, setRendered] = useState(open);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const setOpen = useCallback(
    (v: boolean) => {
      if (!controlled) setInternalOpen(v);
      onOpenChange?.(v);
    },
    [controlled, onOpenChange],
  );

  useEffect(() => {
    if (open) {
      setRendered(true);
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
    filtered.forEach((it) => {
      const g = it.group ?? 'Results';
      const groupItems = map.get(g) ?? [];
      groupItems.push(it);
      map.set(g, groupItems);
    });
    return Array.from(map.entries());
  }, [filtered]);

  if (!rendered) return null;

  let cursor = 0;

  return (
    <Modal transparent={true} visible={rendered} animationType="none" onRequestClose={() => setOpen(false)}>
      <AnimatePresence onExitComplete={() => setRendered(false)}>
        {open ? (
          <View key="command-overlay" style={{ flex: 1 }} testID={testID}>
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: reduce ? 100 : 160 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            >
              <Pressable
                accessibilityLabel="Close"
                onPress={() => setOpen(false)}
                className="bg-background/60"
                style={{ flex: 1 }}
              />
            </MotiView>
            <View
              pointerEvents="box-none"
              className="flex-1 items-center px-4"
              style={{ paddingTop: Math.round(windowHeight * 0.18) }}
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
                <View className="flex-row items-center gap-3 border-b border-border px-4">
                  <Search size={16} color="#71717a" />
                  <TextInput
                    autoFocus={true}
                    value={query}
                    onChangeText={updateQuery}
                    placeholder={placeholder}
                    placeholderTextColor="#71717a"
                    accessibilityLabel={placeholder}
                    className="h-12 flex-1 text-sm text-foreground"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    onPress={() => setOpen(false)}
                    className="rounded border border-border bg-background px-1.5 py-0.5"
                  >
                    <Text className="text-[10px] text-muted-foreground">ESC</Text>
                  </Pressable>
                </View>
                <ScrollView
                  className="p-2"
                  style={{ maxHeight: Math.round(windowHeight * 0.6) }}
                  keyboardShouldPersistTaps="handled"
                >
                  {filtered.length === 0 ? (
                    <View className="p-8">
                      <Text className="text-center text-sm text-muted-foreground">{emptyMessage}</Text>
                    </View>
                  ) : (
                    grouped.map(([group, list]) => (
                      <View key={group} className="mb-1">
                        <Text className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {group}
                        </Text>
                        {list.map((it) => {
                          const idx = cursor++;
                          const isActive = idx === active;
                          const Icon = it.icon;
                          return (
                            <Pressable
                              key={it.id}
                              accessibilityRole="menuitem"
                              accessibilityLabel={it.label}
                              onPressIn={() => setActive(idx)}
                              onPress={() => {
                                it.onSelect();
                                setOpen(false);
                              }}
                              className="relative flex-row items-center gap-3 rounded-md px-2 py-2"
                            >
                              {isActive ? (
                                <MotiView
                                  key={`hl-${it.id}`}
                                  pointerEvents="none"
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
                                  }}
                                />
                              ) : null}
                              {Icon ? (
                                <Icon size={16} color={isActive ? '#111111' : '#71717a'} />
                              ) : hasIcons ? (
                                <View style={{ width: 16, height: 16 }} />
                              ) : null}
                              <Text
                                numberOfLines={1}
                                className={isActive ? 'flex-1 text-sm text-foreground' : 'flex-1 text-sm text-muted-foreground'}
                              >
                                {it.label}
                              </Text>
                              {it.badge ? <View className="shrink-0">{it.badge}</View> : null}
                              {it.hint ? (
                                <Text className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {it.hint}
                                </Text>
                              ) : null}
                            </Pressable>
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
