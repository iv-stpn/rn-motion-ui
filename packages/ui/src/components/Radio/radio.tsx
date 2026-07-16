import { cva } from 'class-variance-authority';
import { AnimatePresence, MotiView } from 'moti';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { SPRING_LAYOUT, SPRING_PRESS } from '../../lib/ease';

type RadioCtx = {
  value: string;
  setValue: (value: string) => void;
};

const RadioContext = createContext<RadioCtx | null>(null);

function useRadioGroup() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('RadioGroupItem must be used inside <RadioGroup>');
  return ctx;
}

export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  orientation?: 'vertical' | 'horizontal';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

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

export function RadioGroup({
  value,
  defaultValue = '',
  onValueChange,
  children,
  orientation = 'vertical',
  style,
  testID,
}: RadioGroupProps) {
  const [internal, setInternal] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const setValue = (next: string) => {
    if (!controlled) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <RadioContext.Provider value={{ value: current, setValue }}>
      <View accessibilityRole="radiogroup" testID={testID} className={group({ orientation })} style={style}>
        {children}
      </View>
    </RadioContext.Provider>
  );
}

export interface RadioGroupItemProps {
  value: string;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

// Border swaps to primary when selected; the inner dot animates in via moti.
const control = cva('h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', {
  variants: {
    selected: {
      true: 'border-primary',
      false: 'border-muted-foreground/50',
    },
  },
  defaultVariants: { selected: false },
});

// RN fallback: the web uses a shared-layout `layoutId` dot that glides between
// items. RN has no shared-element layout, so each item owns its own dot that
// springs in/out via AnimatePresence — same feel, no cross-item morph.
export function RadioGroupItem({ value, label, disabled, style, accessibilityLabel, testID }: RadioGroupItemProps) {
  const { value: groupValue, setValue } = useRadioGroup();
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const selected = groupValue === value;

  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={selected}
      aria-disabled={!!disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => !disabled && setValue(value)}
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
      >
        <AnimatePresence>
          {selected ? (
            <MotiView
              key="dot"
              from={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
              transition={{
                type: 'spring',
                stiffness: SPRING_LAYOUT.stiffness,
                damping: SPRING_LAYOUT.damping,
                mass: SPRING_LAYOUT.mass,
              }}
              className="h-2.5 w-2.5 rounded-full bg-primary"
            />
          ) : null}
        </AnimatePresence>
      </MotiView>
      {label ? <Text className="select-none text-sm text-foreground">{label}</Text> : null}
    </Pressable>
  );
}
