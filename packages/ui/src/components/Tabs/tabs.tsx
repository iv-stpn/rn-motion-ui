import { cva } from 'class-variance-authority';
import { MotiView } from 'moti';
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';
import { type LayoutRectangle, type NativeSyntheticEvent, Pressable, Text, View } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

type Variant = 'pill' | 'underline' | 'segment';

type Layout = LayoutRectangle;

type Ctx = {
  value: string;
  setValue: (v: string) => void;
  variant: Variant;
  layouts: Record<string, Layout>;
  register: (value: string, layout: Layout) => void;
  reduce: boolean;
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
  testID?: string;
};

export function Tabs({ defaultValue, value, onValueChange, variant = 'pill', children, testID }: TabsProps) {
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
    <TabsCtx.Provider value={{ value: current, setValue, variant, layouts, register, reduce }}>
      <View testID={testID}>{children}</View>
    </TabsCtx.Provider>
  );
}

export type TabsListProps = { children: ReactNode };

// biome-ignore lint/style/useExportsLast: component exported before TabsTrigger helper — collocated for readability
export function TabsList({ children }: TabsListProps) {
  const { variant, value, layouts, reduce } = useTabs();
  const active = layouts[value];

  let indicatorBorderRadius: number;
  if (variant === 'pill') indicatorBorderRadius = 9999;
  else if (variant === 'segment') indicatorBorderRadius = 8;
  else indicatorBorderRadius = 0;

  return (
    <View className={list({ variant })} style={{ position: 'relative', alignSelf: 'flex-start' }}>
      {/* Shared-layout indicator: a single MotiView that glides to the active
          trigger's measured rect. Mirrors the web layoutId pill. */}
      {active ? (
        <MotiView
          animate={{
            translateX: active.x,
            width: active.width,
            translateY: variant === 'underline' ? active.y + active.height - 2 : active.y,
            height: variant === 'underline' ? 2 : active.height,
          }}
          transition={reduce ? { type: 'timing', duration: 0 } : { type: 'spring', stiffness: 170, damping: 24, mass: 1.2 }}
          pointerEvents="none"
          className="bg-primary"
          style={{
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

  const onLayout = useCallback(
    (e: NativeSyntheticEvent<{ layout: Layout }>) => register(value, e.nativeEvent.layout),
    [register, value],
  );
  const onPress = useCallback(() => setValue(value), [setValue, value]);

  return (
    <Pressable
      accessibilityRole="tab"
      aria-selected={active}
      onPress={onPress}
      onLayout={onLayout}
      className={variant === 'underline' ? 'px-3 pt-1 pb-2.5' : 'px-3.5 py-1.5'}
    >
      <Text
        className={active ? 'font-medium text-primary-foreground text-sm' : 'font-medium text-muted-foreground text-sm'}
        // Underline variant keeps dark text (indicator is a thin line, not a fill).
        style={variant === 'underline' && active ? { color: '#111111' } : undefined}
      >
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
