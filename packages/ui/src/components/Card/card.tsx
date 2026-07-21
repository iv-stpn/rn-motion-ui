import { cva, type VariantProps } from 'class-variance-authority';
import type { Ref } from 'react';
import { View, type ViewProps } from 'react-native';

// cva drives the static styling layer — class strings are static literals so
// the Tailwind/uniwind scanner picks them up. Mirrors the Button pattern.
const card = cva('rounded-2xl', {
  variants: {
    size: {
      compact: 'gap-2 p-3',
      md: 'gap-3 p-4',
      lg: 'gap-4 p-6',
    },
    variant: {
      border: 'border border-border',
      // offkeep's `bg-surface-secondary` isn't a token here; `bg-muted` is the
      // repo's subtle-fill idiom (`--color-muted` is ~97%, same as `card`).
      filled: 'bg-muted',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'border',
  },
});

/** Join truthy class strings. (Local helper — this package ships no shared `cn`.) */
function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => typeof part === 'string').join(' ');
}

export type CardSize = NonNullable<VariantProps<typeof card>['size']>;
export type CardVariant = NonNullable<VariantProps<typeof card>['variant']>;
export type CardProps = ViewProps & { size?: CardSize; variant?: CardVariant; ref?: Ref<View> };

export function Card({ size = 'md', variant = 'border', className, ...props }: CardProps) {
  // React 19: ref is a plain prop and passes through via ...props.
  return <View className={cn(card({ size, variant }), className)} {...props} />;
}
