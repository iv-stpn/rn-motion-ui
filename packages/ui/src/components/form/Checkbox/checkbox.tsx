import { type ReactNode, useCallback } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
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

const CHECK_PATH = 'M5 13l4 4L19 7';
const INDETERMINATE_PATH = 'M6 12h12';

/**
 * Fill overlap over the box border. An explicit negative 0.5px inset (not the
 * `-inset-0.5` class) so the fill provably draws over the border on every
 * platform: the inline style cannot be dropped by the class resolver, which
 * leaves the border's antialiased inner edge showing as a hairline between
 * the border and the selected background when the fill sits exactly at the
 * border's inner edge. `overflow-hidden` on the box clips the overlap.
 */
const CHECKED_FILL_STYLE: ViewStyle = {
  position: 'absolute',
  top: -0.5,
  right: -0.5,
  bottom: -0.5,
  left: -0.5,
};

export type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  label?: string;
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
  className,
  style,
  accessibilityLabel,
  testID,
  checkTransition,
  checkIcon,
}: CheckboxProps) {
  const reduce = useReducedMotion();
  const { pressed, pressHandlers } = usePressState();
  // Resolve the check/indeterminate mark colour through the token bridge so it
  // adapts to consumer @theme overrides (e.g. a non-black primary).
  const checkColor = useThemeColor('primary-foreground');
  const showMark = checked || Boolean(indeterminate);
  const path = indeterminate ? INDETERMINATE_PATH : CHECK_PATH;
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
      {/* Tap feedback: the box springs down while pressed (Button's idiom). */}
      <MotiView animate={{ scale: pressed && !reduce && !disabled ? 0.92 : 1 }} transition={SPRING_PRESS}>
        {/* Base box is always in the unchecked state; the primary fill animates in/out. */}
        <View
          className={cn(
            'h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 bg-surface-3',
            showMark ? 'border-primary' : 'border-muted-foreground/50',
          )}
        >
          {/* Fill fades in on check and out on uncheck, same timing as the mark.
              `CHECKED_FILL_STYLE` pushes the fill 0.5px over the border as an
              explicit inline style (not the `-inset-0.5` class) so it provably
              draws over the border on every platform — a class that fails to
              resolve leaves the border's antialiased inner edge visible as a
              hairline between the border and the fill. The parent's
              `overflow-hidden rounded-md` clips it to the exact box shape. */}
          <MotiView
            animate={{ opacity: showMark ? 1 : 0 }}
            transition={reduce ? TIMING_INSTANT : ct}
            className="bg-primary"
            style={CHECKED_FILL_STYLE}
          />
          <AnimatePresence>
            {showMark ? (
              <MotiView
                key={indeterminate ? 'indeterminate' : 'checked'}
                from={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                transition={reduce ? TIMING_INSTANT : ct}
              >
                {checkIcon ?? (
                  <Svg width={12} height={12} viewBox="0 0 24 24">
                    <Path d={path} fill="none" stroke={checkColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </MotiView>
            ) : null}
          </AnimatePresence>
        </View>
      </MotiView>
      {label ? <Text className="select-none text-foreground text-sm">{label}</Text> : null}
    </Pressable>
  );
}
