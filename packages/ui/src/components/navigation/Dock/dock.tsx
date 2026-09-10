import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  type LayoutRectangle,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useDirection } from '../../../hooks/use-direction';
import { usePressState } from '../../../hooks/use-press-state';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { SPRING_PRESS } from '../../../lib/ease';
import type { SurfaceElevation } from '../../../lib/elevated';
import { INTERACTIVE_HEIGHT } from '../../../lib/radius';
import { MotiView } from '../../../moti/components/view';
import { Surface } from '../../display/Surface/surface';
import { Text } from '../../typography/Text/text';
import { DOCK_GAP, DOCK_INSET, dockMetrics } from './dock-metrics';
import { DockContent, DockFrame, DockHighlight } from './dock-motion';
import { dockSizeMotion } from './dock-transition';

type DockContextValue = {
  size: number;
  showLabels: boolean;
  reduce: boolean;
  layouts: Record<string, LayoutRectangle>;
  register: (id: string, layout: LayoutRectangle | null) => void;
  setActive: (id: string, active: boolean) => void;
};

const DockContext = createContext<DockContextValue | null>(null);
const BORDER_WIDTH = 1.5;

/** Keep a custom item's layout in the target row and its decoration on the moving frame. */
function splitItemStyle(style: StyleProp<ViewStyle>) {
  const {
    width,
    height,
    margin,
    marginHorizontal,
    marginVertical,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    marginStart,
    marginEnd,
    alignSelf,
    ...presentation
  } = StyleSheet.flatten(style) ?? {};
  return {
    slot: {
      width,
      height,
      margin,
      marginHorizontal,
      marginVertical,
      marginLeft,
      marginRight,
      marginTop,
      marginBottom,
      marginStart,
      marginEnd,
      alignSelf,
    },
    presentation,
  };
}

export type DockProps = {
  children: ReactNode;
  /** Height variant — drives the container's interactive size token and item dimensions. Default `lg`. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Swap the bar's ladder shadow for the input field's large, diffuse halo
   * (`shadow-floating`). It replaces the `shadow-elevated-N` rung rather than
   * adding to it, so the bar keeps its `elevation` tint but trades the
   * layered drop for the halo. @default false
   */
  floating?: boolean;
  /**
   * Surface elevation of the dock bar (0–8) — drives the background tint and the
   * `shadow-elevated-N` recipe (drop + dark-mode rim). `0` is the flat resting
   * surface (no shadow or border). Defaults to `0`.
   */
  elevation?: SurfaceElevation;
  /** Additional UniWind class names merged onto the dock bar. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * When true, dock items that provide a `label` render a tiny, thin caption
   * beneath their icon (a mobile-dock style). Items without a `label` keep their
   * icon-only pill. @default false
   */
  showLabels?: boolean;
};

export function Dock({
  children,
  size = 'lg',
  floating = false,
  elevation = 0,
  className,
  style,
  testID,
  showLabels = false,
}: DockProps) {
  const reduce = useReducedMotion();
  const direction = useDirection();
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [row, setRow] = useState<{ width: number; height: number } | null>(null);
  const itemPx = INTERACTIVE_HEIGHT[size] - 4;

  const register = useCallback((id: string, layout: LayoutRectangle | null) => {
    setLayouts((prev) => {
      if (!layout) return Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id));
      const existing = prev[id];
      if (
        existing &&
        existing.x === layout.x &&
        existing.y === layout.y &&
        existing.width === layout.width &&
        existing.height === layout.height
      )
        return prev;
      return { ...prev, [id]: layout };
    });
  }, []);
  const setActive = useCallback((id: string, isActive: boolean) => {
    setActiveId((prev) => {
      if (isActive) return id;
      return prev === id ? null : prev;
    });
  }, []);
  const measureRow = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setRow((prev) => (prev?.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  const ctx = useMemo<DockContextValue>(
    () => ({ size: itemPx, showLabels, reduce, layouts, register, setActive }),
    [itemPx, showLabels, reduce, layouts, register, setActive],
  );
  const inset = DOCK_INSET + BORDER_WIDTH;
  const motion = row ? dockSizeMotion(row.width + inset * 2, row.height + inset * 2, reduce) : { style: undefined };

  return (
    <DockContext.Provider value={ctx}>
      <Surface
        as={MotiView}
        {...motion}
        elevation={elevation}
        floating={floating}
        testID={testID}
        className={cn('relative self-center rounded-full border-[1.5px] border-border', className)}
        style={[motion.style, { padding: DOCK_INSET }, style]}
      >
        {/* Target slots use normal Yoga layout, never animated measurements. The
            borderless row gives the pill and every visible frame one origin.
            Slots are position:static so their frames use this row as the containing
            block, without a one-frame jump when a slot changes position. */}
        <View
          onLayout={measureRow}
          className="relative flex-row items-center self-start"
          style={{ gap: DOCK_GAP, flexShrink: 0, direction }}
        >
          <DockHighlight
            rect={activeId ? layouts[activeId] : undefined}
            reduce={reduce}
            testID={`${testID ?? 'dock'}-highlight`}
          />
          {children}
        </View>
      </Surface>
    </DockContext.Provider>
  );
}

export type DockItemProps = {
  children: ReactNode;
  /** When set, the item renders as a pressable button. Omit when children carry their own control. */
  onPress?: () => void;
  active?: boolean;
  accessibilityLabel?: string;
  /** Text label shown beneath the icon when the dock's `showLabels` is on. */
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function DockItem({ children, onPress, active, accessibilityLabel, label, style, testID }: DockItemProps) {
  const dock = useContext(DockContext);
  if (!dock) throw new Error('DockItem must be used inside <Dock>');
  const id = useId();
  const { size, reduce, register, setActive } = dock;
  const { pressed, pressHandlers } = usePressState();
  // biome-ignore lint/plugin: reporting selection to the compound parent is a side effect
  useEffect(() => {
    setActive(id, Boolean(active));
    return () => setActive(id, false);
  }, [setActive, id, active]);
  // biome-ignore lint/plugin: remove the measured registration when this item unmounts
  useEffect(() => () => register(id, null), [register, id]);
  const labelled = Boolean(dock.showLabels && label);
  const onLayout = useCallback((event: LayoutChangeEvent) => register(id, event.nativeEvent.layout), [register, id]);
  const { width, height } = dockMetrics(size, labelled);
  const rect = dock.layouts[id];
  const custom = splitItemStyle(onPress ? undefined : style);
  const content = (
    <DockContent itemPx={size} labelled={labelled} active={active} reduce={reduce} label={label}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text className="text-foreground">{children}</Text>
      ) : (
        children
      )}
    </DockContent>
  );

  return (
    <View
      onLayout={onLayout}
      style={[custom.slot, { width: custom.slot.width ?? width, height: custom.slot.height ?? height, position: 'static' }]}
    >
      {rect ? (
        <DockFrame rect={rect} reduce={reduce}>
          <MotiView animate={{ scale: pressed && !reduce ? 0.9 : 1 }} transition={SPRING_PRESS} className="flex-1">
            {onPress ? (
              <Pressable
                accessibilityRole="button"
                aria-selected={Boolean(active)}
                accessibilityLabel={accessibilityLabel ?? label}
                testID={testID}
                {...pressHandlers}
                onPress={onPress}
                className="relative flex-1 items-center justify-center rounded-full"
                style={style}
              >
                {content}
              </Pressable>
            ) : (
              <View
                accessibilityLabel={accessibilityLabel}
                testID={testID}
                className="relative flex-1 items-center justify-center rounded-full"
                style={custom.presentation}
              >
                {content}
              </View>
            )}
          </MotiView>
        </DockFrame>
      ) : null}
    </View>
  );
}

export type DockSeparatorProps = { style?: StyleProp<ViewStyle> };

export function DockSeparator({ style }: DockSeparatorProps) {
  const reduce = useReducedMotion();
  const [rect, setRect] = useState<LayoutRectangle>();
  const measure = useCallback((event: LayoutChangeEvent) => setRect(event.nativeEvent.layout), []);
  const custom = splitItemStyle(style);
  return (
    <View
      onLayout={measure}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
      className="mx-1 h-6 w-px self-center"
      style={[custom.slot, { position: 'static' }]}
    >
      {rect ? (
        <DockFrame rect={rect} reduce={reduce}>
          <View className="flex-1 bg-border" style={custom.presentation} />
        </DockFrame>
      ) : null}
    </View>
  );
}
