import { type ReactNode, useCallback, useState } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { ChevronDown } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { useThemeColor } from '../../theme/use-theme-color';

export type BouncyAccordionItem = {
  id: string;
  title: string;
  description?: string;
  /** Leading icon element. Pass an explicit `color` — RN icons don't inherit currentColor. */
  icon?: ReactNode;
  disabled?: boolean;
};

// biome-ignore lint/style/useExportsLast: props type before spring constants — collocated for readability
export type BouncyAccordionProps = {
  items: BouncyAccordionItem[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  collapsible?: boolean;
  /** Additional NativeWind class names merged onto the outer wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Replace the expand/collapse chevron. Default: `<ChevronDown size={16} color={chevronColor} />`. */
  chevronIcon?: ReactNode;
};

// Bouncy springs mirror the web bounce values (dampingRatio ≈ 1 − bounce).
// The gap/radius spring stays lightly damped so connected rows move together.
const noMotion = { type: 'timing', duration: 0 } as const;
const ROW_TRANSITION = { type: 'spring', stiffness: 240, damping: 19, mass: 1 } as const;
const CONTENT_OPEN_TRANSITION = { type: 'spring', stiffness: 220, damping: 20, mass: 1 } as const;
const CONTENT_CLOSE_TRANSITION = { type: 'spring', stiffness: 260, damping: 24, mass: 1 } as const;
const CHEVRON_TRANSITION = { type: 'spring', stiffness: 300, damping: 25, mass: 1 } as const;
const DESCRIPTION_TRANSITION = { type: 'timing', duration: 180 } as const;

function useControllableValue(
  value: string | null | undefined,
  defaultValue: string | null,
  onValueChange?: (v: string | null) => void,
) {
  const [internal, setInternal] = useState<string | null>(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const setValue = useCallback(
    (next: string | null) => {
      if (!controlled) setInternal(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );
  return [current, setValue] as const;
}

export type BouncyAccordionRowProps = {
  item: BouncyAccordionItem;
  open: boolean;
  startsGroup: boolean;
  endsGroup: boolean;
  separatedFromPrevious: boolean;
  reduce: boolean;
  onToggle: (id: string) => void;
  /** Replace the expand/collapse chevron. Default: `<ChevronDown size={16} color={chevronColor} />`. */
  chevronIcon?: ReactNode;
};

function BouncyAccordionRow({
  item,
  open,
  startsGroup,
  endsGroup,
  separatedFromPrevious,
  reduce,
  onToggle,
  chevronIcon,
}: BouncyAccordionRowProps) {
  const chevronColor = useThemeColor('muted-foreground');
  const [contentHeight, setContentHeight] = useState(0);
  const onContentLayout = useCallback((e: LayoutChangeEvent) => {
    setContentHeight(e.nativeEvent.layout.height);
  }, []);
  const handleToggle = useCallback(() => onToggle(item.id), [onToggle, item.id]);

  const topRadius = startsGroup ? 28 : 0;
  const bottomRadius = endsGroup ? 28 : 0;
  const openContentTransition = open ? CONTENT_OPEN_TRANSITION : CONTENT_CLOSE_TRANSITION;
  const contentTransition = reduce ? noMotion : openContentTransition;
  const descTransition = reduce ? noMotion : DESCRIPTION_TRANSITION;

  return (
    <MotiView
      animate={{ marginTop: separatedFromPrevious ? 12 : 0 }}
      transition={reduce ? { type: 'timing', duration: 0 } : ROW_TRANSITION}
    >
      <MotiView
        animate={{
          borderTopLeftRadius: topRadius,
          borderTopRightRadius: topRadius,
          borderBottomLeftRadius: bottomRadius,
          borderBottomRightRadius: bottomRadius,
        }}
        transition={reduce ? { type: 'timing', duration: 0 } : ROW_TRANSITION}
        className="overflow-hidden bg-card"
        style={{ opacity: item.disabled ? 0.5 : 1 }}
      >
        <Pressable
          accessibilityRole="button"
          aria-expanded={open}
          aria-disabled={Boolean(item.disabled)}
          accessibilityLabel={item.title}
          disabled={item.disabled}
          onPress={handleToggle}
          className="min-h-[54px] w-full flex-row items-center gap-4 px-5"
        >
          {item.icon ? <View className="h-7 w-7 shrink-0 items-center justify-center">{item.icon}</View> : null}
          <Text numberOfLines={1} className="min-w-0 flex-1 font-medium text-[15px] text-foreground">
            {item.title}
          </Text>
          <MotiView
            animate={{ rotate: open ? '180deg' : '0deg' }}
            transition={reduce ? { type: 'timing', duration: 0 } : CHEVRON_TRANSITION}
            className="h-6 w-6 shrink-0 items-center justify-center"
          >
            {chevronIcon ?? <ChevronDown size={16} color={chevronColor} />}
          </MotiView>
        </Pressable>

        {/* Animated clip: outer height springs between 0 and the measured content
            height. The inner block is always laid out so onLayout can measure it. */}
        <MotiView
          animate={{ height: open && item.description ? contentHeight : 0 }}
          transition={contentTransition}
          className="overflow-hidden"
        >
          <MotiView
            animate={{ opacity: open ? 1 : 0 }}
            transition={descTransition}
            onLayout={onContentLayout}
            className="px-5 pb-5"
            style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
          >
            <Text className="text-[15px] text-muted-foreground leading-6">{item.description}</Text>
          </MotiView>
        </MotiView>
      </MotiView>
    </MotiView>
  );
}

export function BouncyAccordion({
  items,
  value,
  defaultValue = null,
  onValueChange,
  collapsible = true,
  className,
  style,
  testID,
  chevronIcon,
}: BouncyAccordionProps) {
  const reduce = useReducedMotion();
  const [activeValue, setActiveValue] = useControllableValue(value, defaultValue, onValueChange);
  const activeIndex = items.findIndex((item) => item.id === activeValue);

  const toggleItem = useCallback(
    (id: string) => {
      if (activeValue === id) {
        if (collapsible) setActiveValue(null);
        return;
      }
      setActiveValue(id);
    },
    [activeValue, collapsible, setActiveValue],
  );

  return (
    <View testID={testID} className={cn('w-full', className)} style={style}>
      {items.map((item, index) => {
        const open = activeValue === item.id;
        const previousIsOpen = activeIndex === index - 1;
        const nextIsOpen = activeIndex === index + 1;
        const startsGroup = open || index === 0 || previousIsOpen;
        const endsGroup = open || index === items.length - 1 || nextIsOpen;
        const separatedFromPrevious = index > 0 && (open || previousIsOpen);

        return (
          <BouncyAccordionRow
            key={item.id}
            item={item}
            open={open}
            startsGroup={startsGroup}
            endsGroup={endsGroup}
            separatedFromPrevious={separatedFromPrevious}
            reduce={reduce}
            onToggle={toggleItem}
            chevronIcon={chevronIcon}
          />
        );
      })}
    </View>
  );
}
