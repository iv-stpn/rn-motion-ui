// biome-ignore-all lint/style/useExportsLast: the public item/props types head the module so the action sub-components below read against them
import { type ReactNode, useCallback, useState } from 'react';
import { Platform, type StyleProp, View, type ViewStyle } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { AddLine as Plus } from 'rn-motion-ui-icons/icons/add-line';
import { useBreakpointAtLeast } from '../../../hooks/use-breakpoint';
import type { BreakpointOverrides, BreakpointValue } from '../../../lib/breakpoints';
import type { SurfaceElevation } from '../../../lib/elevated';
import { Button } from '../../buttons/Button/button';
import { BUTTON_ICON_SIZE, type RampSize } from '../../buttons/Button/button-scale';
import { IconButton } from '../../buttons/IconButton/icon-button';
import { ThemedIcon } from '../../icon/themed-icon';
import { MorphingFAB } from '../../menus/MorphingFAB/morphing-fab';
import { MenuItem } from '../../rows/menu-item';
import { useDockInset } from '../DockInset/dock-inset';

/**
 * PrimaryActions — one responsive host for a screen's "primary actions".
 *
 * Screens used to re-implement the same responsive FAB ↔ header switch by hand
 * (a `MorphingFAB` below the breakpoint, a button/icon cluster above it), each
 * with its own drift on testIDs, dock clearance and a11y. This collapses that
 * into a single component:
 *
 * - **Below `breakpoint`** it renders a {@link MorphingFAB} whose pane lists the
 *   actions as {@link MenuItem} rows. The FAB lifts itself above the floating
 *   dock by reading {@link useDockInset} — no hand-derived magic constant.
 * - **At/above `breakpoint`** it renders a header row: an icon cluster on web
 *   (icon-only buttons, no hover on native), or a labelled row on native, or
 *   whichever you force via `desktopMode`.
 *
 * Every action derives the stable testID `${testID}-item-<id>` (an action's own
 * `testID` wins), so a screen can query any of its primary actions without
 * knowing which form the current width rendered.
 */

/** Icon renderer — compatible with this project's icon set signature. */
export type PrimaryActionIcon = (props: IconProps) => ReactNode;

/** One action in the primary-actions list. */
export type PrimaryActionItem = {
  /** Stable id — the action's key and the `${testID}-item-<id>` suffix. */
  id: string;
  /** Action label. */
  label: string;
  /**
   * Leading icon. Required for the desktop icon cluster; the labelled row and
   * the FAB pane simply render without it when absent.
   */
  icon?: PrimaryActionIcon;
  onPress?: () => void;
  disabled?: boolean;
  /** Overrides the derived `${testID}-item-<id>`. */
  testID?: string;
  /** Accessible name; falls back to `label` when omitted. */
  accessibilityLabel?: string;
};

/** How the desktop (header) form renders its actions. */
export type PrimaryActionsDesktopMode = 'auto' | 'icons' | 'labels';

export type PrimaryActionsProps = {
  /** The ordered list of actions. */
  actions: readonly PrimaryActionItem[];
  /**
   * Width breakpoint at/above which the header form renders; below it, the FAB.
   * Accepts a breakpoint name or a raw pixel number. @default 'md'
   */
  breakpoint?: BreakpointValue;
  /** Breakpoint overrides for the active scale. */
  breakpoints?: BreakpointOverrides;
  /** FAB corner (the mobile form). @default 'bottom-right' */
  position?: 'bottom-right' | 'bottom-left';
  /** FAB trigger icon. @default a plus (`AddLine`). */
  triggerIcon?: PrimaryActionIcon;
  /** FAB trigger accessible name. @default 'Create' */
  triggerLabel?: string;
  /**
   * Desktop form: `'icons'` (icon-only cluster), `'labels'` (labelled buttons),
   * or `'auto'` — icons on web, labels on native. @default 'auto'
   */
  desktopMode?: PrimaryActionsDesktopMode;
  /** Desktop button size. @default 'md' */
  size?: RampSize;
  /** Surface elevation for the FAB trigger and the desktop buttons. @default 0 */
  elevation?: SurfaceElevation;
  /** Swap the ladder shadow for the diffuse halo. @default false */
  floating?: boolean;
  /** Backdrop blur radius in px/dp. @default 0 */
  blurRadius?: number;
  /** Draw the glass edge light. @default false */
  rim?: boolean;
  /** FAB pane width (the mobile form). @default 300 */
  expandedWidth?: number;
  /** FAB pane height (the mobile form). @default 240 */
  expandedHeight?: number;
  /** Gap (px) kept between the dock and the FAB's bottom edge. @default 16 */
  bottomOffset?: number;
  /** Called with the action on every press, alongside the action's own `onPress`. */
  onAction?: (item: PrimaryActionItem) => void;
  /** Merged onto whichever root the current form renders. */
  style?: StyleProp<ViewStyle>;
  /** Root testID; actions derive `${testID}-item-<id>` and the FAB trigger `${testID}-trigger`. */
  testID?: string;
};

/** The FAB's resting bottom inset above the dock (or the screen, when no dock). */
const FAB_INSET = 16;

/** A press handler that receives the pressed action. */
type ActionPressHandler = (item: PrimaryActionItem) => void;

/** Surface props shared by the FAB trigger and the desktop buttons. */
type ActionSurfaceProps = {
  size: RampSize;
  elevation: SurfaceElevation;
  floating: boolean;
  blurRadius: number;
  rim: boolean;
};

type ActionIconButtonProps = ActionSurfaceProps & {
  item: PrimaryActionItem;
  icon: PrimaryActionIcon;
  onPress: ActionPressHandler;
  testID?: string;
};

/** The desktop icon cluster's button — an icon-only plate. */
function ActionIconButton({ item, icon, onPress, testID, size, elevation, floating, blurRadius, rim }: ActionIconButtonProps) {
  const handlePress = useCallback(() => onPress(item), [onPress, item]);
  return (
    <IconButton
      icon={icon}
      size={size}
      elevation={elevation}
      floating={floating}
      blurRadius={blurRadius}
      rim={rim}
      disabled={item.disabled}
      onPress={handlePress}
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      testID={testID}
    />
  );
}

type ActionLabelButtonProps = ActionSurfaceProps & {
  item: PrimaryActionItem;
  onPress: ActionPressHandler;
  testID?: string;
};

/** The desktop labelled row's button — icon adornment + label. */
function ActionLabelButton({ item, onPress, testID, size, elevation, floating, blurRadius, rim }: ActionLabelButtonProps) {
  const handlePress = useCallback(() => onPress(item), [onPress, item]);
  return (
    <Button
      size={size}
      elevation={elevation}
      floating={floating}
      blurRadius={blurRadius}
      rim={rim}
      disabled={item.disabled}
      onPress={handlePress}
      leftAdornment={item.icon ? <ThemedIcon icon={item.icon} token="foreground" size={BUTTON_ICON_SIZE[size]} /> : undefined}
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      testID={testID}
    >
      {item.label}
    </Button>
  );
}

type ActionMenuItemProps = { item: PrimaryActionItem; onSelect: ActionPressHandler; testID?: string };

/** The FAB pane's row — picking it fires the action and folds the FAB. */
function ActionMenuItem({ item, onSelect, testID }: ActionMenuItemProps) {
  const handlePress = useCallback(() => onSelect(item), [onSelect, item]);
  return (
    <MenuItem
      icon={item.icon}
      label={item.label}
      disabled={item.disabled}
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      onPress={handlePress}
      testID={testID}
    />
  );
}

export function PrimaryActions({
  actions,
  breakpoint = 'md',
  breakpoints,
  position = 'bottom-right',
  triggerIcon,
  triggerLabel = 'Create',
  desktopMode = 'auto',
  size = 'md',
  elevation = 0,
  floating = false,
  blurRadius = 0,
  rim = false,
  expandedWidth = 300,
  expandedHeight = 240,
  bottomOffset = FAB_INSET,
  onAction,
  style,
  testID,
}: PrimaryActionsProps) {
  const isDesktop = useBreakpointAtLeast(breakpoint, breakpoints);
  const dockInset = useDockInset();
  // Controlled so a picked action can fold the FAB from a stable handler without
  // reaching into the render-prop's `api.close`.
  const [fabOpen, setFabOpen] = useState(false);

  const handlePress = useCallback(
    (item: PrimaryActionItem) => {
      item.onPress?.();
      onAction?.(item);
    },
    [onAction],
  );

  const handleSelect = useCallback(
    (item: PrimaryActionItem) => {
      handlePress(item);
      setFabOpen(false);
    },
    [handlePress],
  );

  const itemTestID = useCallback(
    (item: PrimaryActionItem) => item.testID ?? (testID ? `${testID}-item-${item.id}` : undefined),
    [testID],
  );

  // 'auto' renders the icon cluster on web (where hover lets an icon-only button
  // stand alone) and the labelled row on native (no hover to disambiguate).
  const iconCluster = desktopMode === 'icons' || (desktopMode === 'auto' && Platform.OS === 'web');

  if (isDesktop) {
    return (
      <View testID={testID} className="flex-row flex-wrap items-center gap-2" style={style}>
        {actions.map((item) => {
          const tid = itemTestID(item);
          // An action without an icon falls back to a labelled button even in
          // cluster mode, so it is never reduced to an unlabelled glyph.
          if (iconCluster && item.icon)
            return (
              <ActionIconButton
                key={item.id}
                item={item}
                icon={item.icon}
                onPress={handlePress}
                testID={tid}
                size={size}
                elevation={elevation}
                floating={floating}
                blurRadius={blurRadius}
                rim={rim}
              />
            );
          return (
            <ActionLabelButton
              key={item.id}
              item={item}
              onPress={handlePress}
              testID={tid}
              size={size}
              elevation={elevation}
              floating={floating}
              blurRadius={blurRadius}
              rim={rim}
            />
          );
        })}
      </View>
    );
  }

  return (
    <MorphingFAB
      icon={triggerIcon ?? Plus}
      position={position}
      open={fabOpen}
      onOpenChange={setFabOpen}
      elevation={elevation}
      floating={floating}
      blurRadius={blurRadius}
      rim={rim}
      expandedWidth={expandedWidth}
      expandedHeight={expandedHeight}
      accessibilityLabel={triggerLabel}
      testID={testID}
      triggerTestID={testID ? `${testID}-trigger` : undefined}
      style={[style, { bottom: dockInset + bottomOffset }]}
    >
      <View className="flex-col gap-0.5">
        {actions.map((item) => (
          <ActionMenuItem key={item.id} item={item} onSelect={handleSelect} testID={itemTestID(item)} />
        ))}
      </View>
    </MorphingFAB>
  );
}
