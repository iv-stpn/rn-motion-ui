import { cva } from 'class-variance-authority';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  type LayoutRectangle,
  type NativeSyntheticEvent,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { MotiView } from '../../moti/components/view';
import { type MotiTransitionProp, mergeTransition, TIMING_INSTANT } from '../../theme/motion';

const TAB_INDICATOR_SPRING = { type: 'spring' as const, stiffness: 170, damping: 24, mass: 1.2 };

type Variant = 'pill' | 'underline' | 'segment';

type Layout = LayoutRectangle;

type Ctx = {
  value: string;
  setValue: (v: string) => void;
  variant: Variant;
  layouts: Record<string, Layout>;
  register: (value: string, layout: Layout) => void;
  reduce: boolean;
  indicatorTransition?: Partial<MotiTransitionProp>;
};

const TabsCtx = createContext<Ctx | null>(null);

function useTabs() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error('Tabs.* must be used inside <Tabs>');
  return ctx;
}

const list = cva('flex-row items-center', {
  variants: {
    variant: {
      pill: 'gap-1 rounded-full bg-card p-1',
      underline: 'gap-1 border-b border-border',
      segment: 'gap-0 rounded-lg bg-card p-0.5',
    },
  },
  defaultVariants: { variant: 'pill' },
});

export type TabsProps = {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  variant?: Variant;
  children: ReactNode;
  /** Additional NativeWind class names merged onto the outer wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * Override the active-indicator slide spring. Partial — only changed fields needed.
   * Default: `MOTION_STANDARD` tuned for tab indicators (stiffness 170, damping 24, mass 1.2).
   */
  indicatorTransition?: Partial<MotiTransitionProp>;
};

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  variant = 'pill',
  children,
  className,
  style,
  testID,
  indicatorTransition,
}: TabsProps) {
  const reduce = useReducedMotion();
  const [internal, setInternal] = useState(defaultValue ?? '');
  const [layouts, setLayouts] = useState<Record<string, Layout>>({});
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  const setValue = useCallback(
    (v: string) => {
      if (!controlled) setInternal(v);
      onValueChange?.(v);
    },
    [controlled, onValueChange],
  );

  const register = useCallback((v: string, layout: Layout) => {
    setLayouts((prev) => {
      const existing = prev[v];
      if (existing && existing.x === layout.x && existing.width === layout.width) return prev;
      return { ...prev, [v]: layout };
    });
  }, []);

  return (
    <TabsCtx.Provider value={{ value: current, setValue, variant, layouts, register, reduce, indicatorTransition }}>
      <View testID={testID} className={cn(className)} style={style}>
        {children}
      </View>
    </TabsCtx.Provider>
  );
}

export type TabsListProps = { children: ReactNode };

// biome-ignore lint/style/useExportsLast: component exported before TabsTrigger helper — collocated for readability
export function TabsList({ children }: TabsListProps) {
  const { variant, value, layouts, reduce, indicatorTransition } = useTabs();
  const active = layouts[value];
  const indicatorSpring = mergeTransition(TAB_INDICATOR_SPRING, indicatorTransition);
  // Track whether the indicator has been placed once so the first render jumps
  // directly to the selected tab instead of animating from wherever MotiView
  // initialises (avoids the "slide from tab-1" flash on mount).
  const hasPositioned = useRef(false);
  // biome-ignore lint/plugin: tracking first-commit of `active` requires a post-render hook; no derived-state equivalent is Strict-Mode-safe
  useEffect(() => {
    if (active) hasPositioned.current = true;
  }, [active]);

  let indicatorBorderRadius: number;
  if (variant === 'pill') indicatorBorderRadius = 9999;
  else if (variant === 'segment') indicatorBorderRadius = 8;
  else indicatorBorderRadius = 0;

  return (
    <View className={list({ variant })} style={{ position: 'relative', alignSelf: 'flex-start' }}>
      {/* Shared-layout indicator: a single MotiView that glides to the active
          trigger's measured rect. Mirrors the web layoutId pill. White for
          pill/segment so trigger text keeps its dark color while the pill is
          still gliding over. */}
      {active ? (
        <MotiView
          animate={{
            translateX: active.x,
            width: active.width,
            translateY: variant === 'underline' ? active.y + active.height - 2 : active.y,
            height: variant === 'underline' ? 2 : active.height,
          }}
          transition={!hasPositioned.current || reduce ? TIMING_INSTANT : indicatorSpring}
          className={variant === 'underline' ? 'bg-primary' : 'bg-surface'}
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            left: 0,
            top: 0,
            borderRadius: indicatorBorderRadius,
          }}
        />
      ) : null}
      {children}
    </View>
  );
}

type TabsTriggerProps = { value: string; children: ReactNode };

export function TabsTrigger({ value, children }: TabsTriggerProps) {
  const { value: current, setValue, variant, register } = useTabs();
  const active = current === value;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);

  const onLayout = useCallback(
    (e: NativeSyntheticEvent<{ layout: Layout }>) => register(value, e.nativeEvent.layout),
    [register, value],
  );
  const onPress = useCallback(() => setValue(value), [setValue, value]);
  const onHoverIn = useCallback(() => setHovered(true), []);
  const onHoverOut = useCallback(() => setHovered(false), []);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);
  const onPressIn = useCallback(() => setPressed(true), []);
  const onPressOut = useCallback(() => setPressed(false), []);

  const highlighted = active || hovered || focused || pressed;

  return (
    <Pressable
      accessibilityRole="tab"
      aria-selected={active}
      onPress={onPress}
      onLayout={onLayout}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      onFocus={onFocus}
      onBlur={onBlur}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      className={variant === 'underline' ? 'px-3 pt-1 pb-2.5' : 'px-3.5 py-1.5'}
    >
      <Text className={highlighted ? 'font-medium text-foreground text-sm' : 'font-medium text-muted-foreground text-sm'}>
        {children}
      </Text>
    </Pressable>
  );
}

type TabsContentProps = { value: string; children: ReactNode };

export function TabsContent({ value, children }: TabsContentProps) {
  const { value: current, reduce } = useTabs();
  if (current !== value) return null;
  return (
    <MotiView
      from={{ opacity: 0, translateY: reduce ? 0 : 4 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 180 }}
      style={{ marginTop: 16 }}
    >
      {children}
    </MotiView>
  );
}
