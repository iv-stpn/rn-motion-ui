import { useCallback } from 'react';
import { Pressable } from 'react-native';
import { CheckFill } from 'rn-motion-ui-icons/icons/check-fill';
import { usePressState } from '../../../hooks/use-press-state';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { FOCUS_VISIBLE_RING } from '../../../lib/focus-ring';
import { MotiView } from '../../../moti/components/view';
import { MOTION_SNAPPY, TIMING_FAST, TIMING_INSTANT } from '../../../theme/motion';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';
import type { ActionFABItem } from './action-fab';

type ActionFABOptionProps = { item: ActionFABItem; rank: number; close: () => void };

/** Content-width action pill. Rank zero sits nearest the trigger and enters first. */
export function ActionFABOption({ item, rank, close }: ActionFABOptionProps) {
  const reduce = useReducedMotion();
  const { pressed, pressHandlers } = usePressState();
  const handlePress = useCallback(() => {
    if (item.disabled) return;
    close();
    item.onPress();
  }, [item, close]);
  const token = item.destructive ? 'danger' : 'foreground';
  const distance = 16 + Math.min(rank, 5) * 10;
  return (
    <MotiView
      from={{ opacity: 0, translateY: reduce ? 0 : distance, scale: reduce ? 1 : 0.94 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      exit={{ opacity: 0, translateY: reduce ? 0 : distance, scale: reduce ? 1 : 0.96 }}
      transition={reduce ? TIMING_INSTANT : { ...MOTION_SNAPPY, delay: Math.min(rank, 5) * 35 }}
      exitTransition={reduce ? TIMING_INSTANT : TIMING_FAST}
      className="max-w-full"
    >
      <Pressable
        {...pressHandlers}
        onPress={handlePress}
        disabled={item.disabled}
        accessibilityRole="menuitem"
        accessibilityLabel={item.label}
        accessibilityState={{ disabled: item.disabled, selected: item.selected }}
        aria-disabled={item.disabled}
        aria-selected={item.selected}
        testID={item.testID}
        className={cn(
          'min-h-11 max-w-full flex-row items-center gap-2 rounded-full bg-surface-1 px-4 py-2.5',
          FOCUS_VISIBLE_RING,
          !item.disabled && 'hover:bg-surface-hover',
          pressed && 'bg-surface-selected',
          item.disabled && 'opacity-40',
        )}
      >
        {item.icon ? <ThemedIcon icon={item.icon} size={18} token={token} /> : null}
        <Text weight="medium" className={cn('shrink text-sm', item.destructive ? 'text-danger' : 'text-foreground')}>
          {item.label}
        </Text>
        {item.selected ? <ThemedIcon icon={CheckFill} size={18} token={token} /> : null}
      </Pressable>
    </MotiView>
  );
}
