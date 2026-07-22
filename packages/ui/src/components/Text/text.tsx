import { cva, type VariantProps } from 'class-variance-authority';
import { Text as RNText, type TextProps } from 'react-native';
import { cn } from '../../lib/cn';

// cva drives the static styling layer. Class strings are static literals so the
// Tailwind/uniwind scanner picks them up at build time.
const text = cva('text-foreground', {
  variants: {
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
    },
    // Tightens tracking and enables tabular figures + the `ss07` stylistic set
    // so columns of digits line up and render with the numeric cut of the font.
    numeric: {
      true: "tracking-tight font-features-['ss07'] tabular-nums",
    },
  },
  defaultVariants: { weight: 'normal' },
});

export interface TextProps_ extends TextProps, VariantProps<typeof text> {
  /**
   * Merged onto the base classes via `cn()` — last-wins for any conflicting
   * utility group. Pass e.g. `className="text-muted-foreground"` to override
   * the default `text-foreground` colour.
   */
  className?: string;
}

/**
 * A themed `Text` component that defaults to `text-foreground` and exposes
 * `weight` / `size` props for the most common typography variants.
 *
 * Override the colour with `className`:
 * ```tsx
 * <Text weight="semibold" size="sm" className="text-muted-foreground">
 *   Subtitle
 * </Text>
 * ```
 *
 * Pass `numeric` for tabular figures (`ss07` stylistic set + tight tracking)
 * so columns of numbers stay aligned:
 * ```tsx
 * <Text numeric size="2xl">$1,234.56</Text>
 * ```
 *
 * All React Native `Text` props are forwarded (style, numberOfLines, …).
 */
export function Text({ weight, size, numeric, className, ...props }: TextProps_) {
  return <RNText className={cn(text({ weight, size, numeric }), className)} {...props} />;
}
