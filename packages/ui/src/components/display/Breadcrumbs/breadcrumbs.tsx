// A trail of the levels above the current one, each a way back to where it
// names. Presentation only: it takes the segments it is given and reports which
// one was pressed, so what a level *is* — a folder, a route, a wizard step —
// stays the caller's business.

import { type ComponentType, type ReactNode, useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { More1Line as MoreHorizontal } from 'rn-motion-ui-icons/icons/more-1-line';
import { RightLine as ChevronRight } from 'rn-motion-ui-icons/icons/right-line';
import { cn } from '../../../lib/cn';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';
import { type BreadcrumbSlot, collapseBreadcrumbs } from './breadcrumbs-collapse';

const SIZES = {
  base: { gap: 'gap-1', icon: 14, caret: 16, text: 'base' },
  sm: { gap: 'gap-0.5', icon: 12, caret: 14, text: 'sm' },
} as const satisfies Record<BreadcrumbsSize, { gap: string; icon: number; caret: number; text: 'base' | 'sm' }>;

// Touch target for the pressable segments, once their `px-1 py-0.5` padding
// moved to `hitSlop` so the label keeps a tight visual footprint. Matches the
// old padding's 4px sides / 2px top and bottom.
const SEGMENT_HIT_SLOP = { top: 2, bottom: 2, left: 4, right: 4 } as const;

type SegmentProps = {
  item: BreadcrumbItem;
  onNavigate: (id: string) => void;
  className: string;
  iconSize: number;
  textSize: 'base' | 'sm';
  testID?: string;
};

function BreadcrumbLink({ className, item, iconSize, onNavigate, testID, textSize }: SegmentProps) {
  const handlePress = useCallback(() => onNavigate(item.id), [item.id, onNavigate]);
  const Icon = item.icon;
  return (
    <Pressable
      accessibilityLabel={item.accessibilityLabel ?? `Go to ${item.label}`}
      accessibilityRole="button"
      className={cn('flex-row items-center gap-1', className)}
      hitSlop={SEGMENT_HIT_SLOP}
      onPress={handlePress}
      testID={testID}
    >
      {Icon ? <ThemedIcon icon={Icon} size={iconSize} token="muted-foreground" /> : null}
      <Text className="text-muted-foreground" numberOfLines={1} size={textSize}>
        {item.label}
      </Text>
    </Pressable>
  );
}

// The level the trail arrived at. Deliberately not a control: it leads nowhere,
// and being the one unpressable segment is what marks it as the current one.
function BreadcrumbCurrent({ className, item, iconSize, textSize, testID }: Omit<SegmentProps, 'onNavigate'>) {
  const Icon = item.icon;
  return (
    <View className={cn('flex-row items-center gap-1', className)} testID={testID}>
      {Icon ? <ThemedIcon icon={Icon} size={iconSize} token="foreground" /> : null}
      <Text accessibilityRole="text" numberOfLines={1} size={textSize} weight="medium">
        {item.label}
      </Text>
    </View>
  );
}

type EllipsisProps = { className: string; hiddenCount: number; iconSize: number; onExpand: () => void; testID?: string };

function BreadcrumbEllipsis({ className, hiddenCount, iconSize, onExpand, testID }: EllipsisProps) {
  const noun = hiddenCount === 1 ? 'level' : 'levels';
  return (
    <Pressable
      accessibilityLabel={`Show ${hiddenCount} hidden ${noun}`}
      accessibilityRole="button"
      className={cn('flex-row items-center', className)}
      hitSlop={SEGMENT_HIT_SLOP}
      onPress={onExpand}
      testID={testID}
    >
      <ThemedIcon icon={MoreHorizontal} size={iconSize} token="muted-foreground" />
    </Pressable>
  );
}

/** A level: plain text once the trail has arrived at it, a way back until then. */
function BreadcrumbSegment({
  className,
  isCurrent,
  iconSize,
  item,
  onNavigate,
  testID,
  textSize,
}: SegmentProps & { isCurrent: boolean }) {
  return isCurrent ? (
    <BreadcrumbCurrent
      className={className}
      iconSize={iconSize}
      item={item}
      testID={testID ? `${testID}-current` : undefined}
      textSize={textSize}
    />
  ) : (
    <BreadcrumbLink
      className={className}
      iconSize={iconSize}
      item={item}
      onNavigate={onNavigate}
      testID={testID ? `${testID}-item-${item.id}` : undefined}
      textSize={textSize}
    />
  );
}

/** Text scale for the whole trail. Sets the label size and the separator with it. */
export type BreadcrumbsSize = 'sm' | 'base';

export type BreadcrumbItem = {
  /** Stable identity, and what `onNavigate` reports. A path, a route key, an index. */
  id: string;
  label: string;
  /** Drawn before the label — a house at the root of a trail, say. */
  icon?: ComponentType<IconProps>;
  /** Overrides the default `Go to {label}` accessible name. */
  accessibilityLabel?: string;
};

export type BreadcrumbsProps = {
  /** The trail, outermost level first. Renders nothing for an empty list. */
  items: readonly BreadcrumbItem[];
  /** The pressed level's `id`. Not called for the current level — it has no press. */
  onNavigate: (id: string) => void;
  /**
   * Which level the trail has arrived at: rendered as plain text rather than a
   * control, since it goes nowhere. Defaults to the last item; pass `null` to
   * make every level pressable (a trail whose leaf is not the destination).
   */
  currentId?: string | null;
  /** Drawn between levels. Defaults to a chevron at the trail's size. */
  separator?: ReactNode;
  /**
   * Cap on rendered levels, collapsing the middle into a `…` that expands on
   * press. Unset renders every level. See {@link collapseBreadcrumbs}.
   */
  maxVisible?: number;
  size?: BreadcrumbsSize;
  /**
   * Scrolls horizontally rather than wrapping, so a deep trail keeps one line.
   * @default true
   */
  scrollable?: boolean;
  accessibilityLabel?: string;
  /** On the outer container — borders and background belong here. */
  className?: string;
  /** On the row holding the segments — padding and spacing belong here. */
  contentClassName?: string;
  /** On every segment, pressable or not, so both share one visual shape. */
  itemClassName?: string;
  testID?: string;
};

/**
 * A breadcrumb trail: the levels above the current one, each pressable, with the
 * current one as plain text at the end.
 *
 * It knows nothing about what a level is — pass `items` outermost-first and read
 * back the pressed `id`:
 *
 * ```tsx
 * <Breadcrumbs
 *   items={[{ id: '', label: 'Files' }, { id: 'docs/', label: 'Documents' }]}
 *   onNavigate={navigateTo}
 * />
 * ```
 *
 * A deep trail scrolls horizontally by default. Set `maxVisible` instead to keep
 * it to a fixed number of levels, collapsing the middle behind a `…` that
 * expands on press — nothing becomes unreachable.
 *
 * Accessibility: the container is a `list`, each earlier level is a `button`
 * named `Go to {label}` (override per item with `accessibilityLabel`), and the
 * current level is text — unpressable, which is what distinguishes it. RN has no
 * `aria-current`, so the trail does not claim one.
 */
export function Breadcrumbs({
  accessibilityLabel = 'Breadcrumb',
  className,
  contentClassName,
  currentId,
  itemClassName,
  items,
  maxVisible,
  onNavigate,
  scrollable = true,
  separator,
  size = 'sm',
  testID,
}: BreadcrumbsProps) {
  const { gap, icon: iconSize, caret: caretSize, text: textSize } = SIZES[size];
  // Keyed on the trail itself, so expanding one trail does not leave a later,
  // unrelated one expanded — navigating collapses it again without an effect.
  const trailKey = items.map((item) => item.id).join('\0');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const handleExpand = useCallback(() => setExpandedKey(trailKey), [trailKey]);

  const isExpanded = expandedKey === trailKey;
  const slots: BreadcrumbSlot<BreadcrumbItem>[] = useMemo(
    () => collapseBreadcrumbs(items, isExpanded ? undefined : maxVisible),
    [items, isExpanded, maxVisible],
  );

  if (items.length === 0) return null;

  const resolvedCurrentId = currentId === undefined ? items.at(-1)?.id : currentId;
  const itemClass = cn('rounded', itemClassName);
  const separatorNode = separator ?? <ThemedIcon icon={ChevronRight} size={caretSize} token="muted-foreground" />;

  const segments = slots.map((slot, index) => (
    <View className={cn('flex-row items-center', gap)} key={slot.type === 'ellipsis' ? 'breadcrumb-ellipsis' : slot.item.id}>
      {index > 0 ? separatorNode : null}
      {slot.type === 'ellipsis' ? (
        <BreadcrumbEllipsis
          className={itemClass}
          hiddenCount={slot.hidden.length}
          iconSize={iconSize}
          onExpand={handleExpand}
          testID={testID ? `${testID}-ellipsis` : undefined}
        />
      ) : (
        <BreadcrumbSegment
          className={itemClass}
          iconSize={iconSize}
          isCurrent={slot.item.id === resolvedCurrentId}
          item={slot.item}
          onNavigate={onNavigate}
          testID={testID}
          textSize={textSize}
        />
      )}
    </View>
  ));

  const contentClass = cn('flex-row items-center', gap, contentClassName);

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="list" className={cn('shrink-0', className)} testID={testID}>
      {scrollable ? (
        <ScrollView contentContainerClassName={contentClass} horizontal={true} showsHorizontalScrollIndicator={false}>
          {segments}
        </ScrollView>
      ) : (
        <View className={cn(contentClass, 'flex-wrap')}>{segments}</View>
      )}
    </View>
  );
}

export type { BreadcrumbSlot } from './breadcrumbs-collapse';
