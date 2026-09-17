import { cva } from 'class-variance-authority';
import { createContext, type ReactNode, type RefObject, useCallback, useContext, useRef, useState } from 'react';
import { type LayoutChangeEvent, type LayoutRectangle, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { useArrowRoving } from '../../../hooks/use-arrow-roving';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { usePressState } from '../../../hooks/use-press-state';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { SPRING_PRESS } from '../../../lib/ease';
import { FOCUS_VISIBLE_RING } from '../../../lib/focus-ring';
import { hitSlopFor } from '../../../lib/radius';
import { MotiView } from '../../../moti/components/view';
import { MOTION_SNAPPY, type MotiTransitionProp, mergeTransition, TIMING_INSTANT } from '../../../theme/motion';
import { Text } from '../../typography/Text/text';

type RadioCtx = {
  value: string;
  setValue: (value: string) => void;
  reduce: boolean;
  layouts: Record<string, LayoutRectangle>;
  register: (value: string, layout: LayoutRectangle) => void;
  /** The group's own testID, used to derive per-item ones. */
  testID?: string;
  /** Item values in DOM order, appended as each item mounts — arrow-key roving walks this. */
  orderRef: RefObject<string[]>;
};

const RadioContext = createContext<RadioCtx | null>(null);

function useRadioGroup() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('RadioGroupItem must be used inside <RadioGroup>');
  return ctx;
}

// biome-ignore lint/style/useExportsLast: props type before layout constants — collocated for readability
export type RadioGroupProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  orientation?: 'vertical' | 'horizontal';
  /** Additional UniWind class names merged onto the group container. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * Override the indicator animation. Partial — only the fields you pass are changed.
   * Default: `MOTION_SNAPPY` (stiffness 500, damping 30, mass 0.6).
   */
  transition?: Partial<MotiTransitionProp>;
};

// Layout swaps the flex direction; horizontal wraps like the web original.
const group = cva('gap-3', {
  variants: {
    orientation: {
      vertical: 'flex-col',
      horizontal: 'flex-row flex-wrap',
    },
  },
  defaultVariants: { orientation: 'vertical' },
});

// Ring outer size (h-5 = 20 px) and dot size (h-3 = 12 px). Used to centre
// the overlay dot inside the ring measured via the Pressable's onLayout.
const RING_SIZE = 20;
const DOT_SIZE = 12;

export function RadioGroup({
  value,
  defaultValue = '',
  onValueChange,
  children,
  orientation = 'vertical',
  className,
  style,
  testID,
  transition,
}: RadioGroupProps) {
  const reduce = useReducedMotion();
  const [internal, setInternal] = useState(defaultValue);
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  // Item values in DOM order, appended as each item mounts. A stable array
  // (mutated in place, never reassigned) so `useArrowRoving` doesn't re-subscribe.
  const orderRef = useRef<string[]>([]);
  const groupRef = useRef<View>(null);
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const indicatorSpring = mergeTransition(MOTION_SNAPPY, transition);

  const setValue = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  const register = useCallback((v: string, layout: LayoutRectangle) => {
    setLayouts((prev) => {
      const existing = prev[v];
      if (existing && existing.x === layout.x && existing.y === layout.y && existing.height === layout.height) return prev;
      return { ...prev, [v]: layout };
    });
  }, []);

  // Arrow keys rove the selection AND focus (vertical groups: Up/Down;
  // horizontal: Left/Right), per the WAI-ARIA radio pattern.
  useArrowRoving(groupRef, {
    role: '[role="radio"]',
    axis: orientation === 'horizontal' ? 'horizontal' : 'vertical',
    values: orderRef.current,
    selected: current,
    onSelect: setValue,
  });

  const activeLayout = layouts[current];

  return (
    <RadioContext.Provider value={{ value: current, setValue, reduce, layouts, register, testID, orderRef }}>
      <View
        ref={groupRef}
        accessibilityRole="radiogroup"
        testID={testID}
        className={cn(group({ orientation }), className)}
        style={[{ position: 'relative' }, style]}
      >
        {/* Single shared dot that glides to the active item — mirrors the web
            layoutId pattern. Each Pressable reports its frame via onLayout; the
            dot is centred inside the ring (RING_SIZE × RING_SIZE) that sits at
            x=0 of the Pressable and is vertically centred by items-center. */}
        {activeLayout ? (
          <MotiView
            animate={{
              translateX: activeLayout.x + (RING_SIZE - DOT_SIZE) / 2,
              translateY: activeLayout.y + (activeLayout.height - DOT_SIZE) / 2,
            }}
            transition={reduce ? TIMING_INSTANT : indicatorSpring}
            testID={`${testID ?? 'radio-group'}-indicator`}
            className="pointer-events-none absolute top-0 left-0 h-3 w-3 rounded-full bg-primary"
          />
        ) : null}
        {children}
      </View>
    </RadioContext.Provider>
  );
}

export type RadioGroupItemProps = {
  value: string;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /**
   * Defaults to `${group testID ?? 'radio-group'}-item-<value>`, so every item is
   * addressable without threading ids through. Pass one to override it. The ring
   * inside gets `-control` appended to whichever id is used.
   */
  testID?: string;
};

// Border swaps to primary when selected; the shared dot in RadioGroup glides to it.
const control = cva('h-5 w-5 shrink-0 rounded-full hairline', {
  variants: {
    selected: {
      true: 'border-primary',
      false: 'border-muted-foreground/50',
    },
  },
  defaultVariants: { selected: false },
});

export function RadioGroupItem({ value, label, disabled, style, accessibilityLabel, testID }: RadioGroupItemProps) {
  const { value: groupValue, setValue, reduce, register, testID: groupTestID, orderRef } = useRadioGroup();
  const { pressed, pressHandlers } = usePressState();
  const selected = groupValue === value;
  // Derive from the group so items are addressable without threading a testID
  // through every child; an explicit prop still wins. Falls back to the
  // component name when the group has no testID.
  const itemTestID = testID ?? `${groupTestID ?? 'radio-group'}-item-${value}`;

  // Register in DOM order so arrow-key roving can walk the group; deduped so a
  // remount of the same value never appends twice.
  useMountEffect(() => {
    if (!orderRef.current.includes(value)) orderRef.current.push(value);
  });

  const handlePress = useCallback(() => {
    if (!disabled) setValue(value);
  }, [disabled, setValue, value]);

  const onLayout = useCallback((e: LayoutChangeEvent) => register(value, e.nativeEvent.layout), [register, value]);

  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={selected}
      aria-disabled={Boolean(disabled)}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={itemTestID}
      disabled={disabled}
      tabIndex={selected ? 0 : -1}
      hitSlop={hitSlopFor(20)}
      {...pressHandlers}
      onPress={handlePress}
      onLayout={onLayout}
      className={cn('flex-row items-center', FOCUS_VISIBLE_RING)}
      style={[{ gap: 12, opacity: disabled ? 0.6 : 1 }, style]}
    >
      <MotiView
        animate={{ scale: pressed && !disabled && !reduce ? 0.92 : 1 }}
        transition={{
          type: 'spring',
          stiffness: SPRING_PRESS.stiffness,
          damping: SPRING_PRESS.damping,
          mass: SPRING_PRESS.mass,
        }}
        testID={`${itemTestID}-control`}
        className={control({ selected })}
      />
      {label ? <Text className="select-none text-foreground text-sm">{label}</Text> : null}
    </Pressable>
  );
}
