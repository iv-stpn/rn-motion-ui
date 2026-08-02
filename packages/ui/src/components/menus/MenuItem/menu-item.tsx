// biome-ignore-all lint/style/useExportsLast: MenuItem defines inline subcomponents
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import { cn } from '../../../lib/cn';
import { SPRING_LAYOUT } from '../../../lib/ease';
import type { IconProps } from '../../../lib/icons';
import { MotiView } from '../../../moti/components/view';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';

/** Icon renderer — compatible with this project's icon set signature. */
export type MenuItemIcon = (props: IconProps) => ReactNode;

export type MenuItemSize = 'sm' | 'md' | 'lg';

/**
 * Visual mode for the default (non-icon-bg) variant.
 * - `'menu'`    — text is always foreground, normal weight (CommandPalette style).
 * - `'sidebar'` — medium weight; non-active text and icon use a muted colour.
 */
export type MenuItemMode = 'menu' | 'sidebar';

/** Pressable's own handler types, so the row can wrap them without restating the event shapes. */
type HoverHandler = NonNullable<PressableProps['onHoverIn']>;
type PressHandler = NonNullable<PressableProps['onPressIn']>;

/**
 * Scale for the default (CommandPalette-style) variant — padding, icon size,
 * label type, and active-highlight radius per size.
 */
const DEFAULT_VARIANT: Record<
  MenuItemSize,
  { rowClass: string; iconSize: number; iconPlaceholderClass: string; labelClass: string }
> = {
  sm: {
    rowClass: 'gap-1.5 px-2 py-1',
    iconSize: 14,
    iconPlaceholderClass: 'h-3.5 w-3.5',
    labelClass: 'text-[12px]',
  },
  md: {
    rowClass: 'gap-3 px-3 py-1.5',
    iconSize: 19,
    iconPlaceholderClass: 'h-5 w-5',
    labelClass: 'text-[14px]',
  },
  lg: {
    rowClass: 'gap-3 px-4 py-2',
    iconSize: 24,
    iconPlaceholderClass: 'h-6 w-6',
    labelClass: 'text-[18px]',
  },
};

const ROUNDED_VARIANT: Record<MenuItemSize, string> = { sm: 'rounded', md: 'rounded-md', lg: 'rounded-lg' };

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

type LabelColorOptions = { hasIconTile: boolean; mode: MenuItemMode; active: boolean };

/**
 * Label colour class for a row, by variant → mode → state:
 * - icon-tile variant — inverted foreground over the `bg-info` active fill.
 * - `'sidebar'` — muted until active, so the active row reads as selected.
 * - `'menu'` — always foreground; the highlight overlay carries the state.
 */
function getLabelColorClass({ hasIconTile, mode, active }: LabelColorOptions) {
  if (hasIconTile) return active ? 'text-info-foreground' : 'text-foreground';
  if (mode === 'sidebar') return active ? 'text-foreground' : 'text-muted-foreground';
  return 'text-foreground';
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
  /** Pass `useReducedMotion()` to skip the active-highlight spring. */
  reduce?: boolean;
};

type MenuItemIconSlotProps = {
  icon?: MenuItemIcon;
  size: MenuItemSize;
  active: boolean;
  mode: MenuItemMode;
  bgStyle?: { backgroundColor: string };
  iconColor: string;
  iconPlaceholder: boolean;
};

/** Leading icon slot: coloured square, themed icon, spacer or nothing. */
function MenuItemIconSlot({ icon: Icon, size, active, mode, bgStyle, iconColor, iconPlaceholder }: MenuItemIconSlotProps) {
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

  // menu mode: icon is always foreground; sidebar mode: muted when inactive
  return (
    <ThemedIcon
      icon={Icon}
      token={active || mode === 'menu' ? 'foreground' : 'muted-foreground'}
      size={DEFAULT_VARIANT[size].iconSize}
    />
  );
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
 */
export function MenuItem({
  size = 'md',
  mode = 'menu',
  icon: Icon,
  label,
  active = false,
  trailing,
  iconBackgroundColor,
  iconColor = 'white' /* theme-exempt: white on vivid icon square fill */,
  iconPlaceholder = false,
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
  const [pressed, setPressed] = useState(false);

  // The row owns these four to drive its own hover/press fills, so each must
  // forward to the caller's handler rather than replace it — CommandPalette
  // passes `onPressIn` to move its active row.
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
  const handlePressIn = useCallback<PressHandler>(
    (event) => {
      setPressed(true);
      onPressIn?.(event);
    },
    [onPressIn],
  );
  const handlePressOut = useCallback<PressHandler>(
    (event) => {
      setPressed(false);
      onPressOut?.(event);
    },
    [onPressOut],
  );

  const hasIconTile = Boolean(iconBackgroundColor);
  const backgroundStyle = useMemo(
    () => (iconBackgroundColor ? { backgroundColor: iconBackgroundColor } : undefined),
    [iconBackgroundColor],
  );

  const scale = hasIconTile ? ICON_TILE_VARIANT[size] : DEFAULT_VARIANT[size];
  const canInteract = !(active || disabled);

  const labelColorClass = getLabelColorClass({ hasIconTile, mode, active });

  return (
    <Pressable
      {...props}
      className={cn(
        'relative flex-row items-center overflow-hidden',
        mode === 'sidebar' && ROUNDED_VARIANT[size],
        scale.rowClass,
        hasIconTile && active && 'bg-info',
        canInteract && hovered && 'bg-surface-hover',
        canInteract && pressed && 'bg-surface-selected',
        className,
      )}
      disabled={disabled}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
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

      {/* Icon */}
      <MenuItemIconSlot
        icon={Icon}
        size={size}
        active={active}
        mode={mode}
        bgStyle={backgroundStyle}
        iconColor={iconColor}
        iconPlaceholder={iconPlaceholder}
      />

      {/* Label */}
      <Text
        numberOfLines={1}
        className={cn('flex-1', scale.labelClass, labelColorClass)}
        weight={mode === 'sidebar' && !hasIconTile ? 'medium' : 'normal'}
      >
        {label}
      </Text>

      {/* Trailing */}
      {trailing ?? null}
    </Pressable>
  );
}
