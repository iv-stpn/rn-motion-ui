import { cva } from 'class-variance-authority';
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { cssColorToOklch, oklchToSrgb } from '../../../lib/color';
import type { SurfaceElevation } from '../../../lib/elevated';
import { surface } from '../../../lib/surface';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { type MotiTransitionProp, mergeTransition, TIMING_FAST, TIMING_INSTANT } from '../../../theme/motion';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Text } from '../../typography/Text/text';

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
  /** Resolved selection accent color — the token already mapped through `TONE_TOKEN`. */
  accent: string;
  /** Resolved selection animation, already merged with the group/card overrides. */
  transition: MotiTransitionProp;
  /** The card's resolved testID; the ring and dot derive from it. */
  testID?: string;
};

/**
 * The radio ring and its dot. Kept private to this file because only `RadioCard`
 * renders it, and split out of the card body so the card stays readable.
 *
 * The ring's border cross-fades between `border` and the card's accent as a real
 * color interpolation; the dot fades and scales in place. Nothing is measured —
 * each card owns its own dot, so there is no cross-card geometry to resolve.
 */
function RadioCardRing({ selected, accent, transition, testID }: RadioCardRingProps) {
  const reduce = useReducedMotion();
  // Resolve the unselected end of the border cross-fade through the token bridge
  // so it follows consumer @theme overrides; the selected end is the accent the
  // caller resolved, so the ring and the card tint can never drift apart.
  const border = useThemeColor('border');
  const t = reduce ? TIMING_INSTANT : transition;

  return (
    <MotiView
      animate={{ borderColor: selected ? accent : border }}
      transition={t}
      testID={testID ? `${testID}-ring` : undefined}
      // `shrink-0` matters inline, where the ring shares a row with the text
      // column and would otherwise be squeezed by a long title. Matches Radio
      // and Checkbox, whose own controls are already shrink-proof.
      className="h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px]"
    >
      <AnimatePresence>
        {selected ? (
          <MotiView
            from={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
            transition={t}
            testID={testID ? `${testID}-dot` : undefined}
            // Same 12 px dot as Radio — the ring is already the same 20 px circle,
            // so this keeps the two controls pixel-identical.
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: accent }}
          />
        ) : null}
      </AnimatePresence>
    </MotiView>
  );
}

/** Visual variant: `"radio"` shows the ring + dot; `"card"` uses only the border
 *  and background tint to indicate selection. */
type RadioCardVariant = 'radio' | 'card';

/** Selection accent. `"neutral"` (default) is the primary token — the same
 *  near-black/near-white fill a default `Radio` uses — and `"info"` is the blue
 *  status token. */
type RadioCardTone = 'neutral' | 'info';

/** Token resolved for a tone; `neutral` maps to the monochrome `primary` token. */
const TONE_TOKEN: Record<RadioCardTone, 'primary' | 'info'> = { neutral: 'primary', info: 'info' };

/** Selected background wash alpha per tone. `neutral` carries twice the wash of
 *  `info` because `primary` is achromatic and reads fainter at the same alpha. */
const TONE_TINT_ALPHA: Record<RadioCardTone, number> = { neutral: 0.1, info: 0.05 };

/**
 * Wash alpha for the selected background: zero on a light surface (the selection
 * reads through the border + dot alone, and a grey wash would muddy the white),
 * the per-tone alpha on a dark surface where a light tint lifts the selected
 * card off its neighbours. Keyed off the resolved surface rather than
 * `useColorScheme` so it follows the manual `.dark`/`.light` toggles that
 * `useThemeColor` already subscribes to.
 */
function tintAlphaFor(tone: RadioCardTone, surfaceColor: string): number {
  const isDark = (cssColorToOklch(surfaceColor)?.lightness ?? 1) < 0.5;
  return isDark ? TONE_TINT_ALPHA[tone] : 0;
}

/** Border-width class for the card surface: the resting 1.5px hairline steps up
 *  to 2px when selected so the highlight reads stronger than the resting edge. */
function cardBorderWidth(selected: boolean) {
  return selected ? 'border-2' : 'border-[1.5px]';
}

/**
 * How a card arranges its own contents. `"stacked"` puts the ring on a row of
 * its own above the text; `"inline"` moves it to the trailing edge, top-aligned
 * against the text beside it.
 *
 * Distinct from the group's `orientation`, which lays the *cards* out relative
 * to each other — the two compose freely. Under `variant="card"` there is no
 * ring to place, so the layout only decides where the badge sits.
 */
type RadioCardLayout = 'stacked' | 'inline';

type RadioCardCtx = {
  value: string;
  setValue: (value: string) => void;
  /** Group-level selection animation. A card can override it. */
  transition?: Partial<MotiTransitionProp>;
  /** The group's own testID, used to derive per-card ones. */
  testID?: string;
  /** Group-level variant. A card can override it. */
  variant?: RadioCardVariant;
  /** Group-level selection accent. A card can override it. */
  tone?: RadioCardTone;
  /** Group-level elevation. A card can override it. */
  elevation: SurfaceElevation;
  /** Group-level floating halo. A card can override it. */
  floating: boolean;
  /** Group-level card layout. A card can override it. */
  layout: RadioCardLayout;
  /** Group-level orientation — whether the cards sit side by side or stacked. */
  orientation: 'vertical' | 'horizontal';
};

const RadioCardContext = createContext<RadioCardCtx | null>(null);

// biome-ignore lint/style/useExportsLast: props type before layout constants — collocated for readability
export type RadioCardGroupProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  /**
   * How the *cards* are laid out relative to each other — side by side or
   * stacked. Independent of each card's own `layout`. @default 'horizontal'
   */
  orientation?: 'vertical' | 'horizontal';
  /**
   * How every card arranges its own contents. `"stacked"` (default) puts the
   * ring on a row above the text; `"inline"` moves it to the trailing edge,
   * top-aligned against the text. A card can override it with its own `layout`.
   */
  layout?: RadioCardLayout;
  /** Additional UniWind class names merged onto the group container. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * Override the selection animation (border cross-fade + dot fade/scale) for
   * every card. Partial — only the fields you pass are changed.
   * Default: `TIMING_FAST` (150 ms timing).
   */
  transition?: Partial<MotiTransitionProp>;
  /**
   * Visual variant for every card in the group. `"radio"` (default) shows the
   * ring + dot indicator; `"card"` uses only the animated border and background
   * tint. A card can override it with its own `variant`.
   */
  variant?: RadioCardVariant;
  /**
   * Selection accent for every card in the group. `"neutral"` (default) fills
   * the dot and tints the border with the primary token; `"info"` uses the blue
   * status token. A card can override it with its own `tone`.
   */
  tone?: RadioCardTone;
  /**
   * Swap the card's ladder shadow for the input field's large, diffuse halo
   * (`shadow-floating`). It replaces the `shadow-elevated-N` rung rather than
   * adding to it, so the card keeps its `elevation` tint but trades the
   * layered drop for the halo. A card can override it with its own `floating`.
   * @default false
   */
  floating?: boolean;
  /**
   * Surface elevation for every card in the group (0–8). Controls the
   * background tint (`bg-surface-N`) and the drop shadow (`shadow-elevated-N`).
   * `0` is the flat resting surface — a `surface-3` fill with no shadow or
   * border. Default: `3` (the standard card level). A card can override it with
   * its own `elevation`.
   */
  elevation?: SurfaceElevation;
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
  layout = 'stacked',
  className,
  style,
  testID,
  transition,
  variant,
  tone,
  floating = false,
  elevation = 3,
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
    <RadioCardContext.Provider
      value={{ value: current, setValue, transition, testID, variant, tone, floating, elevation, layout, orientation }}
    >
      <View accessibilityRole="radiogroup" testID={testID} className={cn(group({ orientation }), className)} style={style}>
        {children}
      </View>
    </RadioCardContext.Provider>
  );
}

type RadioCardBodyProps = {
  title: string;
  subtitle?: string;
  numeric: boolean;
  /** The already-built badge, or `null` when the card has none. */
  badge: ReactNode;
  inline: boolean;
  /** Whether the group lays its cards side by side — the badge drops below the
   *  title when this is true, beside it when false. */
  horizontal: boolean;
  /** No indicator (`variant="card"`): keep the badge in the body rather than on
   *  a leading indicator row. */
  card: boolean;
  children?: ReactNode;
};

/**
 * The card's text column — title, optional subtitle, any custom content. Inline,
 * the badge sits beside the title in a vertical group but drops below it in a
 * horizontal one, where the narrow card has no room beside; stacked, it rides
 * the ring's row instead and only the title lands here. Under `variant="card"`
 * there is no ring, so the badge stays in the body the same way.
 *
 * Private to this file; split out so `RadioCard` stays under the complexity cap.
 * `flex-1` when inline so the column claims the width the ring isn't using.
 */
function RadioCardBody({ title, subtitle, numeric, badge, inline, horizontal, card, children }: RadioCardBodyProps) {
  const badgeInBody = inline || card;
  return (
    <View className={cn('gap-1', inline && 'flex-1')}>
      {badgeInBody && !horizontal ? (
        <View className="flex-row items-center gap-2">
          <Text weight="semibold" className="shrink text-base text-foreground">
            {title}
          </Text>
          {badge}
        </View>
      ) : (
        <Text weight="semibold" className="text-base text-foreground">
          {title}
        </Text>
      )}
      {badgeInBody && horizontal && badge ? <View className="self-start">{badge}</View> : null}
      {subtitle ? (
        <Text className="text-muted-foreground text-sm" style={numeric ? { fontVariant: ['tabular-nums'] } : undefined}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
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
   * Additional UniWind class names merged onto the card surface — the padded
   * box that carries the selected styling. Pass a `border-*` color here to give
   * the card a resting outline; by default it has none until selected.
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
  /**
   * Visual variant. `"radio"` (default) shows the ring + dot indicator;
   * `"card"` uses only the animated border and background tint. Inherits the
   * group's value when unset.
   */
  variant?: RadioCardVariant;
  /**
   * Selection accent. `"neutral"` (default) fills the dot and tints the border
   * with the primary token (the same fill a default `Radio` uses); `"info"` uses
   * the blue status token. Inherits the group's value when unset.
   */
  tone?: RadioCardTone;
  /**
   * How the card arranges its contents. `"stacked"` (default) puts the ring on
   * a row above the text; `"inline"` moves it to the trailing edge, top-aligned
   * against the text, and the `badge` joins the title — beside it in a vertical
   * group, below it in a horizontal one. Inherits the group's value when unset.
   */
  layout?: RadioCardLayout;
  /**
   * Swap the card's ladder shadow for the input field's large, diffuse halo
   * (`shadow-floating`). It replaces the `shadow-elevated-N` rung rather than
   * adding to it, so the card keeps its `elevation` tint but trades the
   * layered drop for the halo. Inherits the group's value when unset.
   * @default false
   */
  floating?: boolean;
  /**
   * Surface elevation (0–8). Controls the background tint (`bg-surface-N`) and
   * the drop shadow (`shadow-elevated-N`). `0` is the flat resting surface (a
   * `surface-3` fill, no shadow or border). Inherits the group's value when
   * unset. Default: `3` (the standard card level).
   */
  elevation?: SurfaceElevation;
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
 * cross-fade in from nothing — a resting card has no outline of its own and
 * reads as a plain surface — and the dot fades and scales in place. Nothing
 * travels between cards, so no geometry is measured.
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
  variant,
  tone,
  layout,
  floating,
  elevation,
}: RadioCardProps) {
  const groupCtx = useContext(RadioCardContext);
  if (value !== undefined && groupCtx === null)
    throw new Error('RadioCardItem with a `value` prop must be used inside <RadioCard>');
  const inGroup = groupCtx !== null && value !== undefined;
  const reduce = useReducedMotion();

  const selected = inGroup ? groupCtx.value === value : Boolean(selectedProp);
  const resolvedVariant = variant ?? groupCtx?.variant ?? 'radio';
  const card = resolvedVariant === 'card';
  const resolvedTone = tone ?? groupCtx?.tone ?? 'neutral';
  const accent = useThemeColor(TONE_TOKEN[resolvedTone]);
  const tintAlpha = tintAlphaFor(resolvedTone, useThemeColor('surface-3'));
  const resolvedFloating = floating ?? groupCtx?.floating ?? false;
  const resolvedElevation = elevation ?? groupCtx?.elevation ?? 3;
  const inline = (layout ?? groupCtx?.layout ?? 'stacked') === 'inline';
  // Inline + horizontal = narrow cards side by side, where the badge has no room
  // beside the title; it drops below instead. Standalone there is no group to
  // read orientation from, so `horizontal` is false and the badge stays beside.
  const horizontal = groupCtx?.orientation === 'horizontal';
  const t = mergeTransition(TIMING_FAST, transition ?? groupCtx?.transition);
  const ct = reduce ? TIMING_INSTANT : t;
  // Derive from the group so cards are addressable without threading a testID
  // through every child; an explicit prop still wins. Falls back to the
  // component name when the group has no testID.

  // Standalone there is no value to key on, so only an explicit prop applies.
  const cardTestID = testID ?? (inGroup ? `${groupCtx.testID ?? 'radio-card-group'}-card-${value}` : undefined);

  const handlePress = useCallback(() => {
    if (groupCtx && value !== undefined) groupCtx.setValue(value);
    else onPress?.();
  }, [groupCtx, value, onPress]);

  // The ring and the badge move between rows with the layout, so both are built
  // once here and placed by the tree below rather than spelled twice. Under
  // `variant="card"` there is no ring at all — the border and tint carry the
  // selection on their own.
  const ring =
    resolvedVariant === 'radio' ? <RadioCardRing accent={accent} selected={selected} transition={t} testID={cardTestID} /> : null;

  const badgeNode = badge ? (
    <View testID={cardTestID ? `${cardTestID}-badge` : undefined} className="rounded-full bg-primary/10 px-2 py-0.5">
      <Text weight="semibold" className="text-primary text-xs">
        {badge}
      </Text>
    </View>
  ) : null;

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
      {/* The elevated surface wrapper carries the surface background and drop
          shadow. The shadow must render outside the Pressable's clip region, so
          it lives on a dedicated View rather than on the animated surface below.
          Both `className` and `style` land here so consumer overrides all target
          one element. */}
      <View className={cn('rounded-2xl', surface(resolvedElevation, undefined, resolvedFloating), className)} style={style}>
        {/* The animated surface. A Pressable can't be animated directly (motify
            is only applied to host primitives, and MotiPressable nests a MotiView
            the same way), so the border/tint live here and the Pressable above
            keeps the role and press handling.

            The border is purely the selection affordance: unselected it is the
            accent at alpha 0, so the resting card shows no outline and leans on
            the wrapper's surface fill instead. Both ends run through `tintAt`
            for the reason spelled out on that helper — a literal `transparent`
            end would interpolate through transparent black and darken the edge on
            the way in. Selecting steps the border from the 1.5px hairline to 2px so
            the highlight reads stronger than the resting edge; the half-pixel
            content shift is negligible. */}
        <MotiView
          animate={{
            borderColor: tintAt(accent, selected ? 1 : 0),
            backgroundColor: tintAt(accent, selected ? tintAlpha : 0),
          }}
          transition={ct}
          className={cn('flex-1 gap-3 rounded-2xl p-4', cardBorderWidth(selected), inline && 'flex-row items-start')}
        >
          {/* Stacked, the ring leads a row of its own and the badge rides its
              far end. Inline and `variant="card"` have no reason for that row —
              the ring moves to the trailing edge (inline) or disappears (card),
              and the badge joins the title in the body. */}
          {inline || card ? null : (
            <View className="flex-row items-center justify-between">
              {ring}
              {badgeNode}
            </View>
          )}
          <RadioCardBody
            title={title}
            subtitle={subtitle}
            numeric={numeric}
            badge={badgeNode}
            inline={inline}
            horizontal={horizontal}
            card={card}
          >
            {children}
          </RadioCardBody>
          {inline ? ring : null}
        </MotiView>
      </View>
    </Pressable>
  );
}
