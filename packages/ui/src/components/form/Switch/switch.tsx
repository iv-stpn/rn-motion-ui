// biome-ignore-all lint/style/useComponentExportOnlyModules: switch defines local sub-components
// biome-ignore-all lint/style/useExportsLast: switch defines local sub-components
// biome-ignore-all lint/style/noExcessiveLinesPerFile: switch is a large component with multiple sub-components in one file
import { createContext, type ReactNode, type Ref, useCallback, useContext, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { usePressState } from '../../../hooks/use-press-state';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { useShakeAnimation } from '../../../hooks/use-shake-animation';
import { cn } from '../../../lib/cn';
import { THUMB_SPRING } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { type MotiTransitionProp, mergeTransition, TIMING_INSTANT } from '../../../theme/motion';
import { Text } from '../../typography/Text/text';
import { type SwitchColors, type SwitchThemeColors, type SwitchThemeName, useSwitchColors } from './switch-theme';

// The colour system lives in switch-theme.ts; re-exported here so
// `rn-motion-ui/switch` stays the single import site for the component's types.
export type { SwitchColor, SwitchColors, SwitchThemeColors, SwitchThemeName } from './switch-theme';

// ─── Layout constants ─────────────────────────────────────────────────────────

/** 4-step horizontal shake emitted on a disabled-press (2 px, subtle signal). */
const SWITCH_SHAKE_STEPS = [-2, 2, -1, 0] as const;

/** Available size variants for the switch track. */
export type SwitchSize = 'sm' | 'md' | 'lg';

type SwitchSizeConfig = { trackClass: string; thumbW: number; thumbOffset: number; travel: number; labelClass: string };

/**
 * Per-size track geometry; fills are resolved by `theme`, not here.
 *
 * `travel` is the thumb's slide distance — track width − thumb width − twice the
 * offset (sm: 32 − 20 − 4, md: 48 − 28 − 4, lg: 64 − 38 − 4). The thumb height
 * plus twice the offset likewise fills the track height, so the thumb sits inset
 * by `thumbOffset` on all four sides at every size.
 */
const SWITCH_SIZE_CONFIG: Record<SwitchSize, SwitchSizeConfig> = {
  sm: {
    trackClass: 'h-4 w-8 items-center justify-center rounded-full overflow-hidden',
    thumbW: 20,
    thumbOffset: 2,
    travel: 8,
    labelClass: 'text-xs',
  },
  md: {
    trackClass: 'h-5 w-11 items-center justify-center rounded-full overflow-hidden',
    thumbW: 26,
    thumbOffset: 2,
    travel: 14,
    labelClass: 'text-sm',
  },
  lg: {
    trackClass: 'h-7 w-14 items-center justify-center rounded-full overflow-hidden',
    thumbW: 36,
    thumbOffset: 2,
    travel: 16,
    labelClass: 'text-base',
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

/** Passed to render-function children on Switch and Switch.Thumb. */
export type SwitchRenderProps = { isSelected: boolean; isDisabled: boolean };

/** Props for the sliding thumb sub-component. */
export type SwitchThumbProps = {
  children?: ReactNode | ((props: SwitchRenderProps) => ReactNode);
  /** Additional UniWind class names merged onto the thumb. */
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
  /** Additional UniWind class names merged onto the pressable wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/** Props for the start/end content slot sub-components. */
export type SwitchContentProps = {
  children?: ReactNode;
  /** Additional UniWind class names. */
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export type SwitchProps = {
  isSelected: boolean;
  onSelectedChange: (isSelected: boolean) => void;
  isDisabled?: boolean;
  label?: string;
  /** Additional UniWind class names merged onto the outer row. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  /**
   * Colour theme — the selected track fill, the unselected track fill and the
   * thumb. Pass a built-in name (`'info'` by default), or an object to override
   * individual slots on top of `info`.
   *
   * Each slot takes a semantic token name (so it follows light/dark and consumer
   * `@theme` overrides), a token with a Tailwind-style alpha suffix, or any
   * literal CSS colour.
   *
   * @example theme="success"
   * @example theme={{ track: '#0ea5e9' }}                    // grey off-track + white thumb kept
   * @example theme={{ track: 'accent', trackOff: 'muted', thumb: 'accent-foreground' }}
   */
  theme?: SwitchThemeName | SwitchThemeColors;
  /**
   * Pass-through thumb transition when using the default auto-rendered thumb.
   * When supplying custom children, pass `thumbTransition` to `<Switch.Thumb>` directly.
   */
  thumbTransition?: Partial<MotiTransitionProp>;
  /** Size variant — `'sm'`, `'md'` (default), or `'lg'`. */
  size?: SwitchSize;
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
  /**
   * The active theme's three fills, resolved to concrete sRGB. `Switch.Thumb`
   * paints `thumb`; custom content can read the track fills to match them.
   */
  colors: SwitchColors;
  /** Active size variant — used by `Switch.Thumb` to look up geometry. */
  size: SwitchSize;
  /** The switch's resolved testID. Sub-components derive their own from it. */
  testID: string;
};

const SwitchContext = createContext<SwitchContextValue | null>(null);

/** Access Switch state from within sub-components. Throws outside <Switch>. */
export function useSwitch(): SwitchContextValue {
  const ctx = useContext(SwitchContext);
  if (!ctx) throw new Error('<Switch> sub-components must be rendered inside <Switch>.');
  return ctx;
}

// ─── Switch.Thumb ─────────────────────────────────────────────────────────────

/** Sliding thumb. Spring-animates `translateX` off → on; squishes on press.
 * Auto-rendered by `<Switch>` when no children are provided.
 */
function SwitchThumb({ children, className, style, thumbTransition }: SwitchThumbProps) {
  const { isSelected, isDisabled, pressed, colors, testID, size } = useSwitch();
  const { thumbW, thumbOffset, travel } = SWITCH_SIZE_CONFIG[size];
  const reduce = useReducedMotion();
  const squish = pressed && !isDisabled && !reduce;

  // Reduced motion wins over `thumbTransition`: the thumb cuts to its position
  // instead of springing, as every other animated control in the library does.
  const transition = reduce
    ? TIMING_INSTANT
    : mergeTransition(
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
      animate={{ translateX: isSelected ? travel : 0, scaleX: squish ? 1.15 : 1, scale: squish ? 0.92 : 1 }}
      transition={transition}
      testID={`${testID}-thumb`}
      className={cn('items-center justify-center', className)}
      style={[
        {
          position: 'absolute',
          top: thumbOffset,
          bottom: thumbOffset,
          left: thumbOffset,
          width: thumbW,
          borderRadius: 9999,
          overflow: 'hidden',
          backgroundColor: colors.thumb,
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
      className={cn('flex-row items-center', isDisabled ? 'opacity-60' : 'opacity-100', className)}
      style={style}
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
  theme = 'info',
  thumbTransition,
  size = 'md',
  children,
  ref,
}: SwitchProps & { ref?: Ref<View> }) {
  const reduce = useReducedMotion();
  const { pressed, pressHandlers } = usePressState();
  const shakeX = useRef(new Animated.Value(0)).current;
  const { track, trackOff, thumb } = useSwitchColors(theme);
  const { trackClass, labelClass } = SWITCH_SIZE_CONFIG[size];
  const resolvedTestID = testID ?? 'switch';

  // Disabled + pressed → short horizontal shake to signal "can't toggle".
  useShakeAnimation({ trigger: Boolean(isDisabled && pressed), reduce, shakeX, steps: SWITCH_SHAKE_STEPS, duration: 60 });

  const handleToggle = useCallback(() => {
    if (!isDisabled) onSelectedChange(!isSelected);
  }, [isDisabled, onSelectedChange, isSelected]);

  // Depends on the three resolved strings rather than the object they came in
  // as, so a `theme` passed as an inline literal doesn't invalidate every render.
  const contextValue = useMemo(
    () => ({
      isSelected,
      isDisabled: isDisabled ?? false,
      pressed,
      onToggle: handleToggle,
      colors: { track, trackOff, thumb },
      size,
      testID: resolvedTestID,
    }),
    [isSelected, isDisabled, pressed, handleToggle, track, trackOff, thumb, size, resolvedTestID],
  );

  const renderProps: SwitchRenderProps = { isSelected, isDisabled: isDisabled ?? false };
  const content =
    typeof children === 'function' ? children(renderProps) : (children ?? <SwitchThumb thumbTransition={thumbTransition} />);

  return (
    <SwitchContext.Provider value={contextValue}>
      <View ref={ref} className={cn('flex-row items-center gap-2', className)} style={style}>
        <Pressable
          accessibilityRole="switch"
          aria-checked={isSelected}
          aria-disabled={Boolean(isDisabled)}
          accessibilityLabel={accessibilityLabel ?? label}
          testID={resolvedTestID}
          disabled={isDisabled}
          {...pressHandlers}
          onPress={handleToggle}
        >
          <Animated.View
            className={trackClass}
            testID={`${resolvedTestID}-track`}
            style={{
              backgroundColor: isSelected ? track : trackOff,
              opacity: isDisabled ? 0.6 : 1,
              transform: [{ translateX: shakeX }],
            }}
          >
            {content}
          </Animated.View>
        </Pressable>
        {label ? (
          <SwitchLabel>
            <Text className={cn('select-none text-foreground', labelClass)}>{label}</Text>
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
 * When no `children` are provided, `<Switch.Thumb>` is rendered automatically.
 *
 * Colours come from the `theme` prop: `info` by default — an `info` track when
 * selected, a grey track when not, and a white thumb throughout.
 *
 * @example Basic
 * ```tsx
 * <Switch isSelected={on} onSelectedChange={setOn} label="Enable notifications" />
 * ```
 *
 * @example Themed
 * ```tsx
 * <Switch isSelected={on} onSelectedChange={setOn} theme="success" />
 * <Switch isSelected={on} onSelectedChange={setOn} theme={{ track: '#0ea5e9', thumb: 'white' }} />
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
