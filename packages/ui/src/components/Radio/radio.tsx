import { cva } from 'class-variance-authority';
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';
import {
  type LayoutChangeEvent,
  type LayoutRectangle,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { SPRING_PRESS } from '../../lib/ease';
import { MotiView } from '../../moti/components/view';
import { MOTION_SNAPPY, type MotiTransitionProp, mergeTransition, TIMING_INSTANT } from '../../theme/motion';

type RadioCtx = {
  value: string;
  setValue: (value: string) => void;
  reduce: boolean;
  layouts: Record<string, LayoutRectangle>;
  register: (value: string, layout: LayoutRectangle) => void;
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
  /** Additional NativeWind class names merged onto the group container. */
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

// Ring outer size (h-5 = 20 px) and dot size (h-2.5 = 10 px). Used to centre
// the overlay dot inside the ring measured via the Pressable's onLayout.
const RING_SIZE = 20;
const DOT_SIZE = 10;

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
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const indicatorSpring = mergeTransition(MOTION_SNAPPY, transition);

  const setValue = (next: string) => {
    if (!controlled) setInternal(next);
    onValueChange?.(next);
  };

  const register = useCallback((v: string, layout: LayoutRectangle) => {
    setLayouts((prev) => {
      const existing = prev[v];
      if (existing && existing.x === layout.x && existing.y === layout.y && existing.height === layout.height) return prev;
      return { ...prev, [v]: layout };
    });
  }, []);

  const activeLayout = layouts[current];

  return (
    <RadioContext.Provider value={{ value: current, setValue, reduce, layouts, register }}>
      <View
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
            className="h-2.5 w-2.5 rounded-full bg-primary"
            style={{ pointerEvents: 'none', position: 'absolute', left: 0, top: 0 }}
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
  testID?: string;
};

// Border swaps to primary when selected; the shared dot in RadioGroup glides to it.
const control = cva('h-5 w-5 shrink-0 rounded-full border-2', {
  variants: {
    selected: {
      true: 'border-primary',
      false: 'border-muted-foreground/50',
    },
  },
  defaultVariants: { selected: false },
});

export function RadioGroupItem({ value, label, disabled, style, accessibilityLabel, testID }: RadioGroupItemProps) {
  const { value: groupValue, setValue, reduce, register } = useRadioGroup();
  const [pressed, setPressed] = useState(false);
  const selected = groupValue === value;

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);
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
      testID={testID}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      onLayout={onLayout}
      className="flex-row items-center"
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
        className={control({ selected })}
      />
      {label ? <Text className="select-none text-foreground text-sm">{label}</Text> : null}
    </Pressable>
  );
}
