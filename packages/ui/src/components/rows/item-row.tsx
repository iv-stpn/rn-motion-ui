// biome-ignore-all lint/style/useExportsLast lint/style/useComponentExportOnlyModules: shared types, constants, helpers, and RowLayout are co-located with the components that consume them

import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '../../lib/cn';
import type { ThemeToken } from '../../theme/use-theme-color';
import { ThemedIcon } from '../icon/themed-icon';
import { Text } from '../typography/Text/text';
import type { MenuItemIcon } from './menu-item';

export type { MenuItemIcon } from './menu-item';

export type ItemRowSize = 'sm' | 'md' | 'lg';

/** Visual flavour of the row surface. */
export type ItemRowVariant = 'default' | 'outline' | 'muted';

/**
 * Left or right adornment — either a themed icon object (wrapped in
 * `ThemedIcon`) or any ReactNode rendered as-is.
 *
 * When an icon object is provided, `iconColor` overrides the default token
 * and `iconBackgroundColor` places a rounded-square background behind the
 * icon tinted to the given token.
 */
export type ItemRowAdornment =
  | {
      icon: MenuItemIcon;
      /** Override the default icon colour token. @example 'primary' */
      iconColor?: ThemeToken;
      /** When set, renders a rounded-square background behind the icon. @example 'primary' */
      iconBackgroundColor?: ThemeToken;
    }
  | ReactNode;

/**
 * Per-size dimensions — horizontal padding reuses the interactive-surface token
 * ramp, while the vertical padding is explicit because a two-line row is taller
 * than the single-line button heights.
 */
export const SIZE_SCALE: Record<
  ItemRowSize,
  { rowClass: string; iconSize: number; titleClass: string; descClass: string; textGap: string }
> = {
  sm: {
    rowClass: 'gap-1.5 px-interactive-pad-sm py-1.5',
    iconSize: 16,
    titleClass: 'text-xs',
    descClass: 'text-[11px]',
    textGap: 'gap-0.5',
  },
  md: {
    rowClass: 'gap-2 px-interactive-pad-md py-2',
    iconSize: 20,
    titleClass: 'text-sm',
    descClass: 'text-xs',
    textGap: 'gap-0.5',
  },
  lg: {
    rowClass: 'gap-2.5 px-interactive-pad-lg py-2.5',
    iconSize: 24,
    titleClass: 'text-base',
    descClass: 'text-sm',
    textGap: 'gap-1',
  },
};

/** Base surface per variant — hover/press overlays are composed on top. */
export const VARIANT_CLASSES: Record<ItemRowVariant, string> = {
  default: 'bg-transparent rounded-interactive',
  outline: 'border-[1.5px] border-border rounded-interactive',
  muted: 'bg-surface-contrast rounded-interactive',
};

/**
 * Narrow a slot value to an icon object. Checks for an own, callable `icon`
 * member — a ReactNode that isn't an icon object has none.
 */
function isIconAdornment(a: unknown): a is { icon: MenuItemIcon } {
  if (a === null || typeof a !== 'object') return false;
  const icon = Object.getOwnPropertyDescriptor(a, 'icon')?.value;
  return typeof icon === 'function';
}

/** Render one adornment slot — themed icon for `{ icon }`, pass-through for a node. */
function renderAdornment(a: ItemRowAdornment | undefined, token: ThemeToken, size: number, containerClass?: string) {
  if (a === undefined || a === null) return null;
  if (isIconAdornment(a)) {
    const resolvedToken = a.iconColor ?? token;
    const icon = <ThemedIcon icon={a.icon} token={resolvedToken} size={size} />;
    if (a.iconBackgroundColor) {
      const bgSize = size + 14;
      return (
        <View
          className={cn('items-center justify-center rounded-full', containerClass)}
          style={{
            width: bgSize,
            height: bgSize,
            backgroundColor: `var(--color-${a.iconBackgroundColor})`,
          }}
        >
          {icon}
        </View>
      );
    }
    return containerClass ? <View className={containerClass}>{icon}</View> : icon;
  }
  return containerClass ? <View className={containerClass}>{a}</View> : a;
}

// ---------------------------------------------------------------------------
// RowLayout — shared inner content rendered by both ItemRow and ActionRow
// ---------------------------------------------------------------------------

export type RowLayoutProps = {
  /** Row title — primary text, `weight="medium"` foreground. */
  title: ReactNode;
  /** Optional secondary text, rendered below the title in a muted colour. */
  description?: ReactNode;
  /**
   * Leading adornment. When `{ icon: ... }`, the icon is wrapped in a
   * `ThemedIcon` tinted `muted-foreground`; any other ReactNode renders as-is.
   */
  leftAdornment?: ItemRowAdornment;
  /**
   * Trailing adornment. When `{ icon: ... }`, the icon is wrapped in a
   * `ThemedIcon` tinted `muted-foreground`; any other ReactNode renders as-is.
   */
  rightAdornment?: ItemRowAdornment;
  /** Row size — controls icon dimensions and the type ramp. */
  size: ItemRowSize;
  /** Optional additional classes on the text column. */
  className?: string;
};

/**
 * Internal shared layout: left adornment, title + optional description, and
 * right adornment. Exported so that {@link ActionRow} can compose it inside a
 * `Pressable` without duplicating the markup.
 */
export function RowLayout({ title, description, leftAdornment, rightAdornment, size, className }: RowLayoutProps) {
  const scale = SIZE_SCALE[size];

  return (
    <>
      {/* Left adornment — pinned to the top so it lines up with the title's first line */}
      {renderAdornment(leftAdornment, 'muted-foreground', scale.iconSize, 'self-start')}

      {/* Title + description column */}
      <View className={cn('flex-1', scale.textGap, className)}>
        <Text numberOfLines={1} weight="medium" className={cn(scale.titleClass, 'text-foreground')}>
          {title}
        </Text>
        {description ? (
          <Text numberOfLines={2} className={cn(scale.descClass, 'text-muted-foreground')}>
            {description}
          </Text>
        ) : null}
      </View>

      {/* Right adornment */}
      {renderAdornment(rightAdornment, 'muted-foreground', scale.iconSize)}
    </>
  );
}

// ---------------------------------------------------------------------------
// ItemRow — static display row (no onPress, no Pressable, no overlays)
// ---------------------------------------------------------------------------

export type ItemRowProps = {
  /** Row title — primary text, `weight="medium"` foreground. */
  title: ReactNode;
  /** Optional secondary text, rendered below the title in a muted colour. */
  description?: ReactNode;
  /**
   * Leading adornment. When `{ icon: ... }`, the icon is wrapped in a
   * `ThemedIcon` tinted `muted-foreground`; any other ReactNode renders as-is.
   */
  leftAdornment?: ItemRowAdornment;
  /**
   * Trailing adornment. When `{ icon: ... }`, the icon is wrapped in a
   * `ThemedIcon` tinted `muted-foreground`; any other ReactNode renders as-is.
   * This is the primary extension point for ItemRow — use it to place a
   * Button, Switch, or other control on the right side of the row.
   */
  rightAdornment?: ItemRowAdornment;
  /**
   * Row size — controls padding, icon dimensions, and the type ramp.
   * @default 'md'
   */
  size?: ItemRowSize;
  /** Visual flavour of the row surface. @default 'default' */
  variant?: ItemRowVariant;
  /** Dims the row visually when true. @default false */
  disabled?: boolean;
  /** Additional Tailwind classes on the row container. */
  className?: string;
  /** Forwarded to the root View. */
  style?: ViewProps['style'];
  /** Test identifier. */
  testID?: string;
};

/**
 * A two-line static display row: leading adornment, title + optional
 * description, and a trailing adornment. Part of the interactive-surface
 * family, so sizing follows the same `'sm' | 'md' | 'lg'` ramp as
 * {@link MenuItem}, {@link ActionRow}, and {@link CloseButton}.
 *
 * `ItemRow` is **not** pressable — it renders a plain `View`. For a row
 * where the entire surface is the action (with hover/press overlays and a
 * default chevron), use {@link ActionRow}.
 *
 * Adornments are either an icon object (`{ icon }`, wrapped in `ThemedIcon`)
 * or an arbitrary ReactNode passed through untouched.
 *
 * @example
 * // Row with a trailing button:
 * <ItemRow
 *   title="Storage"
 *   description="512 GB of 1 TB used"
 *   leftAdornment={{ icon: HardDrive }}
 *   rightAdornment={<Button size="sm" variant="inverse">Manage</Button>}
 * />
 *
 * @example
 * // Row with a trailing switch:
 * <ItemRow
 *   title="Airplane mode"
 *   leftAdornment={{ icon: Plane }}
 *   rightAdornment={<Switch isSelected={on} onSelectedChange={setOn} />}
 * />
 */
export function ItemRow({
  title,
  description,
  leftAdornment,
  rightAdornment,
  size = 'md',
  variant = 'default',
  disabled = false,
  className,
  style,
  testID,
}: ItemRowProps) {
  const scale = SIZE_SCALE[size];

  return (
    <View
      testID={testID}
      style={style}
      className={cn('flex-row items-center', VARIANT_CLASSES[variant], scale.rowClass, disabled && 'opacity-40', className)}
    >
      <RowLayout
        title={title}
        description={description}
        leftAdornment={leftAdornment}
        rightAdornment={rightAdornment}
        size={size}
      />
    </View>
  );
}
