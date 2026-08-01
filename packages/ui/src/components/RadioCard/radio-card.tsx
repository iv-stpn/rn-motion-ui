import { cva } from 'class-variance-authority';
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { cssColorToOklch, oklchToSrgb } from '../../lib/color';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { type MotiTransitionProp, mergeTransition, TIMING_FAST, TIMING_INSTANT } from '../../theme/motion';
import { useThemeColor } from '../../theme/use-theme-color';
import { Text } from '../Text/text';

/** Opacity of the selected card's `info` wash — the animated `bg-info/5`. */
const TINT_ALPHA = 0.05;

/**
 * The selection accent at a given alpha, derived from the live token so a
 * consumer `@theme` override carries into the tint.
 *
 * Both ends of the background cross-fade are this same hue — the unselected end
 * is simply alpha 0. Animating from a literal `transparent` instead would
 * interpolate through `rgba(0,0,0,0)` and wash the card grey on the way in.
 */
function tintAt(color: string, alpha: number) {
  const oklch = cssColorToOklch(color);
  // Unparseable token (a named color, `currentColor`): skip the tint rather than
  // guess at a fill, which would land opaque. Both ends of the cross-fade take
  // this branch together, so the literal here only ever interpolates against
  // itself — the grey wash described above needs two *different* ends to appear.
  if (!oklch) return 'transparent';
  return oklchToSrgb(oklch.lightness, oklch.chroma, oklch.hue, alpha);
}

type RadioCardRingProps = {
  selected: boolean;
  /** Resolved selection animation, already merged with the group/card overrides. */
  transition: MotiTransitionProp;
  /** The card's resolved testID; the ring and dot derive from it. */
  testID?: string;
};

/**
 * The radio ring and its dot. Kept private to this file because only `RadioCard`
 * renders it, and split out of the card body so the card stays readable.
 *
 * The ring's border cross-fades between `border` and `info` as a real color
 * interpolation; the dot fades and scales in place. Nothing is measured — each
 * card owns its own dot, so there is no cross-card geometry to resolve.
 */
function RadioCardRing({ selected, transition, testID }: RadioCardRingProps) {
  const reduce = useReducedMotion();
  // Resolve both ends of the border cross-fade through the token bridge so they
  // follow consumer @theme overrides.
  const info = useThemeColor('info');
  const border = useThemeColor('border');
  const t = reduce ? TIMING_INSTANT : transition;

  return (
    <MotiView
      animate={{ borderColor: selected ? info : border }}
      transition={t}
      testID={testID ? `${testID}-ring` : undefined}
      className="h-5 w-5 items-center justify-center rounded-full border"
    >
      <AnimatePresence>
        {selected ? (
          <MotiView
            from={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
            transition={t}
            testID={testID ? `${testID}-dot` : undefined}
            className="h-3.5 w-3.5 rounded-full bg-info"
          />
        ) : null}
      </AnimatePresence>
    </MotiView>
  );
}

type RadioCardCtx = {
  value: string;
  setValue: (value: string) => void;
  /** Group-level selection animation. A card can override it. */
  transition?: Partial<MotiTransitionProp>;
  /** The group's own testID, used to derive per-card ones. */
  testID?: string;
};

const RadioCardContext = createContext<RadioCardCtx | null>(null);

// biome-ignore lint/style/useExportsLast: props type before layout constants — collocated for readability
export type RadioCardGroupProps = {
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
   * Override the selection animation (border cross-fade + dot fade/scale) for
   * every card. Partial — only the fields you pass are changed.
   * Default: `TIMING_FAST` (150 ms timing).
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

/**
 * A single-select group of `<RadioCard>`s. Owns the selected value; each card
 * animates its own border and dot from it.
 */
export function RadioCardGroup({
  value,
  defaultValue = '',
  onValueChange,
  children,
  orientation = 'horizontal',
  className,
  style,
  testID,
  transition,
}: RadioCardGroupProps) {
  const [internal, setInternal] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  const setValue = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  return (
    <RadioCardContext.Provider value={{ value: current, setValue, transition, testID }}>
      <View accessibilityRole="radiogroup" testID={testID} className={cn(group({ orientation }), className)} style={style}>
        {children}
      </View>
    </RadioCardContext.Provider>
  );
}

export type RadioCardProps = {
  title: string;
  subtitle?: string;
  /** Short text shown in a pill in the top-right corner (e.g. a savings badge). */
  badge?: string;
  /** Custom content rendered below the title/subtitle. */
  children?: ReactNode;
  /**
   * Additional NativeWind class names merged onto the card surface — the
   * bordered, padded box that carries the selected styling.
   */
  className?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Applies tabular figures to the subtitle (useful when it's a money amount or
   * other number that should align). Matches the repo's `fontVariant` convention.
   */
  numeric?: boolean;
  /**
   * Inside a `<RadioCardGroup>`, the value this card selects. The card is
   * selected whenever it matches the group's current value.
   */
  value?: string;
  /** Standalone selected state. Ignored inside a `<RadioCardGroup>`. */
  selected?: boolean;
  /** Standalone press handler. Ignored inside a `<RadioCardGroup>`. */
  onPress?: () => void;
  /** Accessible name for the card. Defaults to `title`. */
  accessibilityLabel?: string;
  /**
   * Inside a `<RadioCardGroup>`, defaults to
   * `${group testID ?? 'radio-card-group'}-card-${value}`, so every card is
   * addressable without threading ids through the tree. Pass one to override it
   * — required to address the card standalone, where there is no value to key on.
   * The ring, its dot and the badge derive from the resolved id (`-ring`, `-dot`,
   * `-badge`).
   */
  testID?: string;
  /**
   * Override the selection animation. Partial — only the fields you pass are
   * changed. Inherits the group's value when unset. Default: `TIMING_FAST`.
   */
  transition?: Partial<MotiTransitionProp>;
};

/**
 * A selectable card with a radio indicator, title/subtitle and an optional badge.
 * Use inside a row/grid for single-select choices (e.g. billing periods, plans).
 *
 * Standalone, drive it with `selected` + `onPress`. Wrapped in a
 * `<RadioCardGroup>` and given a `value`, the group owns the selection and the
 * card reads its state from it.
 *
 * Each card animates its own selection: the border and background tint
 * cross-fade, and the dot fades and scales in place. Nothing travels between
 * cards, so no geometry is measured.
 */
export function RadioCard({
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
  accessibilityLabel,
  testID,
  transition,
}: RadioCardProps) {
  const groupCtx = useContext(RadioCardContext);
  const inGroup = groupCtx !== null && value !== undefined;
  const reduce = useReducedMotion();
  const info = useThemeColor('info');
  const borderColor = useThemeColor('border');

  const selected = inGroup ? groupCtx.value === value : Boolean(selectedProp);
  const t = mergeTransition(TIMING_FAST, transition ?? groupCtx?.transition);
  const ct = reduce ? TIMING_INSTANT : t;
  // Derive from the group so cards are addressable without threading a testID
  // through every child; an explicit prop still wins. Falls back to the
  // component name when the group has no testID, matching FileTree/FileSystem.
  // Standalone there is no value to key on, so only an explicit prop applies.
  const cardTestID = testID ?? (inGroup ? `${groupCtx.testID ?? 'radio-card-group'}-card-${value}` : undefined);

  const handlePress = useCallback(() => {
    if (groupCtx && value !== undefined) groupCtx.setValue(value);
    else onPress?.();
  }, [groupCtx, value, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="radio"
      // `aria-checked`, not `accessibilityState` — react-native-web only reads
      // the aria form, so the state was silently absent from the DOM before.
      // Matches Radio and Checkbox.
      aria-checked={selected}
      accessibilityLabel={accessibilityLabel ?? title}
      testID={cardTestID}
      className="flex-1"
    >
      {/* The animated surface. A Pressable can't be animated directly (motify is
          only applied to host primitives, and MotiPressable nests a MotiView the
          same way), so the border/tint live here and the Pressable above keeps
          the role, press handling and row layout. Both `className` and `style`
          land on this surface so consumer overrides all target one element. */}
      <MotiView
        animate={{
          borderColor: selected ? info : borderColor,
          backgroundColor: tintAt(info, selected ? TINT_ALPHA : 0),
        }}
        transition={ct}
        className={cn('flex-1 gap-3 rounded-2xl border p-4', className)}
        style={style}
      >
        <View className="flex-row items-center justify-between">
          <RadioCardRing selected={selected} transition={t} testID={cardTestID} />
          {badge ? (
            <View testID={cardTestID ? `${cardTestID}-badge` : undefined} className="rounded-full bg-primary/10 px-2 py-0.5">
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
      </MotiView>
    </Pressable>
  );
}
