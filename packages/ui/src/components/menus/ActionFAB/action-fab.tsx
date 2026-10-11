import { type ComponentType, useCallback, useId, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { AddLine } from 'rn-motion-ui-icons/icons/add-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { MotiView } from '../../../moti/components/view';
import { MOTION_SNAPPY, TIMING_INSTANT } from '../../../theme/motion';
import { IconButton } from '../../buttons/IconButton/icon-button';
import { useBlurTargetRef } from '../Overlay/blur-context';
import type { OverlayType } from '../Overlay/overlay-type';
import { TeleportedOverlay } from '../Overlay/teleported-overlay';
import { ActionFABMenu } from './action-fab-menu';
import { useActionFABFrame } from './use-action-fab-frame';

// Compile box-none through RNW's StyleSheet so closed FABs cannot eat page taps.
const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 30, pointerEvents: 'box-none' },
});

export type ActionFABItem = {
  /** Stable identity, independent of the label. */
  id: string;
  label: string;
  icon?: ComponentType<IconProps>;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  destructive?: boolean;
  testID?: string;
};

export type ActionFABProps = {
  /** Accessible menu name; the pill stack has no visible heading. */
  title: string;
  items: readonly ActionFABItem[];
  icon?: ComponentType<IconProps>;
  iconColor?: string;
  triggerClassName?: string;
  position?: 'bottom-right' | 'bottom-left';
  /** Maximum pill width; short labels hug their content. @default 280 */
  menuWidth?: number;
  /** Include safe-area clearance here if the parent does not own it. @default 16 */
  bottomInset?: number;
  /** Backdrop behind the individual pills. Android blur needs BlurProvider. @default 'opacity' */
  overlay?: OverlayType;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Run a lone action directly from the trigger. @default true */
  directSingleAction?: boolean;
  accessibilityLabel?: string;
  closeAccessibilityLabel?: string;
  testID?: string;
  triggerTestID?: string;
  menuTestID?: string;
};

/** A mobile action stack: separate pills rise above a stationary FAB, nearest
 * first. The trigger rotates in place under the optional dim/blur backdrop.
 * Mount inside a bounded content stage; long lists scroll above the trigger.
 * Android blur renders outside BlurProvider's target, keeping the pills sharp.
 */
export function ActionFAB({
  title,
  items,
  icon = AddLine,
  iconColor,
  triggerClassName,
  position = 'bottom-right',
  menuWidth = 280,
  bottomInset = 16,
  overlay = 'opacity',
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  directSingleAction = true,
  accessibilityLabel,
  closeAccessibilityLabel = 'Close actions',
  testID = 'action-fab',
  triggerTestID = 'action-fab-trigger',
  menuTestID = 'action-fab-menu',
}: ActionFABProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const singleAction = directSingleAction && items.length === 1 ? items[0] : undefined;
  const open = !singleAction && items.length > 0 && (controlledOpen ?? internalOpen);
  const { rootRef, frame, measureFrame, window } = useActionFABFrame(open);
  const menuId = useId();
  const reduce = useReducedMotion();
  const blurTarget = useBlurTargetRef();
  const teleported = Platform.OS === 'android' && blurTarget !== null;
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);
  const toggle = useCallback(() => {
    if (singleAction) {
      if (!singleAction.disabled) singleAction.onPress();
    } else setOpen(!open);
  }, [singleAction, open, setOpen]);

  if (items.length === 0) return null;
  const anchor = position === 'bottom-left' ? { left: 16 } : { right: 16 };
  const menu = frame ? (
    <ActionFABMenu
      open={open}
      close={close}
      items={items}
      title={title}
      menuId={menuId}
      frame={frame}
      window={window}
      position={position}
      menuWidth={menuWidth}
      bottomInset={bottomInset}
      overlay={overlay}
      teleported={teleported}
      closeAccessibilityLabel={closeAccessibilityLabel}
      testID={testID}
      menuTestID={menuTestID}
    />
  ) : null;

  return (
    <View ref={rootRef} collapsable={false} testID={testID} style={styles.root} onLayout={measureFrame}>
      <View
        className="absolute"
        style={{ ...anchor, bottom: bottomInset }}
        aria-hidden={open}
        accessibilityElementsHidden={open}
        importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}
      >
        <MotiView animate={{ rotate: open ? '45deg' : '0deg' }} transition={reduce ? TIMING_INSTANT : MOTION_SNAPPY}>
          <IconButton
            icon={singleAction?.icon ?? icon}
            iconColor={iconColor}
            contentClassName={triggerClassName}
            size="lg"
            density="comfortable"
            iconSize={24}
            elevation={0}
            pressMode="none"
            disabled={singleAction?.disabled}
            onPress={toggle}
            accessibilityLabel={singleAction?.label ?? accessibilityLabel ?? `${title} actions`}
            accessibilityState={singleAction ? undefined : { expanded: open }}
            aria-haspopup={singleAction ? undefined : 'menu'}
            aria-controls={open ? menuId : undefined}
            testID={triggerTestID}
          />
        </MotiView>
      </View>
      {teleported && frame ? (
        <TeleportedOverlay teleported={true} rootWindow={frame} width={frame.width} height={frame.height}>
          {menu}
        </TeleportedOverlay>
      ) : (
        menu
      )}
    </View>
  );
}
