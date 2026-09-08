import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { type LayoutRectangle, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { usePressState } from '../../../hooks/use-press-state';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { SPRING_LAYOUT, SPRING_PRESS, SPRING_SWAP, springLayout } from '../../../lib/ease';
import type { SurfaceElevation } from '../../../lib/elevated';
import { H_INTERACTIVE, INTERACTIVE_HEIGHT } from '../../../lib/radius';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { TIMING_INSTANT } from '../../../theme/motion';
import { Surface } from '../../display/Surface/surface';
import { Text } from '../../typography/Text/text';

type DockContextValue = {
  size: number;
  /** Whether dock items render a tiny label beneath their icon. */
  showLabels: boolean;
  reduce: boolean;
  layouts: Record<string, LayoutRectangle>;
  register: (id: string, layout: LayoutRectangle) => void;
  activeId: string | null;
  setActive: (id: string, active: boolean) => void;
};

const DockContext = createContext<DockContextValue | null>(null);

// Container hairline border ("border-[1.5px] border-border" = 1.5px). The active
// pill is positioned against the padding box, so item layouts (border-box
// relative) are offset by this amount.
const BORDER_WIDTH = 1.5;
// Icon-only pill width factor — narrower than the labelled pill, so an icon-only
// item reads as a compact capsule instead of a square.
const ICON_PILL_ASPECT = 1.2;
// Labelled pill width factor — wider to fit the icon + caption column.
const LABEL_PILL_ASPECT = 1.8;
// The icon renders at its base size and scales up this much in labelled mode.
const LABEL_ICON_SCALE = 1.25;
/** Pill glide rides `springLayout` on `SPRING_LAYOUT`. */
const PILL_LAYOUT = springLayout(SPRING_LAYOUT);

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

// biome-ignore lint/style/useExportsLast: type LayoutEvent (private) must stay adjacent to DockItem below; hoisting all private types above would scatter the context-private/component-public grouping
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
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  // Item pixel size = container height less 4 px — 2 px breathing room on each
  // side so the item (and its full-size pill) sit inside the container rim.
  const itemPx = INTERACTIVE_HEIGHT[size] - 4;

  const register = useCallback((id: string, layout: LayoutRectangle) => {
    setLayouts((prev) => {
      const existing = prev[id];
      if (
        existing &&
        existing.x === layout.x &&
        existing.width === layout.width &&
        existing.y === layout.y &&
        existing.height === layout.height
      )
        return prev;
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
    () => ({ size: itemPx, showLabels, reduce, layouts, register, activeId, setActive }),
    [itemPx, showLabels, reduce, layouts, register, activeId, setActive],
  );

  const active = activeId ? layouts[activeId] : undefined;

  return (
    <DockContext.Provider value={ctx}>
      <Surface
        elevation={elevation}
        floating={floating}
        testID={testID}
        className={cn(
          showLabels ? 'px-2 py-1.5' : cn(H_INTERACTIVE[size], 'px-1'),
          'relative flex-row items-center gap-1.5 self-start rounded-full border-[1.5px] border-border',
          className,
        )}
        style={style}
      >
        {/* Shared-layout pill glides to the active item's measured rect. Item
            layouts are reported relative to the container's border box, but this
            absolutely-positioned pill is placed against the padding box (inside
            the 1.5px border) — subtract the border width so it overlays the item
            exactly. */}
        {active ? (
          <MotiView
            layout={reduce ? undefined : PILL_LAYOUT}
            className="pointer-events-none absolute rounded-full bg-surface-selected"
            style={{
              left: active.x - BORDER_WIDTH,
              top: active.y - BORDER_WIDTH,
              width: active.width,
              height: active.height,
            }}
          />
        ) : null}
        {children}
      </Surface>
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
  /** Text label shown beneath the icon when the dock's `showLabels` is on. */
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function DockItem({ children, onPress, active, accessibilityLabel, label, style, testID }: DockItemProps) {
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

  // A labelled item is wider and stacks the icon over a tiny, thin caption — the
  // mobile-dock look. The pill (measured from this box) wraps the full icon +
  // caption column. An icon-only item is a narrower, shorter pill.
  const labelled = Boolean(dock.showLabels && label);
  const scaleTransition = dock.reduce ? TIMING_INSTANT : SPRING_SWAP;
  const boxStyle: ViewStyle = labelled ? { width: size * LABEL_PILL_ASPECT } : { width: size * ICON_PILL_ASPECT, height: size };
  const contentClassName = cn('flex-col items-center justify-center rounded-full', labelled && 'gap-0.5');
  const renderedChildren =
    typeof children === 'string' || typeof children === 'number' ? <Text className="text-foreground">{children}</Text> : children;
  const iconNode = (
    <MotiView animate={{ scale: labelled ? LABEL_ICON_SCALE : 1 }} transition={scaleTransition}>
      {renderedChildren}
    </MotiView>
  );
  const labelNode = (
    <AnimatePresence>
      {labelled ? (
        <MotiView
          key="dock-label"
          from={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={scaleTransition}
        >
          <Text className="text-[10px]" numberOfLines={1}>
            {label}
          </Text>
        </MotiView>
      ) : null}
    </AnimatePresence>
  );

  if (onPress)
    return (
      <MotiView
        onLayout={onLayout}
        animate={{ scale: pressed && !dock?.reduce ? 0.9 : 1 }}
        transition={SPRING_PRESS}
        style={[{ position: 'relative' }, boxStyle]}
      >
        <Pressable
          accessibilityRole="button"
          aria-selected={Boolean(active)}
          accessibilityLabel={accessibilityLabel}
          testID={testID}
          {...pressHandlers}
          onPress={onPress}
          className={cn(contentClassName, !labelled && 'flex-1')}
          style={style}
        >
          {iconNode}
          {labelNode}
        </Pressable>
      </MotiView>
    );

  // Children carry their own control (and its accessible name).
  return (
    <View
      onLayout={onLayout}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className={contentClassName}
      style={[boxStyle, style]}
    >
      {iconNode}
      {labelNode}
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
