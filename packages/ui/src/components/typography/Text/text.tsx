import { cva, type VariantProps } from 'class-variance-authority';
import { Text as RNText, type TextProps } from 'react-native';
import { cn } from '../../../lib/cn';

// cva drives the static styling layer. Class strings are static literals so the
// Tailwind/uniwind scanner picks them up at build time.
//
// Font family and weight are paired via compound variants so every combination
// resolves to a single per-weight-family class (e.g. `font-sans-bold`). That
// class produces one `font-family` value — critical on native, where fontWeight
// alone cannot select a different .ttf file.
const text = cva('text-foreground', {
  variants: {
    weight: {
      normal: '',
      medium: '',
      semibold: '',
      bold: '',
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
    font: {
      sans: '',
      serif: '',
      mono: '',
    },
  },
  compoundVariants: [
    { font: 'sans', weight: 'normal', class: 'font-sans-normal' },
    { font: 'sans', weight: 'medium', class: 'font-sans-medium' },
    { font: 'sans', weight: 'semibold', class: 'font-sans-semibold' },
    { font: 'sans', weight: 'bold', class: 'font-sans-bold' },
    { font: 'serif', weight: 'normal', class: 'font-serif-normal' },
    { font: 'serif', weight: 'medium', class: 'font-serif-medium' },
    { font: 'serif', weight: 'semibold', class: 'font-serif-semibold' },
    { font: 'serif', weight: 'bold', class: 'font-serif-bold' },
    { font: 'mono', weight: 'normal', class: 'font-mono-normal' },
    { font: 'mono', weight: 'medium', class: 'font-mono-medium' },
    { font: 'mono', weight: 'semibold', class: 'font-mono-semibold' },
    { font: 'mono', weight: 'bold', class: 'font-mono-bold' },
  ],
  defaultVariants: { weight: 'normal', font: 'sans' },
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
 * A themed `Text` component that defaults to `text-foreground`, `font-sans`
 * and `weight-normal`. Exposes `weight` / `size` / `font` props.
 *
 * **Each `font` × `weight` pair resolves to a single per-weight-family token**
 * (e.g. `font-sans-bold` → `--font-sans-bold`). This is needed on native,
 * where `fontWeight` alone cannot select between weight-specific `.ttf` files.
 *
 * Override tokens in your own `@theme` block:
 * ```css
 * @theme {
 *   --font-sans-normal: 'Geist-Regular', ui-sans-serif, system-ui, sans-serif;
 *   --font-sans-bold:   'Geist-Bold',    ui-sans-serif, system-ui, sans-serif;
 * }
 * ```
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
export function Text({ weight, size, numeric, font, className, ...props }: TextProps_) {
  return <RNText className={cn(text({ weight, size, numeric, font }), className)} {...props} />;
}
