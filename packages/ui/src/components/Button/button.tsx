import { useReducedMotion } from '@rn-motion-ui/hooks/use-reduced-motion';
import { MotiView } from '@rn-motion-ui/moti/view';
import { cva, type VariantProps } from 'class-variance-authority';
import { Children, isValidElement, type ReactNode, useCallback, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';
// biome-ignore lint/style/useExportsLast: type collocated with sibling ButtonVariant export for readability
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

// cva drives the STATIC styling layer (per the conversion spec). Animated/tap
// scale stays inline on the MotiView. Class strings are static literals so the
// Tailwind/uniwind scanner picks them up.
const container = cva('flex-row items-center justify-center', {
  variants: {
    variant: {
      primary: 'bg-primary',
      secondary: 'border border-border bg-card',
      ghost: 'bg-transparent',
      outline: 'border border-border bg-transparent',
    },
    size: {
      sm: 'h-8 px-3 gap-1.5 rounded-full',
      md: 'h-10 px-5 gap-2 rounded-full',
      lg: 'h-12 px-6 gap-2 rounded-full',
      icon: 'h-8 w-8 rounded-lg',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

// biome-ignore lint/style/useComponentExportOnlyModules: label cva is a styling utility consumed by StatefulButton in the same component family; splitting to a separate file would fragment tightly-coupled button styles
export const label = cva('font-medium', {
  variants: {
    variant: {
      primary: 'text-primary-foreground',
      secondary: 'text-foreground',
      ghost: 'text-muted-foreground',
      outline: 'text-foreground',
    },
    size: { sm: 'text-xs', md: 'text-sm', lg: 'text-base', icon: 'text-sm' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

// Spinner stroke inherits the label colour so it reads on every variant.
const SPINNER_COLOR: Record<ButtonVariant, string> = {
  primary: '#fafafa',
  secondary: '#111111',
  ghost: '#111111',
  outline: '#111111',
};

export interface ButtonProps extends VariantProps<typeof container> {
  children?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Spawn a Material-style ripple from the press point. Off by default. */
  ripple?: boolean;
  /** Scale the button settles to while pressed. */
  pressScale?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

type Ripple = { id: number; x: number; y: number; size: number };

function renderChild(child: ReactNode, className: string): ReactNode {
  if (typeof child === 'string' || typeof child === 'number') return <Text className={className}>{child}</Text>;
  if (isValidElement(child)) return child;
  return null;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  onPress,
  disabled,
  loading,
  ripple = false,
  pressScale = 0.93,
  style,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);
  const size_ = useRef({ w: 0, h: 0 });
  const isDisabled = disabled || loading;
  const v = variant ?? 'primary';

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    size_.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  }, []);

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      setPressed(true);
      if (!ripple || reduce) return;
      const { locationX: x, locationY: y } = e.nativeEvent;
      const r = Math.max(size_.current.w, size_.current.h) * 2;
      const id = nextId.current;
      nextId.current += 1;
      setRipples((prev) => [...prev, { id, x, y, size: r }]);
      setTimeout(() => setRipples((prev) => prev.filter((rp) => rp.id !== id)), 650);
    },
    [ripple, reduce],
  );
  const handlePressOut = useCallback(() => setPressed(false), []);

  let buttonContent: ReactNode;
  if (loading)
    buttonContent = (
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: reduce ? '0deg' : '360deg' }}
        transition={{ type: 'timing', duration: 800, loop: !reduce, repeatReverse: false }}
      >
        <Svg width={16} height={16} viewBox="0 0 16 16">
          <Circle cx={8} cy={8} r={6} stroke={SPINNER_COLOR[v]} strokeOpacity={0.25} strokeWidth={2} fill="none" />
          <Circle
            cx={8}
            cy={8}
            r={6}
            stroke={SPINNER_COLOR[v]}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${Math.PI * 6} ${Math.PI * 12}`}
          />
        </Svg>
      </MotiView>
    );
  else if (typeof children === 'string' || typeof children === 'number')
    buttonContent = <Text className={label({ variant, size })}>{children}</Text>;
  else
    buttonContent = (
      <View className="flex-row items-center justify-center" style={{ gap: 8 }}>
        {Children.map(children, (child) => renderChild(child, label({ variant, size })))}
      </View>
    );

  return (
    <MotiView
      animate={{ scale: pressed && !reduce && !isDisabled ? pressScale : 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.6 }}
      style={style}
    >
      <Pressable
        accessibilityRole="button"
        aria-disabled={Boolean(isDisabled)}
        aria-busy={Boolean(loading)}
        accessibilityLabel={accessibilityLabel}
        testID={testID ?? 'button'}
        disabled={isDisabled}
        onLayout={onLayout}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        className={container({ variant, size })}
        style={{ opacity: isDisabled ? 0.5 : 1, overflow: 'hidden' }}
      >
        {ripple && !reduce
          ? ripples.map((rp) => (
              <MotiView
                key={rp.id}
                from={{ scale: 0, opacity: 0.3 }}
                animate={{ scale: 1, opacity: 0 }}
                transition={{ type: 'timing', duration: 600 }}
                style={{
                  position: 'absolute',
                  left: rp.x - rp.size / 2,
                  top: rp.y - rp.size / 2,
                  width: rp.size,
                  height: rp.size,
                  borderRadius: rp.size / 2,
                  backgroundColor: v === 'primary' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.12)',
                  pointerEvents: 'none',
                }}
              />
            ))
          : null}
        {buttonContent}
      </Pressable>
    </MotiView>
  );
}
