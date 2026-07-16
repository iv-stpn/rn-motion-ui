import { MotiView } from 'moti';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { type LayoutRectangle, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { SPRING_LAYOUT, SPRING_PRESS } from '../../lib/ease';

// RN FALLBACK vs web: the web dock scales items on cursor proximity (magnify on
// hover) — there is no touch equivalent, so magnify is dropped. Items instead
// get a press-scale spring for tactile feedback. The active-item pill still
// glides between items via a measured shared-layout indicator (like tabs.tsx),
// standing in for the web `layoutId` pill.
type DockContextValue = {
  size: number;
  reduce: boolean;
  layouts: Record<string, LayoutRectangle>;
  register: (id: string, layout: LayoutRectangle) => void;
  activeId: string | null;
  setActive: (id: string, active: boolean) => void;
};

const DockContext = createContext<DockContextValue | null>(null);

// Container hairline border ("border border-border" = 1px). The active pill is
// positioned against the padding box, so item layouts (border-box relative) are
// offset by this amount.
const BORDER_WIDTH = 1;
// Gap between the pill edge and the item edge on every side.
const PILL_INSET = 2;

export interface DockProps {
  children: ReactNode;
  /** Size of each item in px. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Dock({ children, size = 44, style, testID }: DockProps) {
  const reduce = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const register = useCallback((id: string, layout: LayoutRectangle) => {
    setLayouts((prev) => {
      const existing = prev[id];
      if (existing && existing.x === layout.x && existing.width === layout.width && existing.y === layout.y) return prev;
      return { ...prev, [id]: layout };
    });
  }, []);

  const setActive = useCallback((id: string, active: boolean) => {
    setActiveId((prev) => (active ? id : prev === id ? null : prev));
  }, []);

  const ctx = useMemo<DockContextValue>(
    () => ({ size, reduce, layouts, register, activeId, setActive }),
    [size, reduce, layouts, register, activeId, setActive],
  );

  const active = activeId ? layouts[activeId] : undefined;

  return (
    <DockContext.Provider value={ctx}>
      <View
        testID={testID}
        className="flex-row items-end gap-1.5 self-start rounded-2xl border border-border bg-card px-2 py-1"
        style={[{ position: 'relative' }, style]}
      >
        {/* Shared-layout pill glides to the active item's measured rect. Item
            layouts are reported relative to the container's border box, but this
            absolutely-positioned pill is placed against the padding box (inside
            the 1px border) — subtract the border width so it centres on the item. */}
        {active ? (
          <MotiView
            animate={{
              translateX: active.x + PILL_INSET - BORDER_WIDTH,
              translateY: active.y + PILL_INSET - BORDER_WIDTH,
              width: active.width - PILL_INSET * 2,
              height: active.height - PILL_INSET * 2,
            }}
            transition={reduce ? { type: 'timing', duration: 0 } : SPRING_LAYOUT}
            pointerEvents="none"
            className="bg-primary/5"
            style={{ position: 'absolute', left: 0, top: 0, borderRadius: 12 }}
          />
        ) : null}
        {children}
      </View>
    </DockContext.Provider>
  );
}

export interface DockItemProps {
  children: ReactNode;
  /** When set, the item renders as a pressable button. Omit when children carry their own control. */
  onPress?: () => void;
  active?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function DockItem({ children, onPress, active, accessibilityLabel, style, testID }: DockItemProps) {
  const dock = useContext(DockContext);
  const id = useId();
  const size = dock?.size ?? 44;
  const [pressed, setPressed] = useState(false);

  // Report active state up so the shared pill can glide to this item.
  useEffect(() => {
    dock?.setActive(id, !!active);
  }, [dock, id, active]);

  const onLayout = useCallback(
    (e: { nativeEvent: { layout: LayoutRectangle } }) => dock?.register(id, e.nativeEvent.layout),
    [dock, id],
  );

  const sharedStyle = { width: size, height: size };

  if (onPress)
    return (
      <MotiView
        onLayout={onLayout}
        animate={{ scale: pressed && !dock?.reduce ? 0.9 : 1 }}
        transition={SPRING_PRESS}
        style={[{ position: 'relative' }, sharedStyle]}
      >
        <Pressable
          accessibilityRole="button"
          aria-selected={!!active}
          accessibilityLabel={accessibilityLabel}
          testID={testID}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          onPress={onPress}
          className="flex-1 items-center justify-center rounded-full"
          style={style}
        >
          {children}
        </Pressable>
      </MotiView>
    );

  // Children carry their own control (and its accessible name).
  return (
    <View
      onLayout={onLayout}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className="items-center justify-center rounded-full"
      style={[sharedStyle, style]}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text className="text-foreground">{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export interface DockSeparatorProps {
  style?: StyleProp<ViewStyle>;
}

export function DockSeparator({ style }: DockSeparatorProps) {
  return (
    <View
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
      className="mx-1 h-6 w-px self-center bg-border"
      style={style}
    />
  );
}
