// biome-ignore-all lint/style/useExportsLast: MenuItem defines inline subcomponents
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { usePressState } from '../../hooks/use-press-state';
import { cn } from '../../lib/cn';
import { SPRING_LAYOUT } from '../../lib/ease';
import { MotiView } from '../../moti/components/view';
import { ThemedIcon } from '../icon/themed-icon';
import { Text, type TextWeight } from '../typography/Text/text';

/** Icon renderer — compatible with this project's icon set signature. */
export type MenuItemIcon = (props: IconProps) => ReactNode;

export type MenuItemSize = 'sm' | 'md' | 'lg';

/**
 * Visual mode for the default (non-icon-bg) variant.
 * - `'menu'`    — text is always foreground, normal weight (CommandPalette style).
 * - `'sidebar'` — medium weight; non-active text and icon use a muted colour.
 */
export type MenuItemMode = 'menu' | 'sidebar';

/**
 * The surface a menu row is drawn for.
 * - `'base'` — the CommandPalette style: icon leading, no borders between rows.
 * - `'segmented'` — the hold-menu style: icon trailing, a hairline below each
 *   row but the last, centred captions and solid separator bands.
 */
export type MenuVariant = 'base' | 'segmented';

/** Pressable's own handler types, so the row can wrap them without restating the event shapes. */
type HoverHandler = NonNullable<PressableProps['onHoverIn']>;

/**
 * Scale for the default (CommandPalette-style) variant — padding, icon size,
 * label type, and active-highlight radius per size.
 */
const DEFAULT_VARIANT: Record<
  MenuItemSize,
  { rowClass: string; iconSize: number; iconPlaceholderClass: string; labelClass: string }
> = {
  sm: {
    rowClass: 'gap-1.5 px-2 py-1.5',
    iconSize: 16,
    iconPlaceholderClass: 'h-4 w-4',
    labelClass: 'text-sm',
  },
  md: {
    rowClass: 'gap-2 px-4 py-2.5',
    iconSize: 18,
    iconPlaceholderClass: 'h-4.5 w-4.5',
    labelClass: 'text-base leading-5',
  },
  lg: {
    rowClass: 'gap-3 px-5 py-3',
    iconSize: 22,
    iconPlaceholderClass: 'h-5.5 w-5.5',
    labelClass: 'text-lg',
  },
};

const ROUNDED_VARIANT: Record<MenuItemSize, string> = { sm: 'rounded', md: 'rounded-md', lg: 'rounded-lg' };

/**
 * Row layout for the segmented variant — the icon trailing, so the row is
 * `justify-between` rather than the leading-icon `gap-*` of the base scale.
 * Padding and label ramp are the base scale's, only the distribution differs.
 */
const SEGMENTED_ROW_CLASS: Record<MenuItemSize, string> = {
  sm: 'justify-between px-2 py-1.5',
  md: 'justify-between px-4 py-2.5',
  lg: 'justify-between px-5 py-3',
};

/**
 * Scale for the iOS-style (iconBackgroundColor) variant — row height, icon
 * background dimensions, icon size, and label type per size.
 */
const ICON_TILE_VARIANT: Record<MenuItemSize, { rowClass: string; iconBgClass: string; iconSize: number; labelClass: string }> = {
  sm: {
    rowClass: 'h-9 gap-1.5 px-2.5',
    iconBgClass: 'h-5.5 w-5.5 rounded',
    iconSize: 15,
    labelClass: 'text-sm',
  },
  md: {
    rowClass: 'h-11 gap-2 px-3',
    iconBgClass: 'h-6.5 w-6.5 rounded-md',
    iconSize: 18,
    labelClass: 'text-base',
  },
  lg: {
    rowClass: 'h-13 gap-2.5 px-4',
    iconBgClass: 'h-8 w-8 rounded-lg',
    iconSize: 21,
    labelClass: 'text-lg',
  },
};

type LabelColorOptions = { hasIconTile: boolean; mode: MenuItemMode; active: boolean; destructive: boolean };

/**
 * Label colour class for a row, by variant → mode → state:
 * - `destructive` — the `danger` token, except over the `bg-info` active fill of
 *   the icon-tile variant, where red on blue is the less legible of the two.
 * - icon-tile variant — inverted foreground over that active fill.
 * - `'sidebar'` — muted until active, so the active row reads as selected.
 * - `'menu'` — always foreground; the highlight overlay carries the state.
 */
function getLabelColorClass({ hasIconTile, mode, active, destructive }: LabelColorOptions) {
  if (hasIconTile && active) return 'text-info-foreground';
  if (destructive) return 'text-danger';
  if (hasIconTile) return 'text-foreground';
  if (mode === 'sidebar') return active ? 'text-foreground' : 'text-muted-foreground';
  return 'text-foreground';
}

type IconTokenOptions = Omit<LabelColorOptions, 'hasIconTile'>;

/** The three theme tokens the default variant's leading icon is ever painted in. */
type MenuItemIconToken = 'danger' | 'foreground' | 'muted-foreground';

/**
 * Themed-icon token for the leading icon of the default variant. Tracks the
 * label: `danger` when destructive, foreground when active or in a menu, muted
 * for an inactive sidebar row.
 */
function getIconToken({ mode, active, destructive }: IconTokenOptions): MenuItemIconToken {
  if (destructive) return 'danger';
  if (active || mode === 'menu') return 'foreground';
  return 'muted-foreground';
}

export type MenuItemProps = Omit<PressableProps, 'children'> & {
  /**
   * Row size — controls padding, icon dimensions, and label type ramp.
   * @default 'md'
   */
  size?: MenuItemSize;
  /** Leading icon. */
  icon?: MenuItemIcon;
  /** Row label. */
  label: ReactNode;
  /**
   * Overrides the label font weight. Defaults to `medium` in `sidebar` mode
   * (the standard settings-sidebar look) and `normal` otherwise.
   */
  labelWeight?: TextWeight;
  /** Marks this row as the active/selected item. */
  active?: boolean;
  /**
   * Optional trailing element — badge node, chevron, hint chip, etc.
   * Rendered as-is after the label; callers control wrapping/sizing.
   */
  trailing?: ReactNode;
  /**
   * Visual mode — only affects the default (non-`iconBackgroundColor`) variant.
   * @default 'menu'
   */
  mode?: MenuItemMode;
  /**
   * Surface variant. `'segmented'` moves the icon trailing and lays the row out
   * `justify-between` (the hold-menu style); `'base'` keeps it leading.
   * @default 'base'
   */
  variant?: MenuVariant;
  /**
   * Draws the 1.5 px hairline below the row — the segmentation of the
   * `'segmented'` variant. Omitted on the last row, which ends flush.
   * @default false
   */
  bottomBorder?: boolean;
  /**
   * When set, the icon is placed inside a coloured rounded square
   * (iOS-style settings rows, e.g. MultiStepMenu sidebar).
   * When omitted the icon is rendered with themed muted/foreground colours.
   */
  iconBackgroundColor?: string;
  /**
   * Icon stroke colour when `iconBackgroundColor` is set.
   * @default 'white'
   */
  iconColor?: string;
  /**
   * When true and no `icon` is supplied, reserves the icon slot with a
   * same-size spacer — keeps labels aligned in mixed-icon lists.
   */
  iconPlaceholder?: boolean;
  /**
   * Paints the label and icon in the `danger` token — a delete/remove row.
   *
   * The `bg-info` active fill of the icon-tile variant wins over it: red on blue
   * is the less legible of the two, so an active destructive tile row keeps the
   * inverted foreground.
   */
  destructive?: boolean;
  /** Pass `useReducedMotion()` to skip the active-highlight spring. */
  reduce?: boolean;
};

type MenuItemIconSlotProps = {
  icon?: MenuItemIcon;
  size: MenuItemSize;
  active: boolean;
  /** Themed token for the default variant's icon — from `getIconToken`. */
  token: MenuItemIconToken;
  bgStyle?: { backgroundColor: string };
  iconColor: string;
  iconPlaceholder: boolean;
};

/** Leading icon slot: coloured square, themed icon, spacer or nothing. */
function MenuItemIconSlot({ icon: Icon, size, active, token, bgStyle, iconColor, iconPlaceholder }: MenuItemIconSlotProps) {
  if (!Icon) return iconPlaceholder ? <View className={DEFAULT_VARIANT[size].iconPlaceholderClass} /> : null;

  if (bgStyle) {
    const { iconBgClass, iconSize } = ICON_TILE_VARIANT[size];
    return (
      <View
        className={cn(
          'items-center justify-center',
          iconBgClass,
          active && 'shadow-[0_0_2px_0.5px_rgb(0_0_0_/_0.20)]', // theme-exempt: pure-black drop shadow
        )}
        style={bgStyle}
      >
        <Icon size={iconSize} color={iconColor} />
      </View>
    );
  }

  return <ThemedIcon icon={Icon} token={token} size={DEFAULT_VARIANT[size].iconSize} />;
}

/**
 * Reusable menu-list row: leading icon, label, optional trailing, active highlight.
 *
 * Two visual modes selected by `iconBackgroundColor`:
 * - **Default** — CommandPalette style: animated `bg-surface-selected` overlay,
 *   themed icon, compact padding, smaller label.
 * - **Icon-tile** (`iconBackgroundColor` set) — Settings/MultiStepMenu style:
 *   coloured rounded-square icon, `bg-info` row fill on active, taller row,
 *   larger label.
 *
 * Both modes scale uniformly via the `size` prop (`'sm'` | `'md'` | `'lg'`).
 *
 * `destructive` tints the label and icon with the `danger` token; `disabled`
 * dims the row and blocks the press, in both modes.
 */
export function MenuItem({
  size = 'md',
  mode = 'menu',
  variant = 'base',
  bottomBorder = false,
  icon: Icon,
  label,
  labelWeight,
  active = false,
  trailing,
  iconBackgroundColor,
  iconColor = 'white' /* theme-exempt: white on vivid icon square fill */,
  iconPlaceholder = false,
  destructive = false,
  reduce = false,
  className,
  disabled,
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
  ...props
}: MenuItemProps) {
  const [hovered, setHovered] = useState(false);
  const { pressed, pressHandlers } = usePressState({ onPressIn, onPressOut });

  // The row owns hover state to drive its own hover fill; press is delegated to
  // usePressState which forwards to the caller's handler when provided —
  // CommandPalette passes `onPressIn` to move its active row.
  const handleHoverIn = useCallback<HoverHandler>(
    (event) => {
      setHovered(true);
      onHoverIn?.(event);
    },
    [onHoverIn],
  );
  const handleHoverOut = useCallback<HoverHandler>(
    (event) => {
      setHovered(false);
      onHoverOut?.(event);
    },
    [onHoverOut],
  );
  const hasIconTile = Boolean(iconBackgroundColor);
  const backgroundStyle = useMemo(
    () => (iconBackgroundColor ? { backgroundColor: iconBackgroundColor } : undefined),
    [iconBackgroundColor],
  );

  const scale = hasIconTile ? ICON_TILE_VARIANT[size] : DEFAULT_VARIANT[size];
  const canInteract = !(active || disabled);
  const segmented = variant === 'segmented';

  const labelColorClass = getLabelColorClass({ hasIconTile, mode, active, destructive });
  const iconToken = getIconToken({ mode, active, destructive });

  // The leading slot in `'base'`, the trailing one in `'segmented'` — extracted
  // so the single instance can move without duplicating its props.
  const iconSlot = (
    <MenuItemIconSlot
      icon={Icon}
      size={size}
      active={active}
      token={iconToken}
      bgStyle={backgroundStyle}
      iconColor={iconColor}
      iconPlaceholder={iconPlaceholder}
    />
  );

  return (
    <Pressable
      {...props}
      className={cn(
        'relative flex-row items-center overflow-hidden',
        segmented ? SEGMENTED_ROW_CLASS[size] : cn(mode === 'sidebar' && ROUNDED_VARIANT[size], scale.rowClass),
        bottomBorder && 'border-border border-b-[1.5px]',
        hasIconTile && active && 'bg-info',
        canInteract && hovered && 'bg-surface-hover',
        canInteract && pressed && 'bg-surface-selected',
        // Dimmed *and* blocked: `disabled` alone would leave the row looking live,
        // and the fills above are already suppressed for it via `canInteract`.
        disabled && 'opacity-40',
        className,
      )}
      disabled={disabled}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      {...pressHandlers}
    >
      {/* Animated active highlight — default (non-icon-bg) variant only */}
      {!hasIconTile && active ? (
        <MotiView
          key="hl"
          className="pointer-events-none absolute inset-0 bg-surface-selected"
          from={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { type: 'timing', duration: 0 } : SPRING_LAYOUT}
        />
      ) : null}

      {/* Icon — leading in `base`, trailing in `segmented` */}
      {!segmented && iconSlot}

      {/* Label */}
      <Text
        numberOfLines={1}
        className={cn('flex-1', scale.labelClass, labelColorClass)}
        weight={labelWeight ?? (mode === 'sidebar' && !hasIconTile ? 'medium' : 'normal')}
      >
        {label}
      </Text>

      {segmented && iconSlot}

      {/* Trailing */}
      {trailing ?? null}
    </Pressable>
  );
}
