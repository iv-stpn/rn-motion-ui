import { MotiView } from 'moti';
import type { ReactNode } from 'react';
import { type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useInView } from '../../hooks/use-in-view';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

export type TextRevealSplit = 'word' | 'char';

export interface TextRevealProps {
  /** A single line, or an array rendered as stacked lines. */
  text: string | string[];
  /**
   * Web accepted any element tag for heading semantics. On RN there is no DOM
   * element; passing an `h1`–`h6` string maps to an accessibility header role.
   */
  as?: string;
  /** Text styling for each revealed unit (size/color/weight). */
  className?: string;
  /** Reveal per word or per character. */
  split?: TextRevealSplit;
  /** Seconds between successive units. */
  stagger?: number;
  /** Seconds before the first unit animates. */
  delay?: number;
  /**
   * Vertical travel of each unit, in px. Web used a `%` of the line height and
   * a blur filter; RN has no text blur, so blur is dropped and the offset is
   * expressed in px (documented fallback).
   */
  yOffset?: number;
  spring?: { stiffness?: number; damping?: number; mass?: number };
  once?: boolean;
  /** Only animate once the element has entered the viewport. */
  whileInView?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

const DEFAULT_SPRING = { stiffness: 140, damping: 26, mass: 1.2 };

export function TextReveal({
  text,
  as,
  className,
  split = 'word',
  stagger = 0.09,
  delay = 0,
  yOffset = 24,
  spring,
  once = true,
  whileInView = false,
  children,
  style,
  accessibilityLabel,
  testID,
}: TextRevealProps) {
  const [ref, inView] = useInView({ once, amount: 0.4 });
  const reduce = useReducedMotion();
  const shouldAnimate = whileInView ? inView : true;

  const lines = Array.isArray(text) ? text : [text];
  const s = { ...DEFAULT_SPRING, ...spring };
  const isHeader = typeof as === 'string' && /^h[1-6]$/.test(as);
  const label = accessibilityLabel ?? lines.join(' ');

  // Global unit counter so the stagger runs continuously across every line.
  let unitIndex = 0;

  return (
    <View
      ref={ref}
      testID={testID}
      accessibilityRole={isHeader ? 'header' : 'text'}
      accessibilityLabel={label}
      style={style}
    >
      {lines.map((line, lineIdx) => {
        const units = split === 'word' ? line.split(' ') : Array.from(line);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional and derived from a static string; order never changes
          <View key={`line-${lineIdx}-${line}`} style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {units.map((unit, i) => {
              const d = (delay + unitIndex * stagger) * 1000;
              unitIndex += 1;
              const withSpace = split === 'word' && i < units.length - 1 ? `${unit} ` : unit;
              return (
                <MotiView
                  // biome-ignore lint/suspicious/noArrayIndexKey: units are positional slots within a line; order never changes
                  key={`unit-${i}-${unit}`}
                  from={reduce ? { opacity: 0 } : { opacity: 0, translateY: yOffset }}
                  animate={
                    shouldAnimate
                      ? reduce
                        ? { opacity: 1 }
                        : { opacity: 1, translateY: 0 }
                      : reduce
                        ? { opacity: 0 }
                        : { opacity: 0, translateY: yOffset }
                  }
                  transition={
                    reduce
                      ? { type: 'timing', duration: 250, delay: d * 0.3 }
                      : { type: 'spring', stiffness: s.stiffness, damping: s.damping, mass: s.mass, delay: d }
                  }
                >
                  <Text className={className}>{withSpace}</Text>
                </MotiView>
              );
            })}
          </View>
        );
      })}
      {children}
    </View>
  );
}
