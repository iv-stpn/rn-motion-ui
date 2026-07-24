import { cva } from 'class-variance-authority';
import { createContext, type ReactNode, type RefObject, useCallback, useContext, useRef, useState } from 'react';
import { type LayoutRectangle, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { MotiView } from '../../moti/components/view';
import { MOTION_SNAPPY, type MotiTransitionProp, mergeTransition, TIMING_INSTANT } from '../../theme/motion';
import { Text } from '../Text/text';

type CardChoiceCtx = {
  value: string;
  setValue: (value: string) => void;
  reduce: boolean;
  /** Group container, used as the reference frame for each ring's measurement. */
  groupRef: RefObject<View | null>;
  /** Report a card's radio-ring box, already resolved to group-relative coords. */
  register: (value: string, ring: LayoutRectangle) => void;
};

const CardChoiceContext = createContext<CardChoiceCtx | null>(null);

// biome-ignore lint/style/useExportsLast: props type before layout constants — collocated for readability
export type CardChoiceGroupProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  orientation?: 'vertical' | 'horizontal';
  /** Additional NativeWind class names merged onto the group container. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * Override the indicator animation. Partial — only the fields you pass are changed.
   * Default: `MOTION_SNAPPY` (stiffness 500, damping 30, mass 0.6).
   */
  transition?: Partial<MotiTransitionProp>;
};

// Layout swaps the flex direction; cards keep flex-1 so a row shares width evenly.
const group = cva('gap-3', {
  variants: {
    orientation: {
      vertical: 'flex-col',
      horizontal: 'flex-row',
    },
  },
  defaultVariants: { orientation: 'horizontal' },
});

// The gliding dot (DOT_SIZE = 10 px, h-2.5) is centred inside each card's radio
// ring using the ring's *measured* box (see CardChoice's onLayout →
// measureInWindow), so alignment holds regardless of the card's border, padding
// or header-row height — no geometry is assumed.
const DOT_SIZE = 10;

export function CardChoiceGroup({
  value,
  defaultValue = '',
  onValueChange,
  children,
  orientation = 'horizontal',
  className,
  style,
  testID,
  transition,
}: CardChoiceGroupProps) {
  const reduce = useReducedMotion();
  const groupRef = useRef<View | null>(null);
  const [internal, setInternal] = useState(defaultValue);
  const [rings, setRings] = useState<Record<string, LayoutRectangle>>({});
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const indicatorSpring = mergeTransition(MOTION_SNAPPY, transition);

  const setValue = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  const register = useCallback((v: string, ring: LayoutRectangle) => {
    setRings((prev) => {
      const existing = prev[v];
      if (
        existing &&
        existing.x === ring.x &&
        existing.y === ring.y &&
        existing.width === ring.width &&
        existing.height === ring.height
      )
        return prev;
      return { ...prev, [v]: ring };
    });
  }, []);

  const activeRing = rings[current];

  return (
    <CardChoiceContext.Provider value={{ value: current, setValue, reduce, groupRef, register }}>
      <View
        ref={groupRef}
        accessibilityRole="radiogroup"
        testID={testID}
        className={cn(group({ orientation }), className)}
        style={[{ position: 'relative' }, style]}
      >
        {/* Single shared dot that glides to the active card — mirrors the web
            layoutId pattern. Each CardChoice measures its radio ring against this
            group container (measureInWindow) and reports it via `register`; the
            dot is centred on that ring's real box, so it stays centred whatever
            the card's border/padding or header-row height. The transparent ring
            centre lets the dot show through even though it renders behind the
            cards. */}
        {activeRing ? (
          <MotiView
            animate={{
              translateX: activeRing.x + (activeRing.width - DOT_SIZE) / 2,
              translateY: activeRing.y + (activeRing.height - DOT_SIZE) / 2,
            }}
            transition={reduce ? TIMING_INSTANT : indicatorSpring}
            className="h-2.5 w-2.5 rounded-full bg-primary"
            style={{ pointerEvents: 'none', position: 'absolute', left: 0, top: 0 }}
          />
        ) : null}
        {children}
      </View>
    </CardChoiceContext.Provider>
  );
}

export type CardChoiceProps = {
  title: string;
  subtitle?: string;
  /** Short text shown in a pill in the top-right corner (e.g. a savings badge). */
  badge?: string;
  /** Custom content rendered below the title/subtitle. */
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Applies tabular figures to the subtitle (useful when it's a money amount or
   * other number that should align). Matches the repo's `fontVariant` convention.
   */
  numeric?: boolean;
  /**
   * Inside a `<CardChoiceGroup>`, the value this card selects. The group's shared
   * indicator glides to whichever card matches the group's current value.
   */
  value?: string;
  /** Standalone selected state. Ignored inside a `<CardChoiceGroup>`. */
  selected?: boolean;
  /** Standalone press handler. Ignored inside a `<CardChoiceGroup>`. */
  onPress?: () => void;
};

/**
 * A selectable card with a radio indicator, title/subtitle and an optional badge.
 * Use inside a row/grid for single-select choices (e.g. billing periods, plans).
 *
 * Standalone, drive it with `selected` + `onPress`. Wrapped in a
 * `<CardChoiceGroup>` and given a `value`, the group renders a single indicator
 * that glides between cards instead of each card toggling its own dot.
 */
export function CardChoice({
  value,
  selected: selectedProp,
  onPress,
  title,
  subtitle,
  badge,
  children,
  className,
  style,
  numeric = false,
}: CardChoiceProps) {
  const groupCtx = useContext(CardChoiceContext);
  const inGroup = groupCtx !== null && value !== undefined;
  const selected = inGroup ? groupCtx.value === value : Boolean(selectedProp);
  const ringRef = useRef<View | null>(null);

  const handlePress = useCallback(() => {
    if (groupCtx && value !== undefined) groupCtx.setValue(value);
    else onPress?.();
  }, [groupCtx, value, onPress]);

  // Measure the radio ring against the group container so the shared gliding dot
  // can centre on the ring's real box. Both measurements are in window space; the
  // subtraction yields the ring's position relative to the group (its offset
  // parent). Runs on the Pressable's onLayout — re-measures whenever the card's
  // box settles or shifts (mount, row reflow, orientation change).
  const measureRing = useCallback(() => {
    if (!groupCtx || value === undefined) return;
    const ring = ringRef.current;
    const groupNode = groupCtx.groupRef.current;
    if (!(ring && groupNode)) return;
    groupNode.measureInWindow((gx, gy) => {
      ring.measureInWindow((rx, ry, rw, rh) => {
        groupCtx.register(value, { x: rx - gx, y: ry - gy, width: rw, height: rh });
      });
    });
  }, [groupCtx, value]);

  return (
    <Pressable
      onPress={handlePress}
      onLayout={measureRing}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={style}
      className={cn(
        'flex-1 gap-3 rounded-2xl border p-4',
        selected ? 'border-primary bg-primary/5' : 'border-border bg-transparent',
        className,
      )}
    >
      <View className="flex-row items-center justify-between">
        {/* Inlined radio ring — only this component uses it here, so a separate
            file would fragment a tightly-coupled presentational bit. Standalone
            it renders its own dot; inside a group the shared gliding dot from
            CardChoiceGroup replaces it. */}
        <View
          ref={ringRef}
          onLayout={measureRing}
          className={cn('h-5 w-5 items-center justify-center rounded-full border', selected ? 'border-primary' : 'border-border')}
        >
          {selected && !inGroup ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
        </View>
        {badge ? (
          <View className="rounded-full bg-primary/10 px-2 py-0.5">
            <Text className="font-semibold text-primary text-xs">{badge}</Text>
          </View>
        ) : null}
      </View>
      <View className="gap-1">
        <Text className="font-semibold text-base text-foreground">{title}</Text>
        {subtitle ? (
          <Text className="text-muted-foreground text-sm" style={numeric ? { fontVariant: ['tabular-nums'] } : undefined}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
    </Pressable>
  );
}
