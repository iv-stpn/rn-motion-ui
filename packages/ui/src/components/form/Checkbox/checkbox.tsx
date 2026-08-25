import { type ReactNode, useCallback } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { usePressState } from '../../../hooks/use-press-state';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { SPRING_PRESS } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { type MotiTransitionProp, mergeTransition, TIMING_FAST, TIMING_INSTANT } from '../../../theme/motion';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Text } from '../../typography/Text/text';

/**
 * Checkmark and indeterminate-dash glyphs, drawn in a 32×32 viewBox rendered at
 * 16×16 (0.5× scale) so placement has half-pixel granularity. Both glyphs are
 * nudged right one half-unit (half a pixel) to sit optically centred — the check
 * because its vertex sits left of its stroke bbox, the dash to match the check's
 * resting centre. All coordinates stay whole numbers and the SVG stays a fixed
 * 16×16, so flex centring adds no sub-pixel offset.
 */
const GLYPH_VIEWBOX = '0 0 32 32';
const CHECK_PATH = 'M7 14L15 22L27 10';
const INDETERMINATE_PATH = 'M7 16H27';

/**
 * Checked border class per tone. A static map (not a `border-${tone}` template
 * literal) so UniWind can statically resolve every member at build time.
 */
const BOX_TONE_BORDER: Record<CheckboxTone, string> = {
  primary: 'border-primary',
  secondary: 'border-secondary',
  accent: 'border-accent',
  success: 'border-success',
  warning: 'border-warning',
  info: 'border-info',
  danger: 'border-danger',
  special: 'border-special',
};

/** Filled accent tokens — each has a matching `-foreground` for the mark. */
export type CheckboxTone = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'info' | 'danger' | 'special';

export type CheckboxBoxProps = {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  /** Whether the surrounding control is pressed — drives the box squish. */
  pressed?: boolean;
  /** Accent token for the fill, border and mark. Defaults to `primary`. */
  tone?: CheckboxTone;
  /** Resolved check animation (already merged with any override). */
  transition?: MotiTransitionProp;
  checkIcon?: ReactNode;
  /** The box and mark derive `-control` / `-check` from this. */
  testID?: string;
};

/**
 * The animated box + check/dash mark. Split out so `Checkbox` and `CheckboxCard`
 * share one implementation: `Checkbox` wraps it in a Pressable, while
 * `CheckboxCard` renders it directly because the whole card is the checkbox.
 */
export function CheckboxBox({
  checked,
  indeterminate,
  disabled,
  pressed = false,
  tone = 'primary',
  transition,
  checkIcon,
  testID,
}: CheckboxBoxProps) {
  const reduce = useReducedMotion();
  // Resolve the accent and its mark colour through the token bridge so they
  // adapt to consumer @theme overrides.
  const accent = useThemeColor(tone);
  const checkColor = useThemeColor(`${tone}-foreground`);
  const surfaceColor = useThemeColor('surface-3');
  const showMark = checked || Boolean(indeterminate);
  const path = indeterminate ? INDETERMINATE_PATH : CHECK_PATH;
  const ct = reduce ? TIMING_INSTANT : (transition ?? TIMING_FAST);

  return (
    // The box is the surface: it springs down while pressed and cross-fades its
    // own background between the surface and accent fills. Animating the box
    // (rather than an absolutely-positioned fill overlay) keeps the selected
    // background inside the border, so it never needs to overlap the border.
    // `relative` makes the box the containing block for the absolutely-positioned
    // mark below, so its `inset-0` stays anchored here on web (native already
    // anchors absolute children to their parent).
    <MotiView
      animate={{
        scale: pressed && !reduce && !disabled ? 0.92 : 1,
        backgroundColor: showMark ? accent : surfaceColor,
      }}
      transition={{ scale: SPRING_PRESS, backgroundColor: ct }}
      testID={testID ? `${testID}-control` : undefined}
      className={cn(
        'relative h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border-[1.5px]',
        showMark && !disabled ? BOX_TONE_BORDER[tone] : 'border-muted-foreground/50',
      )}
    >
      {/* The check/dash cross-fade in place: the mark is absolutely positioned
          so the outgoing and incoming icons overlap during the swap instead of
          stacking as flex siblings. */}
      <AnimatePresence>
        {showMark ? (
          <MotiView
            key={indeterminate ? 'indeterminate' : 'checked'}
            from={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
            transition={ct}
            testID={testID ? `${testID}-check` : undefined}
            className="absolute inset-0 items-center justify-center"
          >
            {checkIcon ?? (
              <Svg width={16} height={16} viewBox={GLYPH_VIEWBOX}>
                <Path d={path} fill="none" stroke={checkColor} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </MotiView>
        ) : null}
      </AnimatePresence>
    </MotiView>
  );
}

export type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  label?: string;
  /** Accent token for the box fill, border and mark. Defaults to `primary`. */
  tone?: CheckboxTone;
  /** Additional UniWind class names merged onto the outer row. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  /**
   * Override the check-mark animation. Partial — only the fields you pass are changed.
   * Default: `TIMING_FAST` (150 ms timing).
   */
  checkTransition?: Partial<MotiTransitionProp>;
  /** Replace the check-mark icon. Default: `<Svg width={12} height={12}><Path d={checkPath} .../></Svg>`. */
  checkIcon?: ReactNode;
};

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  indeterminate,
  label,
  tone = 'primary',
  className,
  style,
  accessibilityLabel,
  testID,
  checkTransition,
  checkIcon,
}: CheckboxProps) {
  const { pressed, pressHandlers } = usePressState();
  const ct = mergeTransition(TIMING_FAST, checkTransition);

  const handlePress = useCallback(() => {
    if (!disabled) onCheckedChange(!checked);
  }, [disabled, onCheckedChange, checked]);

  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-disabled={Boolean(disabled)}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID ?? 'checkbox'}
      disabled={disabled}
      {...pressHandlers}
      onPress={handlePress}
      className={cn('flex-row items-center', className)}
      style={[{ gap: 12, opacity: disabled ? 0.6 : 1 }, style]}
    >
      <CheckboxBox
        checked={checked}
        indeterminate={indeterminate}
        disabled={disabled}
        pressed={pressed}
        tone={tone}
        transition={ct}
        checkIcon={checkIcon}
        testID={testID}
      />
      {label ? <Text className="select-none text-foreground text-sm">{label}</Text> : null}
    </Pressable>
  );
}
