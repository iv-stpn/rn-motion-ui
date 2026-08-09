// biome-ignore-all lint/style/useExportsLast: the entry type heads the module so the implementation below reads against it

import { type ReactNode, useCallback, useState } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { RightLine as ChevronRight } from 'rn-motion-ui-icons/icons/right-line';
import { cn } from '../../lib/cn';
import { type ItemRowAdornment, type ItemRowSize, type ItemRowVariant, RowLayout, SIZE_SCALE, VARIANT_CLASSES } from './item-row';

/** Pressable's own handler types, so the row can wrap them without restating the event shapes. */
type HoverHandler = NonNullable<PressableProps['onHoverIn']>;
type PressHandler = NonNullable<PressableProps['onPressIn']>;

export type ActionRowProps = Omit<PressableProps, 'children'> & {
  /** Row title — primary text, `font-medium` foreground. */
  title: ReactNode;
  /** Optional secondary text, rendered below the title in a muted colour. */
  description?: ReactNode;
  /**
   * Leading adornment. When `{ icon: ... }`, the icon is wrapped in a
   * `ThemedIcon` tinted `foreground`; any other ReactNode renders as-is.
   */
  leftAdornment?: ItemRowAdornment;
  /**
   * Trailing adornment. When `{ icon: ... }`, the icon is wrapped in a
   * `ThemedIcon` tinted `muted-foreground`; any other ReactNode renders as-is.
   *
   * **Defaults to a `ChevronRight` caret icon.** Pass `undefined` explicitly to
   * suppress it, or provide your own adornment to replace it.
   */
  rightAdornment?: ItemRowAdornment;
  /**
   * Press handler. The row shows hover (`bg-surface-hover`) and press
   * (`bg-surface-selected`) state overlays automatically when `onPress` or
   * `href` is provided.
   */
  onPress?: () => void;
  /**
   * Row size — controls padding, icon dimensions, and the type ramp.
   * @default 'md'
   */
  size?: ItemRowSize;
  /** Visual flavour of the row surface. @default 'default' */
  variant?: ItemRowVariant;
  /**
   * URL for link-style navigation (React Native Web extension).
   * When provided alongside or instead of `onPress`, the row shows
   * hover/press overlays.
   */
  href?: string;
};

// Re-export these so consumers can import everything from './action-row'
export type { ItemRowAdornment, ItemRowSize, ItemRowVariant } from './item-row';

/**
 * A two-line pressable list row: leading adornment, title + optional
 * description, and a trailing chevron (overridable). Part of the
 * interactive-surface family, so sizing follows the same `'sm' | 'md' | 'lg'`
 * ramp as {@link MenuItem}, {@link ItemRow}, and {@link CloseButton}.
 *
 * `ActionRow` is the interactive counterpart to {@link ItemRow}. It wraps the
 * row in a `Pressable`, shows hover / press overlays
 * (`bg-surface-hover` / `bg-surface-selected`), and defaults the right
 * adornment to a `ChevronRight` caret — the conventional signifier for "this
 * row navigates or performs an action."
 *
 * Supports `href` (React Native Web extension) for link-style navigation.
 *
 * @example
 * // Basic pressable row with default chevron:
 * <ActionRow
 *   title="Notifications"
 *   description="Choose how you hear from us"
 *   leftAdornment={{ icon: Bell }}
 *   onPress={openNotifications}
 * />
 *
 * @example
 * // Override the default chevron with a custom right adornment:
 * <ActionRow
 *   title="Sign out"
 *   leftAdornment={{ icon: LogOut }}
 *   rightAdornment={<Badge>3</Badge>}
 *   onPress={signOut}
 * />
 *
 * @example
 * // Link row (web):
 * <ActionRow
 *   title="View profile"
 *   leftAdornment={{ icon: User }}
 *   href="/profile"
 * />
 */
export function ActionRow({
  title,
  description,
  leftAdornment,
  rightAdornment,
  onPress,
  disabled = false,
  size = 'md',
  variant = 'default',
  className,
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
  href,
  ...props
}: ActionRowProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  // The row owns these four to drive its own hover/press fills, so each must
  // forward to the caller's handler rather than replace it.
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

  const scale = SIZE_SCALE[size];
  const hasPress = typeof onPress === 'function' || typeof href === 'string';

  // Default right adornment: ChevronRight caret, overridable by caller.
  const resolvedRightAdornment = rightAdornment === undefined ? { icon: ChevronRight } : rightAdornment;

  return (
    <Pressable
      {...props}
      disabled={disabled}
      onPress={onPress}
      // @ts-expect-error RNW extended props
      href={href}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className={cn(
        'flex-row items-center',
        VARIANT_CLASSES[variant],
        scale.rowClass,
        hasPress && !disabled && hovered && 'bg-surface-hover',
        hasPress && !disabled && pressed && 'bg-surface-selected',
        disabled && 'opacity-40',
        className,
      )}
    >
      <RowLayout
        title={title}
        description={description}
        leftAdornment={leftAdornment}
        rightAdornment={resolvedRightAdornment}
        size={size}
      />
    </Pressable>
  );
}
