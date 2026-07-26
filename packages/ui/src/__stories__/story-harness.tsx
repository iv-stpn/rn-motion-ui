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
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { Text } from '../components/Text/text';
import { useThemeColors } from '../theme/use-theme-color';

type PlaygroundProps = { children: ReactNode; style?: StyleProp<ViewStyle> };
type ControlsProps = { children: ReactNode };
type ToggleProps = { label: string; value: boolean; onChange: (next: boolean) => void };
type ActionProps = { label: string; onPress: () => void };
type ChoiceOption<T extends string> = { value: T; label: string };
type ChipProps<T extends string> = { option: ChoiceOption<T>; selected: boolean; testID: string; onSelect: (next: T) => void };
type SectionProps = { title?: string; children: ReactNode };
type VariantsProps = { children: ReactNode; direction?: 'row' | 'column'; gap?: number; align?: ViewStyle['alignItems'] };
type SampleProps = { label?: string; children: ReactNode; align?: ViewStyle['alignItems']; style?: StyleProp<ViewStyle> };
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
  const colors = useThemeColors();
  const handlePress = useCallback(() => onSelect(option.value), [onSelect, option.value]);
  return (
    <Pressable
      accessibilityLabel={option.label}
      accessibilityRole="button"
      aria-pressed={selected}
      onPress={handlePress}
      style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: selected ? colors.primary : 'transparent' }}
      testID={testID}
    >
      <Text size="sm" style={{ color: selected ? colors['primary-foreground'] : colors['muted-foreground'] }}>
        {option.label}
      </Text>
    </Pressable>
  );
}

/** Vertical frame for a playground story: controls, then sample rows. */
export function Playground({ children, style }: PlaygroundProps) {
  return <View style={[{ gap: 20, minWidth: 280 }, style]}>{children}</View>;
}

/** Bordered card holding the live controls at the top of a playground. */
export function Controls({ children }: ControlsProps) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 16,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors['surface-2'],
      }}
      testID="story-controls"
    >
      {children}
    </View>
  );
}

/** Boolean control — a compact switch that never answers `role="switch"`. */
export function Toggle({ label, value, onChange }: ToggleProps) {
  const colors = useThemeColors();
  const handlePress = useCallback(() => onChange(!value), [onChange, value]);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      aria-pressed={value}
      onPress={handlePress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
      testID={`story-toggle-${slug(label)}`}
    >
      <View
        style={{
          width: 34,
          height: 20,
          borderRadius: 10,
          padding: 2,
          justifyContent: 'center',
          backgroundColor: value ? colors.primary : colors['muted-foreground'],
        }}
      >
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors['surface-3'],
            transform: [{ translateX: value ? 14 : 0 }],
          }}
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
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors['surface-4'],
      }}
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
  const colors = useThemeColors();
  const items: ChoiceOption<T>[] = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text className="text-muted-foreground" size="xs" weight="medium">
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors['surface-3'],
          overflow: 'hidden',
        }}
      >
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
    <View style={{ gap: 10 }}>
      {title ? (
        <Text className="text-muted-foreground" size="xs" weight="semibold">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Row (default) or column of samples, wrapping when it runs out of width. */
export function Variants({ children, direction = 'row', gap = 12, align = 'flex-start' }: VariantsProps) {
  return (
    <View style={{ flexDirection: direction, flexWrap: direction === 'row' ? 'wrap' : 'nowrap', gap, alignItems: align }}>
      {children}
    </View>
  );
}

/** One specimen with a caption underneath. */
export function Sample({ label, children, align = 'flex-start', style }: SampleProps) {
  return (
    <View style={[{ gap: 6, alignItems: align }, style]}>
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
