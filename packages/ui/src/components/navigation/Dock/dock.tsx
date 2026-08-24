import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { type LayoutRectangle, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { usePressState } from '../../../hooks/use-press-state';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { SPRING_LAYOUT, SPRING_PRESS } from '../../../lib/ease';
import type { SurfaceElevation } from '../../../lib/elevated';
import { H_INTERACTIVE, INTERACTIVE_HEIGHT, PX_INTERACTIVE } from '../../../lib/radius';
import { surface } from '../../../lib/surface';
import { MotiView } from '../../../moti/components/view';
import { Text } from '../../typography/Text/text';

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
  /** Height variant — drives the container's interactive size token and item dimensions. Default `lg`. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Whether the dock bar casts the `shadow-elevated-N` recipe (drop + dark rim).
   * `false` drops the shadow so the surface sits flat, keeping its surface tint.
   * Defaults to `true`.
   */
  elevated?: boolean;
  /**
   * Surface elevation of the dock bar (0–8) — drives the background tint and,
   * when `elevated`, the drop shadow + dark-mode rim. `0` is the flat resting
   * surface (no shadow or border). Defaults to `0`.
   */
  elevation?: SurfaceElevation;
  /** Additional UniWind class names merged onto the dock bar. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// biome-ignore lint/style/useExportsLast: type LayoutEvent (private) must stay adjacent to DockItem below; hoisting all private types above would scatter the context-private/component-public grouping
export function Dock({ children, size = 'lg', elevated = true, elevation = 0, className, style, testID }: DockProps) {
  const reduce = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  // Item pixel size = container height less 4 px — 2 px inset on each side so the
  // active pill centres on the item.
  const itemPx = INTERACTIVE_HEIGHT[size] - 4;

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
    () => ({ size: itemPx, reduce, layouts, register, activeId, setActive }),
    [itemPx, reduce, layouts, register, activeId, setActive],
  );

  const active = activeId ? layouts[activeId] : undefined;

  return (
    <DockContext.Provider value={ctx}>
      <View
        testID={testID}
        className={cn(
          H_INTERACTIVE[size],
          PX_INTERACTIVE[size],
          'relative flex-row items-center gap-1.5 self-start rounded-2xl border border-border',
          surface(elevation, undefined, elevated),
          className,
        )}
        style={style}
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
            className="pointer-events-none absolute top-0 left-0 rounded-xl bg-surface-selected"
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
  if (!dock) throw new Error('DockItem must be used inside <Dock>');
  const id = useId();
  const size = dock?.size ?? 44;
  const { pressed, pressHandlers } = usePressState();

  // biome-ignore lint/plugin: reporting active state to the parent context must happen as a side effect — calling setActive during render would be setState-in-render
  useEffect(() => {
    dock?.setActive(id, Boolean(active));
  }, [dock, id, active]);

  const onLayout = useCallback((e: LayoutEvent) => dock?.register(id, e.nativeEvent.layout), [dock, id]);

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
          {...pressHandlers}
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

export type DockSeparatorProps = { style?: StyleProp<ViewStyle> };

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
