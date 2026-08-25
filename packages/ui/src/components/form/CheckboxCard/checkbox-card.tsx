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
};

const CheckboxCardContext = createContext<CheckboxCardCtx | null>(null);

// biome-ignore lint/style/useExportsLast: props type before layout constants — collocated for readability
export type CheckboxCardGroupProps = {
  /** Controlled selection. Omit for uncontrolled and seed with `defaultValue`. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  children: ReactNode;
  orientation?: 'vertical' | 'horizontal';
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
    <CheckboxCardContext.Provider value={{ values: current, toggle, isDisabled, checkTransition, testID, floating, elevation }}>
      <View role="group" testID={testID} className={cn(group({ orientation }), className)} style={style}>
        {children}
      </View>
    </CheckboxCardContext.Provider>
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
            it's transparent so the wrapper's surface background shows through;
            when checked the `bg-info/5` tint overlays it. */}
        <View
          className={cn(
            'flex-1 gap-3 rounded-2xl border p-4',
            disabled ? 'opacity-60' : 'opacity-100',
            checked ? 'border-info bg-info/5' : 'border-border',
          )}
        >
          <View className="flex-row items-center justify-between">
            <CheckboxBox
              checked={checked}
              disabled={disabled}
              pressed={pressed}
              tone="info"
              transition={ct}
              checkIcon={checkIcon}
              testID={cardTestID}
            />
            {badge ? (
              <View testID={cardTestID ? `${cardTestID}-badge` : undefined} className="rounded-full bg-primary/10 px-2 py-0.5">
                <Text weight="semibold" className="text-primary text-xs">
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
          <View className="gap-1">
            <Text weight="semibold" className="text-base text-foreground">
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-muted-foreground text-sm" style={numeric ? { fontVariant: ['tabular-nums'] } : undefined}>
                {subtitle}
              </Text>
            ) : null}
            {children}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
