import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusTrap } from '../../../hooks/use-focus-trap';
import { useMenuKeyboardNavigation } from '../../../hooks/use-menu-keyboard';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { FOCUS_VISIBLE_RING } from '../../../lib/focus-ring';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { TIMING_BASE, TIMING_INSTANT } from '../../../theme/motion';
import { BUTTON_SIZE } from '../../buttons/Button/button-scale';
import { OverlayBlur } from '../Overlay/overlay-blur';
import type { ActionFABProps } from './action-fab';
import { ActionFABOption } from './action-fab-item';
import { useActionFABDismiss } from './use-action-fab-dismiss';
import type { ActionFABFrame } from './use-action-fab-frame';

type ActionFABMenuProps = Required<
  Pick<
    ActionFABProps,
    'title' | 'items' | 'position' | 'menuWidth' | 'bottomInset' | 'overlay' | 'closeAccessibilityLabel' | 'testID' | 'menuTestID'
  >
> & {
  open: boolean;
  close: () => void;
  menuId: string;
  frame: ActionFABFrame;
  window: { width: number; height: number };
  teleported: boolean;
};

/** Own focus inside the teleported subtree too: Android mounts it after its parent. */
export function ActionFABMenu({
  open,
  close,
  title,
  items,
  menuId,
  frame,
  window,
  position,
  menuWidth,
  bottomInset,
  overlay,
  teleported,
  closeAccessibilityLabel,
  testID,
  menuTestID,
}: ActionFABMenuProps) {
  const controlsRef = useRef<View>(null);
  const reduce = useReducedMotion();
  useFocusTrap(controlsRef, open);
  useMenuKeyboardNavigation(controlsRef, open);
  useActionFABDismiss(controlsRef, open, close);
  const anchor = position === 'bottom-left' ? { left: 16 } : { right: 16 };
  const triggerSide = BUTTON_SIZE.lg.px;
  const panelBottom = bottomInset + triggerSide + 12;
  const maxHeight = Math.max(0, frame.height - panelBottom - 16);
  const backdropFrame = {
    position: 'absolute' as const,
    left: -frame.x,
    top: -frame.y,
    width: window.width,
    height: window.height,
  };

  return (
    <View
      pointerEvents={open ? 'box-none' : 'none'}
      style={StyleSheet.absoluteFill}
      aria-hidden={!open}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
    >
      <View
        pointerEvents="none"
        style={backdropFrame}
        aria-hidden={true}
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        <AnimatePresence>
          {open && overlay === 'blur' ? <OverlayBlur key="blur" inline={!teleported} /> : null}
          {open && overlay !== 'none' ? (
            <MotiView
              key="tint"
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduce ? TIMING_INSTANT : TIMING_BASE}
              testID={`${testID}-scrim`}
              className={overlay === 'blur' ? 'bg-background/10' : 'bg-black/20'}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </AnimatePresence>
      </View>
      {open ? (
        <Pressable
          onPress={close}
          testID={`${testID}-backdrop`}
          style={backdropFrame}
          accessible={false}
          tabIndex={-1}
          aria-hidden={true}
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <View ref={controlsRef} pointerEvents="box-none" style={StyleSheet.absoluteFill} accessibilityViewIsModal={open}>
        <AnimatePresence>
          {open ? (
            <View
              key="list"
              className="absolute"
              style={{ ...anchor, bottom: panelBottom, maxHeight, width: Math.max(0, Math.min(menuWidth, frame.width - 32)) }}
            >
              <ScrollView
                nativeID={menuId}
                testID={menuTestID}
                accessibilityRole="menu"
                accessibilityLabel={title}
                tabIndex={-1}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight }}
                contentContainerClassName={position === 'bottom-left' ? 'items-start gap-2 p-1' : 'items-end gap-2 p-1'}
              >
                {items.map((item, index) => (
                  <ActionFABOption key={item.id} item={item} rank={items.length - index - 1} close={close} />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </AnimatePresence>
        {open ? (
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={closeAccessibilityLabel}
            testID={`${testID}-close`}
            className={`absolute rounded-full ${FOCUS_VISIBLE_RING}`}
            style={{ ...anchor, bottom: bottomInset, width: triggerSide, height: triggerSide }}
          />
        ) : null}
      </View>
    </View>
  );
}
