/**
 * Shared in-canvas playground chrome for the component stories.
 *
 * Every component exposes a single `Interactive` story that doubles as its
 * catalogue: live controls on top (`Controls` + `Toggle` / `Choice`), then rows
 * of `Sample`s exhibiting the states that can't be reached by pressing. This
 * replaces the long tails of one-arg stories (`Loading`, `Disabled`, `Pill`, …)
 * that used to sit next to each other in the sidebar.
 *
 * The chrome is deliberately built from bare `Pressable`/`View` rather than the
 * library's own `Switch`/`Radio`: a story for `Switch` must not have the harness
 * and the subject answer the same `findByRole('switch')` query. Harness controls
 * are plain buttons with `aria-pressed`, and every one carries a `story-*`
 * testID so a `play` function can drive them unambiguously.
 *
 * This directory is excluded from the published package (see package.json
 * `files`), and the filename is not `*.stories.tsx`, so Storybook's glob never
 * picks it up as a story of its own.
 */

import { type ReactNode, useCallback } from 'react';
import { type FlexAlignType, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { Text } from '../components/Text/text';
import { useReducedMotion } from '../hooks/use-reduced-motion';
import { cn } from '../lib/cn';
import { THUMB_SPRING } from '../lib/ease';
import { SURFACE_CLASSNAME } from '../lib/elevated';
import { MotiView } from '../moti/components/view';

const alignClassname: Record<FlexAlignType, string> = {
  'flex-start': 'items-start',
  center: 'items-center',
  'flex-end': 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

type PlaygroundProps = { children: ReactNode; className?: string; style?: StyleProp<ViewStyle> };
type ControlsProps = { children: ReactNode };
type ControlRowProps = { children: ReactNode };
type ToggleProps = { label: string; value: boolean; onChange: (next: boolean) => void };
type ActionProps = { label: string; onPress: () => void };
type ChoiceOption<T extends string> = { value: T; label: string };
type ChipProps<T extends string> = { option: ChoiceOption<T>; selected: boolean; testID: string; onSelect: (next: T) => void };
type SectionProps = { title?: string; children: ReactNode };
type ControlCardProps = { title: string; children: ReactNode };
type VariantsProps = { children: ReactNode; direction?: 'row' | 'column'; align?: ViewStyle['alignItems'] };
type SampleProps = {
  label?: string;
  children: ReactNode;
  className?: string;
  align?: ViewStyle['alignItems'];
  style?: StyleProp<ViewStyle>;
};
type NoteProps = { children: ReactNode; testID?: string };

type ChoiceProps<T extends string> = {
  /** Caption above the chips; also namespaces the chip testIDs. */
  label?: string;
  value: T;
  /** Bare values (used as their own labels) or `{ value, label }` pairs. */
  options: readonly T[] | readonly ChoiceOption<T>[];
  onChange: (next: T) => void;
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Its own component so `onPress` can be a stable per-chip callback.
function ChoiceChip<T extends string>({ option, selected, testID, onSelect }: ChipProps<T>) {
  const handlePress = useCallback(() => onSelect(option.value), [onSelect, option.value]);
  return (
    <Pressable
      accessibilityLabel={option.label}
      accessibilityRole="button"
      aria-pressed={selected}
      onPress={handlePress}
      className={cn('px-2.5 py-[5px]', selected ? 'bg-primary' : 'bg-transparent')}
      testID={testID}
    >
      <Text size="sm" className={cn('text-sm', selected ? 'text-primary-foreground' : 'text-muted-foreground')}>
        {option.label}
      </Text>
    </Pressable>
  );
}

/** Vertical frame for a playground story: controls, then sample rows. */
export function Playground({ children, className, style }: PlaygroundProps) {
  return (
    <View className={cn('min-w-[280px] gap-5', className)} style={style}>
      {children}
    </View>
  );
}

/** Bordered card holding the live controls at the top of a playground. */
export function Controls({ children }: ControlsProps) {
  return (
    <View className={cn('flex-col gap-3 rounded-xl p-3', SURFACE_CLASSNAME[2])} testID="story-controls">
      {children}
    </View>
  );
}

/** Horizontal group within a Controls block — wraps controls of the same kind on one line. */
export function ControlRow({ children }: ControlRowProps) {
  return <View className="flex-row flex-wrap items-center gap-4">{children}</View>;
}

/** Boolean control — a compact switch that never answers `role="switch"`. */
export function Toggle({ label, value, onChange }: ToggleProps) {
  const reduce = useReducedMotion();
  const handlePress = useCallback(() => onChange(!value), [onChange, value]);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      aria-pressed={value}
      onPress={handlePress}
      className="flex-row items-center gap-2"
      testID={`story-toggle-${slug(label)}`}
    >
      {/* Dimensions mirror the heroui Switch: 48×24 track, 28×20 pill thumb, 2px inset, 16px travel. */}
      <View className={cn('relative h-6 w-12 overflow-hidden rounded-full', value ? 'bg-primary' : 'bg-muted-foreground/60')}>
        <MotiView
          animate={{ translateX: value ? 16 : 0 }}
          transition={
            reduce
              ? { type: 'timing', duration: 0 }
              : { type: 'spring', stiffness: THUMB_SPRING.stiffness, damping: THUMB_SPRING.damping, mass: THUMB_SPRING.mass }
          }
          className={cn('absolute top-0.5 left-0.5 h-5 w-7 rounded-full', SURFACE_CLASSNAME[3])}
        />
      </View>
      <Text className="text-foreground" size="sm">
        {label}
      </Text>
    </Pressable>
  );
}

/** One-shot control — replay an animation, reset a counter, fire a callback. */
export function Action({ label, onPress }: ActionProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      className={cn('rounded-[10px] px-3 py-1.5', SURFACE_CLASSNAME[4])}
      testID={`story-action-${slug(label)}`}
    >
      <Text className="text-foreground" size="sm" weight="medium">
        {label}
      </Text>
    </Pressable>
  );
}

/** Enum control — a segmented row of chips, one selected at a time. */
export function Choice<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  const items: ChoiceOption<T>[] = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );
  return (
    <View className="items-start gap-1.5">
      {label ? (
        <Text className="text-muted-foreground" size="xs">
          {label}
        </Text>
      ) : null}
      <View className={cn('flex-row flex-wrap overflow-hidden rounded-md', SURFACE_CLASSNAME[4])}>
        {items.map((item) => (
          <ChoiceChip
            key={item.value}
            onSelect={onChange}
            option={item}
            selected={item.value === value}
            testID={`story-choice-${label ? `${slug(label)}-` : ''}${slug(item.value)}`}
          />
        ))}
      </View>
    </View>
  );
}

/** Titled block grouping related samples under the controls. */
export function Section({ title, children }: SectionProps) {
  return (
    <View className="gap-2.5">
      {title ? (
        <Text className="text-muted-foreground" size="xs" weight="semibold">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/**
 * Labelled surface card for a named group of playground controls.
 * Use in place of the generic `Controls` block when controls need to be
 * separated into named regions (e.g. "Options", "Elevation", "Jump to").
 *
 * @example
 *   <ControlCard title="Options">
 *     <Toggle label="Compact" ... />
 *     <Choice label="Mode" ... />
 *   </ControlCard>
 */
export function ControlCard({ title, children }: ControlCardProps) {
  return (
    <View className={cn('gap-3.5 rounded-xl p-3', SURFACE_CLASSNAME[3])}>
      <Text className="text-muted-foreground" size="xs" weight="semibold">
        {title}
      </Text>
      <View className="flex-row flex-wrap items-center gap-4">{children}</View>
    </View>
  );
}

/** Row (default) or column of samples, wrapping when it runs out of width. */
export function Variants({ children, direction = 'row', align = 'flex-start' }: VariantsProps) {
  return (
    <View className={cn(direction === 'row' ? 'flex-row flex-wrap' : 'flex-col', alignClassname[align], 'gap-3')}>
      {children}
    </View>
  );
}

/** One specimen with a caption underneath. */
export function Sample({ label, children, className, align = 'flex-start', style }: SampleProps) {
  return (
    <View className={cn('gap-1.5', className)} style={[{ alignItems: align }, style]}>
      {children}
      {label ? (
        <Text className="text-muted-foreground" size="xs">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/** Muted one-liner for live readouts ("Pressed 3 times") and hints. */
export function Note({ children, testID }: NoteProps) {
  return (
    <Text className="text-muted-foreground" size="sm" testID={testID}>
      {children}
    </Text>
  );
}
