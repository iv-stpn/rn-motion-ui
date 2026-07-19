import { useReducedMotion } from '@rn-motion-ui/hooks/use-reduced-motion';
import { MotiView } from '@rn-motion-ui/moti/view';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { type LayoutRectangle, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
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

export type DockProps = {
  children: ReactNode;
  /** Size of each item in px. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// biome-ignore lint/style/useExportsLast: type LayoutEvent (private) must stay adjacent to DockItem below; hoisting all private types above would scatter the context-private/component-public grouping
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

  const setActive = useCallback((id: string, isActive: boolean) => {
    setActiveId((prev) => {
      if (isActive) return id;
      if (prev === id) return null;
      return prev;
    });
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
            className="bg-primary/5"
            style={{ position: 'absolute', left: 0, top: 0, borderRadius: 12, pointerEvents: 'none' }}
          />
        ) : null}
        {children}
      </View>
    </DockContext.Provider>
  );
}

type LayoutEvent = { nativeEvent: { layout: LayoutRectangle } };

export type DockItemProps = {
  children: ReactNode;
  /** When set, the item renders as a pressable button. Omit when children carry their own control. */
  onPress?: () => void;
  active?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function DockItem({ children, onPress, active, accessibilityLabel, style, testID }: DockItemProps) {
  const dock = useContext(DockContext);
  const id = useId();
  const size = dock?.size ?? 44;
  const [pressed, setPressed] = useState(false);

  // biome-ignore lint/plugin: reporting active state to the parent context must happen as a side effect — calling setActive during render would be setState-in-render
  useEffect(() => {
    dock?.setActive(id, Boolean(active));
  }, [dock, id, active]);

  const onLayout = useCallback((e: LayoutEvent) => dock?.register(id, e.nativeEvent.layout), [dock, id]);

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);

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
          aria-selected={Boolean(active)}
          accessibilityLabel={accessibilityLabel}
          testID={testID}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
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

export type DockSeparatorProps = {
  style?: StyleProp<ViewStyle>;
};

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
