// biome-ignore-all lint/style/useComponentExportOnlyModules: switch defines local sub-components
// biome-ignore-all lint/style/useExportsLast: switch defines local sub-components
import { cva } from 'class-variance-authority';
import { createContext, type ReactNode, type Ref, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { useShakeAnimation } from '../../hooks/use-shake-animation';
import { cn } from '../../lib/cn';
import { THUMB_SPRING } from '../../lib/ease';
import { MotiView } from '../../moti/components/view';
import { type MotiTransitionProp, mergeTransition } from '../../theme/motion';
import { useThemeColor } from '../../theme/use-theme-color';
import { Text } from '../Text/text';

// ─── Layout constants ─────────────────────────────────────────────────────────

/**
 * Thumb travel: track (48) − left-offset (2) − thumb-width (28) − right-offset (2).
 * Matches heroui-native's absolute-position approach (off: left 2px, on: left 18px).
 */
const TRAVEL = 16;

/** 4-step horizontal shake emitted on a disabled-press (2 px, subtle signal). */
const SWITCH_SHAKE_STEPS = [-2, 2, -1, 0] as const;

// ─── Track CVA ────────────────────────────────────────────────────────────────

// Track colour swaps on selection; thumb/content are all absolute inside it.
const track = cva('h-6 w-12 items-center justify-center rounded-full overflow-hidden', {
  variants: {
    isSelected: { true: 'bg-primary', false: 'bg-muted-foreground/60' },
  },
  defaultVariants: { isSelected: false },
});

// ─── Types ────────────────────────────────────────────────────────────────────

/** Passed to render-function children on Switch and Switch.Thumb. */
export type SwitchRenderProps = { isSelected: boolean; isDisabled: boolean };

/** Props for the sliding thumb sub-component. */
export type SwitchThumbProps = {
  children?: ReactNode | ((props: SwitchRenderProps) => ReactNode);
  /** Additional NativeWind class names merged onto the thumb. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Override the thumb slide spring. Partial — only the fields you pass are changed.
   * Default: `THUMB_SPRING` (stiffness 800, damping 80, mass 4).
   */
  thumbTransition?: Partial<MotiTransitionProp>;
};

/** Props for the label container sub-component. */
export type SwitchLabelProps = {
  children?: ReactNode;
  /** Additional NativeWind class names merged onto the pressable wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/** Props for the start/end content slot sub-components. */
export type SwitchContentProps = {
  children?: ReactNode;
  /** Additional NativeWind class names. */
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export type SwitchProps = {
  isSelected: boolean;
  onSelectedChange: (isSelected: boolean) => void;
  isDisabled?: boolean;
  label?: string;
  /** Additional NativeWind class names merged onto the outer row. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  /**
   * Pass-through thumb transition when using the default auto-rendered thumb.
   * When supplying custom children, pass `thumbTransition` to `<Switch.Thumb>` directly.
   */
  thumbTransition?: Partial<MotiTransitionProp>;
  /**
   * Custom children. Pass a render function to receive `{ isSelected, isDisabled }`,
   * or pass React elements. When omitted, a default `<Switch.Thumb />` is rendered.
   */
  children?: ReactNode | ((props: SwitchRenderProps) => ReactNode);
};

// ─── Context ─────────────────────────────────────────────────────────────────

type SwitchContextValue = {
  isSelected: boolean;
  isDisabled: boolean;
  /** True while the track is pressed — drives the squish in Switch.Thumb. */
  pressed: boolean;
  /** Toggles the switch; no-op when disabled. Used by Switch.Label. */
  onToggle: () => void;
};

const SwitchContext = createContext<SwitchContextValue | null>(null);

/** Access Switch state from within sub-components. Throws outside <Switch>. */
export function useSwitch(): SwitchContextValue {
  const ctx = useContext(SwitchContext);
  if (!ctx) throw new Error('<Switch> sub-components must be rendered inside <Switch>.');
  return ctx;
}

// ─── Switch.Thumb ─────────────────────────────────────────────────────────────

/**
 * Sliding thumb inside the switch track. Spring-animates `translateX` between
 * off (0) and on (20 px) positions, and squishes lightly while the track is
 * pressed. Auto-rendered by `<Switch>` when no children are provided.
 */
function SwitchThumb({ children, className, style, thumbTransition }: SwitchThumbProps) {
  const { isSelected, isDisabled, pressed } = useSwitch();
  const reduce = useReducedMotion();
  const thumbBg = useThemeColor('surface-3');
  const squish = pressed && !isDisabled && !reduce;

  const transition = mergeTransition(
    {
      type: 'spring' as const,
      stiffness: THUMB_SPRING.stiffness,
      damping: THUMB_SPRING.damping,
      mass: THUMB_SPRING.mass,
    },
    thumbTransition,
  );

  const renderProps: SwitchRenderProps = { isSelected, isDisabled };
  const content = typeof children === 'function' ? children(renderProps) : children;

  return (
    <MotiView
      animate={{ translateX: isSelected ? TRAVEL : 0, scaleX: squish ? 1.15 : 1, scale: squish ? 0.92 : 1 }}
      transition={transition}
      className={cn('items-center justify-center', className)}
      style={[
        {
          // heroui: position absolute, 28×20 pill at left: 2px / top: 2px
          position: 'absolute',
          top: 2,
          left: 2,
          width: 28,
          height: 20,
          borderRadius: 9999,
          overflow: 'hidden',
          backgroundColor: thumbBg,
          elevation: 3,
          ...Platform.select({
            default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
            web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.20)' },
          }),
        },
        style,
      ]}
    >
      {content}
    </MotiView>
  );
}

// ─── Switch.StartContent / Switch.EndContent ─────────────────────────────────

/**
 * Absolutely-positioned slot on the left (start) side of the track.
 * Typically holds an icon visible when the switch is off.
 */
function SwitchStartContent({ children, className, style, ref, ...rest }: SwitchContentProps & { ref?: Ref<View> }) {
  return (
    <View ref={ref} className={cn('absolute left-0.5 items-center justify-center', className)} style={style} {...rest}>
      {children}
    </View>
  );
}

/**
 * Absolutely-positioned slot on the right (end) side of the track.
 * Typically holds an icon visible when the switch is on.
 */
function SwitchEndContent({ children, className, style, ref, ...rest }: SwitchContentProps & { ref?: Ref<View> }) {
  return (
    <View ref={ref} className={cn('absolute right-0.5 items-center justify-center', className)} style={style} {...rest}>
      {children}
    </View>
  );
}

// ─── Switch.Label ─────────────────────────────────────────────────────────────

/**
 * Pressable label container rendered next to the track. Tapping anywhere
 * inside it toggles the switch — same behaviour as clicking an HTML `<label>`
 * associated with a checkbox. Disabled when the switch is disabled.
 *
 * The string `label` prop on `<Switch>` auto-renders this component; use
 * `<Switch.Label>` directly when you need custom content or extra styling.
 */
const SwitchLabel = ({ children, className, style }: SwitchLabelProps) => {
  const { onToggle, isDisabled } = useSwitch();
  return (
    <Pressable
      onPress={onToggle}
      disabled={isDisabled}
      className={cn('flex-row items-center', className)}
      style={[{ opacity: isDisabled ? 0.6 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
};

// ─── Switch (root) ────────────────────────────────────────────────────────────

function SwitchRoot({
  isSelected,
  onSelectedChange,
  isDisabled,
  label,
  className,
  style,
  accessibilityLabel,
  testID,
  thumbTransition,
  children,
  ref,
}: SwitchProps & { ref?: Ref<View> }) {
  const reduce = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const shakeX = useRef(new Animated.Value(0)).current;

  // Disabled + pressed → short horizontal shake to signal "can't toggle".
  useShakeAnimation({ trigger: Boolean(isDisabled && pressed), reduce, shakeX, steps: SWITCH_SHAKE_STEPS, duration: 60 });

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);
  const handleToggle = useCallback(() => {
    if (!isDisabled) onSelectedChange(!isSelected);
  }, [isDisabled, onSelectedChange, isSelected]);

  const contextValue = useMemo(
    () => ({ isSelected, isDisabled: isDisabled ?? false, pressed, onToggle: handleToggle }),
    [isSelected, isDisabled, pressed, handleToggle],
  );

  const renderProps: SwitchRenderProps = { isSelected, isDisabled: isDisabled ?? false };
  const content =
    typeof children === 'function' ? children(renderProps) : (children ?? <SwitchThumb thumbTransition={thumbTransition} />);

  return (
    <SwitchContext.Provider value={contextValue}>
      <View ref={ref} className={cn('flex-row items-center', className)} style={[{ gap: 12 }, style]}>
        <Pressable
          accessibilityRole="switch"
          aria-checked={isSelected}
          aria-disabled={Boolean(isDisabled)}
          accessibilityLabel={accessibilityLabel ?? label}
          testID={testID ?? 'switch'}
          disabled={isDisabled}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handleToggle}
        >
          <Animated.View
            className={track({ isSelected })}
            style={{ opacity: isDisabled ? 0.6 : 1, transform: [{ translateX: shakeX }] }}
          >
            {content}
          </Animated.View>
        </Pressable>
        {label ? (
          <SwitchLabel>
            <Text className="select-none text-foreground text-sm">{label}</Text>
          </SwitchLabel>
        ) : null}
      </View>
    </SwitchContext.Provider>
  );
}

// ─── Display names ────────────────────────────────────────────────────────────

SwitchRoot.displayName = 'Switch';
SwitchThumb.displayName = 'Switch.Thumb';
SwitchLabel.displayName = 'Switch.Label';
SwitchStartContent.displayName = 'Switch.StartContent';
SwitchEndContent.displayName = 'Switch.EndContent';

// ─── Compound export ──────────────────────────────────────────────────────────

/**
 * Toggle with a sliding thumb and optional content slots.
 *
 * Props use heroui-native naming: `isSelected` / `onSelectedChange` / `isDisabled`.
 * When no `children` are provided, `<Switch.Thumb>` is rendered automatically.
 *
 * @example Basic
 * ```tsx
 * <Switch isSelected={on} onSelectedChange={setOn} label="Enable notifications" />
 * ```
 *
 * @example Custom thumb + icon slots
 * ```tsx
 * <Switch isSelected={on} onSelectedChange={setOn}>
 *   <Switch.StartContent><MoonIcon /></Switch.StartContent>
 *   <Switch.Thumb />
 *   <Switch.EndContent><SunIcon /></Switch.EndContent>
 * </Switch>
 * ```
 */
export const Switch = Object.assign(SwitchRoot, {
  /** Sliding thumb. Spring-animated; squishes lightly on press. */
  Thumb: SwitchThumb,
  /** Pressable label container — tapping it toggles the switch. */
  Label: SwitchLabel,
  /** Left-side icon slot (absolute-positioned inside the track). */
  StartContent: SwitchStartContent,
  /** Right-side icon slot (absolute-positioned inside the track). */
  EndContent: SwitchEndContent,
});
