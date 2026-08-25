import { cva } from 'class-variance-authority';
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { usePressState } from '../../../hooks/use-press-state';
import { cn } from '../../../lib/cn';
import type { SurfaceElevation } from '../../../lib/elevated';
import { surface } from '../../../lib/surface';
import { type MotiTransitionProp, mergeTransition, TIMING_FAST } from '../../../theme/motion';
import { Text } from '../../typography/Text/text';
import { CheckboxBox } from '../Checkbox/checkbox';

/**
 * How a card arranges its own contents. `"stacked"` puts the box on a row of
 * its own above the text; `"inline"` moves it to the trailing edge, centred
 * against the text beside it.
 *
 * Distinct from the group's `orientation`, which lays the *cards* out relative
 * to each other — the two compose freely.
 */
type CheckboxCardLayout = 'stacked' | 'inline';

type CheckboxCardCtx = {
  /** Every currently-checked card value. */
  values: string[];
  /** Add or remove a card's value from the group's selection. */
  toggle: (value: string) => void;
  /** Group-level disable. A card can override it. */
  isDisabled: boolean;
  /** Group-level check animation. A card can override it. */
  checkTransition?: Partial<MotiTransitionProp>;
  /** The group's own testID, used to derive per-card ones. */
  testID?: string;
  /** Group-level elevation. A card can override it. */
  elevation: SurfaceElevation;
  /** Group-level floating halo. A card can override it. */
  floating: boolean;
  /** Group-level card layout. A card can override it. */
  layout: CheckboxCardLayout;
};

const CheckboxCardContext = createContext<CheckboxCardCtx | null>(null);

// biome-ignore lint/style/useExportsLast: props type before layout constants — collocated for readability
export type CheckboxCardGroupProps = {
  /** Controlled selection. Omit for uncontrolled and seed with `defaultValue`. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  children: ReactNode;
  /**
   * How the *cards* are laid out relative to each other — side by side or
   * stacked. Independent of each card's own `layout`. @default 'horizontal'
   */
  orientation?: 'vertical' | 'horizontal';
  /**
   * How every card arranges its own contents. `"stacked"` (default) puts the
   * box on a row above the text; `"inline"` moves it to the trailing edge,
   * centred against the text. A card can override it with its own `layout`.
   */
  layout?: CheckboxCardLayout;
  /** Disables every card. A card can opt back in with `isDisabled={false}`. */
  isDisabled?: boolean;
  /** Additional UniWind class names merged onto the group container. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * Override the check-mark animation for every card. Partial — only the fields
   * you pass are changed. Default: `TIMING_FAST` (150 ms timing).
   */
  checkTransition?: Partial<MotiTransitionProp>;
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
 * Multi-select sibling of `<RadioCardGroup>`. Unlike the radio group there is no
 * shared gliding indicator: any number of cards can be checked at once, so each
 * one animates its own box. The group only owns the selected-value array.
 */
export function CheckboxCardGroup({
  value,
  defaultValue,
  onValueChange,
  children,
  orientation = 'horizontal',
  layout = 'stacked',
  isDisabled = false,
  className,
  style,
  testID,
  checkTransition,
  floating = false,
  elevation = 3,
}: CheckboxCardGroupProps) {
  const [internal, setInternal] = useState<string[]>(defaultValue ?? []);
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  const toggle = useCallback(
    (next: string) => {
      const resolved = current.includes(next) ? current.filter((v) => v !== next) : [...current, next];
      if (!controlled) setInternal(resolved);
      onValueChange?.(resolved);
    },
    [controlled, current, onValueChange],
  );

  return (
    <CheckboxCardContext.Provider
      value={{ values: current, toggle, isDisabled, checkTransition, testID, floating, elevation, layout }}
    >
      <View role="group" testID={testID} className={cn(group({ orientation }), className)} style={style}>
        {children}
      </View>
    </CheckboxCardContext.Provider>
  );
}

type CheckboxCardBodyProps = {
  title: string;
  subtitle?: string;
  numeric: boolean;
  /** The already-built badge, or `null` when the card has none. */
  badge: ReactNode;
  inline: boolean;
  children?: ReactNode;
};

/**
 * The card's text column — title, optional subtitle, any custom content. Inline,
 * the badge joins the title it qualifies; stacked, it rides the box's row
 * instead and only the title lands here.
 *
 * Private to this file; split out so `CheckboxCard` stays under the complexity
 * cap. `flex-1` when inline so the column claims the width the box isn't using,
 * and `shrink` on the title so a long one wraps rather than pushing the badge
 * past the card's edge.
 */
function CheckboxCardBody({ title, subtitle, numeric, badge, inline, children }: CheckboxCardBodyProps) {
  return (
    <View className={cn('gap-1', inline && 'flex-1')}>
      {inline ? (
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
      {subtitle ? (
        <Text className="text-muted-foreground text-sm" style={numeric ? { fontVariant: ['tabular-nums'] } : undefined}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export type CheckboxCardProps = {
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
   * Inside a `<CheckboxCardGroup>`, the value this card contributes to the
   * group's selected array. Ignored standalone.
   */
  value?: string;
  /** Standalone checked state. Ignored inside a `<CheckboxCardGroup>`. */
  isSelected?: boolean;
  /** Standalone change handler. Ignored inside a `<CheckboxCardGroup>`. */
  onSelectedChange?: (isSelected: boolean) => void;
  /** Dims the card and blocks presses. Inherits the group's value when unset. */
  isDisabled?: boolean;
  /**
   * How the card arranges its contents. `"stacked"` (default) puts the box on a
   * row above the text; `"inline"` moves it to the trailing edge, centred
   * against the text, and the `badge` follows the title instead of sharing the
   * box's row. Inherits the group's value when unset.
   */
  layout?: CheckboxCardLayout;
  accessibilityLabel?: string;
  /**
   * Inside a `<CheckboxCardGroup>`, defaults to
   * `${group testID ?? 'checkbox-card-group'}-card-${value}`, so every card is
   * addressable without threading ids through the tree. Pass one to override it
   * — required to address the card standalone, where there is no value to key
   * on. The box, its mark and the badge derive from the resolved id
   * (`-control`, `-check`, `-badge`).
   */
  testID?: string;
  /**
   * Override the check-mark animation. Partial — only the fields you pass are
   * changed. Inherits the group's value when unset. Default: `TIMING_FAST`.
   */
  checkTransition?: Partial<MotiTransitionProp>;
  /** Replace the check-mark icon. Default: `<Svg width={12} height={12}><Path d={CHECK_PATH} .../></Svg>`. */
  checkIcon?: ReactNode;
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
 * A selectable card with a checkbox indicator, title/subtitle and an optional
 * badge. The multi-select counterpart to `RadioCard` — use it for choices that
 * are not mutually exclusive (e.g. add-ons, notification channels).
 *
 * Standalone, drive it with `isSelected` + `onSelectedChange`. Wrapped in a
 * `<CheckboxCardGroup>` and given a `value`, the group owns the selected array
 * and the card reads its state from it.
 *
 * Unlike `RadioCard` there is no shared gliding indicator: several cards can be
 * checked at once, so each one animates its own box.
 */
export function CheckboxCard({
  value,
  isSelected: selectedProp,
  onSelectedChange,
  isDisabled,
  layout,
  title,
  subtitle,
  badge,
  children,
  className,
  style,
  numeric = false,
  accessibilityLabel,
  testID,
  checkTransition,
  checkIcon,
  floating,
  elevation,
}: CheckboxCardProps) {
  const groupCtx = useContext(CheckboxCardContext);
  if (value !== undefined && groupCtx === null)
    throw new Error('CheckboxCardItem with a `value` prop must be used inside <CheckboxCard>');
  const inGroup = groupCtx !== null && value !== undefined;
  const { pressed, pressHandlers } = usePressState();

  const checked = inGroup ? groupCtx.values.includes(value) : Boolean(selectedProp);
  const disabled = isDisabled ?? groupCtx?.isDisabled ?? false;
  const resolvedFloating = floating ?? groupCtx?.floating ?? false;
  const resolvedElevation = elevation ?? groupCtx?.elevation ?? 3;
  const inline = (layout ?? groupCtx?.layout ?? 'stacked') === 'inline';
  const ct = mergeTransition(TIMING_FAST, checkTransition ?? groupCtx?.checkTransition);
  // Derive from the group so cards are addressable without threading a testID
  // through every child; an explicit prop still wins. Falls back to the
  // component name when the group has no testID, matching RadioCard.
  // Standalone there is no value to key on, so only an explicit prop applies.
  const cardTestID = testID ?? (inGroup ? `${groupCtx.testID ?? 'checkbox-card-group'}-card-${value}` : undefined);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (groupCtx && value !== undefined) groupCtx.toggle(value);
    else onSelectedChange?.(!checked);
  }, [disabled, groupCtx, value, onSelectedChange, checked]);

  // The box and the badge move between rows with the layout, so both are built
  // once here and placed by the tree below rather than spelled twice.
  const box = (
    <CheckboxBox
      checked={checked}
      disabled={disabled}
      pressed={pressed}
      tone="info"
      transition={ct}
      checkIcon={checkIcon}
      testID={cardTestID}
    />
  );

  const badgeNode = badge ? (
    <View testID={cardTestID ? `${cardTestID}-badge` : undefined} className="rounded-full bg-primary/10 px-2 py-0.5">
      <Text weight="semibold" className="text-primary text-xs">
        {badge}
      </Text>
    </View>
  ) : null;

  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? title}
      testID={cardTestID}
      disabled={disabled}
      {...pressHandlers}
      onPress={handlePress}
      className="flex-1"
    >
      {/* The elevated surface wrapper carries the surface background and drop
          shadow. The shadow must render outside the Pressable's clip region, so
          it lives on a dedicated View rather than on the surface below. Both
          `className` and `style` land here so consumer overrides all target one
          element. */}
      <View className={cn('rounded-2xl', surface(resolvedElevation, undefined, resolvedFloating), className)} style={style}>
        {/* The visual surface carries the border + selection tint. When unchecked
            both are transparent — no resting outline, and the wrapper's surface
            background shows through; when checked the `border-info` edge and the
            `bg-info/5` tint overlay it. The `border` width is reserved in both
            states so checking a card doesn't shift its content. */}
        <View
          className={cn(
            'flex-1 gap-3 rounded-2xl border-[1.5px] p-4',
            inline && 'flex-row items-center',
            disabled ? 'opacity-60' : 'opacity-100',
            checked ? 'border-info bg-info/5' : 'border-transparent',
          )}
        >
          {/* Stacked, the box leads a row of its own and the badge rides its far
              end. Inline that row has no reason to exist — the box moves to the
              trailing edge below and the badge to the title. */}
          {inline ? null : (
            <View className="flex-row items-center justify-between">
              {box}
              {badgeNode}
            </View>
          )}
          <CheckboxCardBody title={title} subtitle={subtitle} numeric={numeric} badge={badgeNode} inline={inline}>
            {children}
          </CheckboxCardBody>
          {inline ? box : null}
        </View>
      </View>
    </Pressable>
  );
}
