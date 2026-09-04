/**
 * Shared in-canvas playground chrome for the component stories.
 *
 * Every component exposes a single `Interactive` story that doubles as its
 * catalogue: live controls on top (`Controls` + `Toggle` / `Choice`), then rows
 * of `Sample`s exhibiting the states that can't be reached by pressing. This
 * replaces the long tails of one-arg stories (`Loading`, `Disabled`, `Pill`, …)
 * that used to sit next to each other in the sidebar.
 *
 * `Toggle` renders the library's own `Switch`, so the chrome tracks the real
 * component instead of re-deriving its track geometry, thumb spring and
 * reduced-motion handling by hand. `Action` is a plain button; `Choice` renders
 * the library's own `ChoiceGroup`.
 *
 * Every control carries a `story-*` testID, and that is what a `play` function
 * should drive it by. A `Toggle` is a real switch and therefore *does* answer
 * `findByRole('switch')` — so in a story whose playground mounts one, a bare
 * `findByRole('switch')` is ambiguous with the subject. Query the chrome by its
 * testID, and the subject by its accessible name.
 *
 * This directory is excluded from the published package (see package.json
 * `files`), and the filename is not `*.stories.tsx`, so Storybook's glob never
 * picks it up as a story of its own.
 */

import { type ReactNode, useCallback } from 'react';
import { type FlexAlignType, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { ChoiceGroup, type ChoiceGroupItem } from '../components/form/ChoiceGroup/choice-group';
import { Switch } from '../components/form/Switch/switch';
import { Text } from '../components/typography/Text/text';
import { cn } from '../lib/cn';
import { SURFACE_CLASSNAME } from '../lib/elevated';

const alignClassname: Record<FlexAlignType, string> = {
  'flex-start': 'items-start',
  center: 'items-center',
  'flex-end': 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

type PlaygroundProps = { children: ReactNode; className?: string; style?: StyleProp<ViewStyle> };

type ToggleProps = { label: string; value: boolean; onChange: (next: boolean) => void };
type ActionProps = { label: string; onPress: () => void };
type ChoiceOption<T extends string> = { value: T; label: string };
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
type FrostedBackdropProps = { children: ReactNode; className?: string };
type CodeProps = { children: ReactNode };

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

/** Vertical frame for a playground story: controls, then sample rows. */
export function Playground({ children, className }: PlaygroundProps) {
  return <View className={cn('min-w-[280px] gap-5', className)}>{children}</View>;
}

/**
 * Boolean control — the library's own `Switch`, labelled and driven by a
 * `story-toggle-*` testID.
 *
 * Being a real `Switch` means it answers `role="switch"`; see the note in the
 * file header on querying it without colliding with the subject.
 */
export function Toggle({ label, value, onChange }: ToggleProps) {
  // `onSelectedChange` already receives the next value, so it is `onChange` exactly.
  return (
    <Switch label={label} isSelected={value} onSelectedChange={onChange} testID={`story-toggle-${slug(label)}`} theme="info" />
  );
}

/** One-shot control — replay an animation, reset a counter, fire a callback. */
export function Action({ label, onPress }: ActionProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      className={cn('rounded-interactive px-3 py-1.5', SURFACE_CLASSNAME[4])}
      testID={`story-action-${slug(label)}`}
    >
      <Text className="text-foreground" size="sm" weight="medium">
        {label}
      </Text>
    </Pressable>
  );
}

/** Enum control — a row of ChoiceGroup items, one selected at a time. */
export function Choice<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  const items: ChoiceGroupItem[] = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : { value: option.value, label: option.label },
  );

  // Bridge ChoiceGroup's `onValueChange: (string) => void` to Choice's
  // `onChange: (T) => void`.  Look up the original option so TypeScript
  // narrows from `string` to `T` without a cast.
  const handleChange = useCallback(
    (next: string) => {
      const match = options.find((o) => (typeof o === 'string' ? o : o.value) === next);
      if (match) onChange(typeof match === 'string' ? match : match.value);
    },
    [onChange, options],
  );

  return (
    <View className="w-fit items-start gap-1.5">
      {label ? (
        <Text className="text-muted-foreground" size="xs">
          {label}
        </Text>
      ) : null}
      <ChoiceGroup
        items={items}
        value={value}
        onValueChange={handleChange}
        size="sm"
        testID={`story-choice${label ? `-${slug(label)}` : ''}`}
      />
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
    <View className={cn('gap-1.5', alignClassname[align], className)} style={style}>
      {children}
      {label ? (
        <Text className="text-muted-foreground" size="xs">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A colourful striped backdrop for frosted-glass stories. Backdrop blur needs
 * high-contrast colour behind it to read, so the striped bars give the frost
 * something to smear and make the translucent `glass` tint actually visible.
 * Children are layered above the stripes.
 */
export function FrostedBackdrop({ children, className }: FrostedBackdropProps) {
  return (
    <View className={cn('relative overflow-hidden rounded-xl', className)}>
      <View className="absolute inset-0 flex-row">
        <View className="flex-1 bg-danger" />
        <View className="flex-1 bg-warning" />
        <View className="flex-1 bg-success" />
        <View className="flex-1 bg-primary" />
      </View>
      {children}
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

/**
 * Inline monospace fragment for prose. Rendered as the library's own `Text`
 * (`font="mono"`) because a raw `<code>` element has no native view config and
 * crashes the mobile storybook with "Something went wrong rendering your story".
 */
export function Code({ children }: CodeProps) {
  return (
    <Text font="mono" className="text-muted-foreground">
      {children}
    </Text>
  );
}
