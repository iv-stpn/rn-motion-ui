import { cva } from 'class-variance-authority';
import { AnimatePresence, MotiView } from 'moti';
import { type ReactNode, useCallback, useState } from 'react';
import { Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { SPRING_PRESS } from '../../lib/ease';
import { MoreHorizontal, X } from '../../lib/icons';

// RN FALLBACK vs web: the web rail uses framer `layout` on every node so the
// track smoothly resizes as the overflow group mounts/unmounts, plus a blur
// filter on the entering actions. RN has no shared-layout resize or blur filter,
// so the overflow group lives in an overflow-hidden clip whose width + marginLeft
// spring between 0 and the group's measured natural width (onLayout). Because the
// clip is a flex child, the track reflows with it every frame — the toggle glides
// right as the group grows instead of the whole width snapping open at once. The
// toggle icon still cross-fades. Hover scale is dropped (touch); press scale kept.

export type OverflowActionsSize = 'sm' | 'md';

export type OverflowActionItem = {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export interface OverflowActionsProps {
  primaryActions: OverflowActionItem[];
  overflowActions: OverflowActionItem[];
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onAction?: (item: OverflowActionItem) => void;
  collapseOnAction?: boolean;
  size?: OverflowActionsSize;
  /** Toggle a11y label when collapsed. */
  openLabel?: string;
  /** Toggle a11y label when expanded. */
  closeLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Softer than the app defaults so the group stays attached to the toggle.
const SHELL_SPRING = { type: 'spring', stiffness: 220, damping: 17, mass: 0.85 } as const;

// cva drives the static per-size styling; class strings stay static literals.
// No flex `gap` here: the overflow clip is an always-mounted flex child, so a
// track gap would render on both sides of it even at width 0 (phantom spacing
// when collapsed). Inter-segment spacing is driven by explicit margins instead.
const track = cva('relative flex-row items-center overflow-hidden rounded-full border border-border bg-card', {
  variants: { size: { sm: 'p-1', md: 'p-1.5' } },
  defaultVariants: { size: 'md' },
});
const group = cva('flex-row items-center', {
  variants: { size: { sm: 'gap-1', md: 'gap-1.5' } },
  defaultVariants: { size: 'md' },
});
const action = cva('flex-row shrink-0 items-center justify-center rounded-full bg-background', {
  variants: { size: { sm: 'h-8 gap-1.5 px-3', md: 'h-9 gap-2 px-3.5' } },
  defaultVariants: { size: 'md' },
});
const toggle = cva('shrink-0 items-center justify-center rounded-full bg-primary', {
  variants: { size: { sm: 'h-8 w-8', md: 'h-9 w-9' } },
  defaultVariants: { size: 'md' },
});

export function OverflowActions({
  primaryActions,
  overflowActions,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  onAction,
  collapseOnAction = false,
  size = 'md',
  openLabel = 'Show extra actions',
  closeLabel = 'Hide extra actions',
  style,
  testID,
}: OverflowActionsProps) {
  const reduce = useReducedMotion();
  const [internal, setInternal] = useState(defaultExpanded);
  const [togglePressed, setTogglePressed] = useState(false);
  // Natural width of the overflow group, measured offscreen so the clip has an
  // explicit target to spring toward (0 while collapsed → this while expanded).
  const [overflowWidth, setOverflowWidth] = useState(0);
  const controlled = expanded !== undefined;
  const isExpanded = controlled ? expanded : internal;
  const gap = size === 'sm' ? 4 : 6;

  const setExpanded = useCallback(
    (next: boolean) => {
      if (!controlled) setInternal(next);
      onExpandedChange?.(next);
    },
    [controlled, onExpandedChange],
  );

  const handleAction = useCallback(
    (item: OverflowActionItem) => {
      item.onPress?.();
      onAction?.(item);
      if (collapseOnAction) setExpanded(false);
    },
    [onAction, collapseOnAction, setExpanded],
  );

  const spring = reduce ? { type: 'timing' as const, duration: 0 } : SHELL_SPRING;

  return (
    <View testID={testID} className="flex-row self-start" style={style}>
      <View className={track({ size })}>
        <View className={group({ size })}>
          {primaryActions.map((item) => (
            <ActionButton key={item.id} item={item} size={size} reduce={reduce} onAction={handleAction} />
          ))}
        </View>

        {/* Animated clip: the group is measured offscreen at natural width, then
            the visible clip springs its width + left margin between 0 (collapsed)
            and that width (expanded). Flex reflows each frame, so the toggle to
            the right glides over smoothly instead of teleporting. */}
        <MotiView
          animate={{
            width: isExpanded ? overflowWidth : 0,
            marginLeft: isExpanded ? gap : 0,
            opacity: isExpanded ? 1 : 0,
          }}
          transition={spring}
          className="overflow-hidden"
        >
          {/* Offscreen measurer at natural size — feeds the spring its target.
              aria-hidden keeps the duplicate buttons out of the accessibility tree
              so queries like findByRole('button', { name }) don't match twice. */}
          <View
            aria-hidden={true}
            pointerEvents="none"
            onLayout={(e) => setOverflowWidth(e.nativeEvent.layout.width)}
            className={group({ size })}
            style={{ position: 'absolute', left: 0, top: 0, opacity: 0 }}
          >
            {overflowActions.map((item) => (
              <ActionButton key={item.id} item={item} size={size} reduce={reduce} onAction={handleAction} />
            ))}
          </View>
          <View className={group({ size })} style={{ alignSelf: 'flex-start' }}>
            {overflowActions.map((item) => (
              <ActionButton key={item.id} item={item} size={size} reduce={reduce} onAction={handleAction} />
            ))}
          </View>
        </MotiView>

        <MotiView animate={{ scale: togglePressed && !reduce ? 0.96 : 1 }} transition={SPRING_PRESS} style={{ marginLeft: gap }}>
          <Pressable
            accessibilityRole="button"
            aria-expanded={isExpanded}
            accessibilityLabel={isExpanded ? closeLabel : openLabel}
            onPressIn={() => setTogglePressed(true)}
            onPressOut={() => setTogglePressed(false)}
            onPress={() => setExpanded(!isExpanded)}
            className={toggle({ size })}
          >
            <AnimatePresence exitBeforeEnter={true}>
              <MotiView
                key={isExpanded ? 'close' : 'open'}
                from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                transition={{ type: 'timing', duration: reduce ? 100 : 180 }}
              >
                {isExpanded ? (
                  <X size={size === 'sm' ? 14 : 16} color="#fafafa" />
                ) : (
                  <MoreHorizontal size={size === 'sm' ? 14 : 16} color="#fafafa" />
                )}
              </MotiView>
            </AnimatePresence>
          </Pressable>
        </MotiView>
      </View>
    </View>
  );
}

function ActionButton({
  item,
  size,
  reduce,
  onAction,
}: {
  item: OverflowActionItem;
  size: OverflowActionsSize;
  reduce: boolean;
  onAction: (item: OverflowActionItem) => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <MotiView animate={{ scale: pressed && !reduce ? 0.97 : 1 }} transition={SPRING_PRESS}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.accessibilityLabel ?? (typeof item.label === 'string' ? item.label : undefined)}
        aria-disabled={!!item.disabled}
        disabled={item.disabled}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={() => onAction(item)}
        className={action({ size })}
        style={{ opacity: item.disabled ? 0.45 : 1 }}
      >
        {item.icon == null ? null : item.icon}
        {typeof item.label === 'string' || typeof item.label === 'number' ? (
          <Text className="font-medium text-foreground" style={{ fontSize: size === 'sm' ? 12 : 14 }}>
            {item.label}
          </Text>
        ) : (
          item.label
        )}
      </Pressable>
    </MotiView>
  );
}
