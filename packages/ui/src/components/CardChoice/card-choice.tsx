import type { ReactNode } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { Text } from '../Text/text';

/** Join truthy class strings. (Local helper — this package ships no shared `cn`.) */
function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => typeof part === 'string').join(' ');
}

export type CardChoiceProps = {
  selected: boolean;
  onPress: () => void;
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
};

/**
 * A selectable card with a radio indicator, title/subtitle and an optional badge.
 * Use inside a row/grid for single-select choices (e.g. billing periods, plans).
 */
export function CardChoice({
  selected,
  onPress,
  title,
  subtitle,
  badge,
  children,
  className,
  style,
  numeric = false,
}: CardChoiceProps) {
  return (
    <Pressable
      onPress={onPress}
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
        {/* Inlined RadioIndicator — only this component uses it here, so a
            separate file would fragment a tightly-coupled presentational bit. */}
        <View
          className={cn('h-5 w-5 items-center justify-center rounded-full border', selected ? 'border-primary' : 'border-border')}
        >
          {selected ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
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
