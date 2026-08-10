import { cva } from 'class-variance-authority';
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { usePressState } from '../../../hooks/use-press-state';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { SPRING_PRESS } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { type MotiTransitionProp, mergeTransition, TIMING_FAST, TIMING_INSTANT } from '../../../theme/motion';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Text } from '../../typography/Text/text';

const CHECK_PATH = 'M5 13l4 4L19 7';

type CheckboxCardBoxProps = {
  checked: boolean;
  disabled: boolean;
  pressed: boolean;
  /** Resolved check animation, already merged with the group/card overrides. */
  transition: MotiTransitionProp;
  checkIcon?: ReactNode;
  /** The card's resolved testID; the box and mark derive from it. */
  testID?: string;
};

/**
 * The animated checkbox box. Same visual and timing as `Checkbox` — kept private
 * to this file because only `CheckboxCard` renders it, and split out of the card
 * body so the card stays readable.
 */
function CheckboxCardBox({ checked, disabled, pressed, transition, checkIcon, testID }: CheckboxCardBoxProps) {
  const reduce = useReducedMotion();
  // Resolve the check-mark colour through the token bridge so it adapts to
  // consumer @theme overrides. Paired with the `info` fill below, not `primary`.
  const checkColor = useThemeColor('info-foreground');
  const ct = reduce ? TIMING_INSTANT : transition;

  return (
    // Springs down while pressed (Button's idiom, shared with Checkbox).
    <MotiView
      animate={{ scale: pressed && !reduce && !disabled ? 0.92 : 1 }}
      transition={SPRING_PRESS}
      testID={testID ? `${testID}-control` : undefined}
    >
      {/* Base box is always in the unchecked state; the `info` fill animates in/out. */}
      <View
        className={cn(
          'h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 bg-surface-3',
          checked ? 'border-info' : 'border-muted-foreground/50',
        )}
      >
        {/* Fill fades in on check and out on uncheck, same timing as the mark. */}
        <MotiView animate={{ opacity: checked ? 1 : 0 }} transition={ct} className="absolute inset-0 bg-info" />
        <AnimatePresence>
          {checked ? (
            <MotiView
              from={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
              transition={ct}
              testID={testID ? `${testID}-check` : undefined}
            >
              {checkIcon ?? (
                <Svg width={12} height={12} viewBox="0 0 24 24">
                  <Path
                    d={CHECK_PATH}
                    fill="none"
                    stroke={checkColor}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              )}
            </MotiView>
          ) : null}
        </AnimatePresence>
      </View>
    </MotiView>
  );
}

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
    <CheckboxCardContext.Provider value={{ values: current, toggle, isDisabled, checkTransition, testID }}>
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
}: CheckboxCardProps) {
  const groupCtx = useContext(CheckboxCardContext);
  if (value !== undefined && groupCtx === null)
    throw new Error('CheckboxCardItem with a `value` prop must be used inside <CheckboxCard>');
  const inGroup = groupCtx !== null && value !== undefined;
  const { pressed, pressHandlers } = usePressState();

  const checked = inGroup ? groupCtx.values.includes(value) : Boolean(selectedProp);
  const disabled = isDisabled ?? groupCtx?.isDisabled ?? false;
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
      style={style}
      className={cn(
        'flex-1 gap-3 rounded-2xl border p-4',
        disabled ? 'opacity-60' : 'opacity-100',
        checked ? 'border-info bg-info/5' : 'border-border bg-transparent',
        className,
      )}
    >
      <View className="flex-row items-center justify-between">
        <CheckboxCardBox
          checked={checked}
          disabled={disabled}
          pressed={pressed}
          transition={ct}
          checkIcon={checkIcon}
          testID={cardTestID}
        />
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
    </Pressable>
  );
}
