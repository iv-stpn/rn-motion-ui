// biome-ignore-all lint/style/useExportsLast: MenuItem defines inline subcomponents
import { type ReactNode, useMemo } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import { cn } from '../../lib/cn';
import { SPRING_LAYOUT } from '../../lib/ease';
import type { IconProps } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { ThemedIcon } from '../Icon/themed-icon';
import { Text } from '../Text/text';

/** Icon renderer — compatible with this project's icon set signature. */
export type MenuItemIcon = (props: IconProps) => ReactNode;

export type MenuItemProps = Omit<PressableProps, 'children'> & {
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
  active: boolean;
  /** Rounded-square fill style — presence selects the iOS-style icon variant. */
  bgStyle?: { backgroundColor: string };
  iconColor: string;
  iconPlaceholder: boolean;
};

/** Leading icon slot: coloured square, themed icon, spacer or nothing. */
function MenuItemIconSlot({ icon: Icon, active, bgStyle, iconColor, iconPlaceholder }: MenuItemIconSlotProps) {
  if (!Icon) return iconPlaceholder ? <View className="h-4 w-4" /> : null;

  if (bgStyle) {
    return (
      <View
        className={cn('h-6.5 w-6.5 items-center justify-center rounded-md', active && 'shadow-[0_0_2px_0.5px_rgb(0_0_0_/_0.20)]')} // theme-exempt: pure-black drop shadow
        style={bgStyle}
      >
        <Icon size={18} color={iconColor} />
      </View>
    );
  }

  return <ThemedIcon icon={Icon} token={active ? 'foreground' : 'muted-foreground'} size={16} />;
}

/**
 * Reusable menu-list row: leading icon, label, optional trailing, active highlight.
 *
 * Two visual modes selected by `iconBackgroundColor`:
 * - **Default** — CommandPalette style: animated `bg-surface-selected` overlay,
 *   16 px themed icon, compact `py-2` padding, `text-sm` label.
 * - **iOS-style** (`iconBackgroundColor` set) — Settings/MultiStepMenu style:
 *   coloured rounded-square icon, `bg-primary/75` row highlight on active,
 *   taller `h-11` row, `text-base` label.
 */
export function MenuItem({
  icon: Icon,
  label,
  active = false,
  trailing,
  iconBackgroundColor,
  iconColor = 'white' /* theme-exempt: white on vivid icon square fill */,
  iconPlaceholder = false,
  reduce = false,
  className,
  ...props
}: MenuItemProps) {
  const hasIconBg = Boolean(iconBackgroundColor);
  const bgStyle = useMemo(
    () => (iconBackgroundColor ? { backgroundColor: iconBackgroundColor } : undefined),
    [iconBackgroundColor],
  );

  return (
    <Pressable
      // biome-ignore lint/nursery/useSortedClasses: dynamic base + conditional extension — cannot sort across template-literal segments
      className={`relative flex-row items-center${hasIconBg ? ` h-11 gap-2 rounded-lg px-3${active ? ' bg-primary/75' : ''}` : ' gap-3 rounded-md px-2 py-2'}${className ? ` ${String(className)}` : ''}`}
      {...props}
    >
      {/* Animated active highlight — default (non-icon-bg) variant only */}
      {!hasIconBg && active ? (
        <MotiView
          key="hl"
          className="pointer-events-none absolute inset-0 rounded-md bg-surface-selected"
          from={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { type: 'timing', duration: 0 } : SPRING_LAYOUT}
        />
      ) : null}

      {/* Icon */}
      <MenuItemIconSlot icon={Icon} active={active} bgStyle={bgStyle} iconColor={iconColor} iconPlaceholder={iconPlaceholder} />

      {/* Label */}
      <Text
        numberOfLines={1}
        // biome-ignore lint/nursery/useSortedClasses: dynamic class — size and colour variant split across conditions
        className={`flex-1${hasIconBg ? ` text-base${active ? ' font-semibold text-primary-foreground' : ' text-foreground'}` : ` text-sm${active ? ' text-foreground' : ' text-muted-foreground'}`}`}
      >
        {label}
      </Text>

      {/* Trailing */}
      {trailing ?? null}
    </Pressable>
  );
}
