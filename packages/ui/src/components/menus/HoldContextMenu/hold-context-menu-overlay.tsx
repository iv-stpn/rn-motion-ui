// biome-ignore-all lint/style/useExportsLast: prop types sit with the components they belong to
/**
 * What `HoldContextMenu` mounts while the item is held: a scrim, the held item
 * lifted out of the layout at its measured window rect, and the action panel.
 *
 * Ported from react-native-hold-menu's `HoldItem` portal, `menu/Menu.tsx`,
 * `menu/MenuList.tsx` and `backdrop/Backdrop.tsx`, which upstream are four
 * components wired through a provider and a `@gorhom/portal` host. Here they are
 * one subtree inside the `Modal` that `OverlayShell` already opens, so no
 * provider is needed and no shared `SharedValue` has to be threaded between the
 * item and the panel.
 *
 * The lift is a *copy* of the children painted at the measured rect while the
 * original is held invisible in place, so the item appears to rise out of the
 * page. `children` therefore renders twice — the same constraint upstream has,
 * since it clones its children into the portal.
 *
 * On web there is no lift (see {@link HOLD_MENU_LIFTS}), which leaves this a
 * dropdown: an invisible click-outside scrim and the panel, anchored to the item
 * where it already sits. `children` renders once there.
 */

import { type ReactNode, useCallback } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { cn } from '../../../lib/cn';
import { elevatedShadow, type SurfaceLevel, surfaceBackground } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import {
  MENU_EXIT_TRANSITION,
  MENU_SCRIM_TRANSITION,
  MOTION_STANDARD,
  mergeTransition,
  resolveMenuMotion,
  TIMING_FAST,
} from '../../../theme/motion';
import { HOLD_ITEM_SCALE, type HoldMenuLayout, type HoldMenuRect } from './hold-context-menu-layout';
import type { HoldContextMenuMotion } from './hold-context-menu-motion';
import { type HoldContextMenuItem, HoldContextMenuRow, HoldContextMenuSeparator } from './hold-context-menu-row';
import { HOLD_MENU_LIFTS } from './use-hold-activation';

type PanelProps = {
  items: readonly HoldContextMenuItem[];
  layout: HoldMenuLayout;
  /** Natural panel height, estimated then corrected — decides whether it scrolls. */
  menuHeight: number;
  elevation: SurfaceLevel;
  motion?: HoldContextMenuMotion;
  reduce: boolean;
  accessibilityLabel: string;
  onSelect: (item: HoldContextMenuItem) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  testID?: string;
};

function HoldContextMenuPanel({
  items,
  layout,
  menuHeight,
  elevation,
  motion,
  reduce,
  accessibilityLabel,
  onSelect,
  onLayout,
  testID,
}: PanelProps) {
  const scrolls = menuHeight > layout.maxHeight;
  // The same open/close every other anchored menu in the package uses. `shift` is
  // the travel that keeps the pair on screen, so it is where the panel *rests* —
  // the slide is applied on top of it rather than replacing it.
  const panelMotion = resolveMenuMotion({ motion, reduce, restingTranslateY: layout.shift, side: layout.side });

  const rows = items.map((item, index) => (
    <View key={item.id}>
      <HoldContextMenuRow
        isLast={index === items.length - 1}
        item={item}
        onSelect={onSelect}
        testID={testID ? `${testID}-item-${item.id}` : undefined}
      />
      {item.separator && index < items.length - 1 ? <HoldContextMenuSeparator /> : null}
    </View>
  ));

  return (
    <MotiView
      {...panelMotion}
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
      className={cn(
        'absolute overflow-hidden rounded-2xl border border-border',
        surfaceBackground(elevation),
        elevatedShadow(elevation),
      )}
      key="hold-context-menu-panel"
      onLayout={onLayout}
      role="menu"
      style={{
        left: layout.left,
        maxHeight: layout.maxHeight,
        top: layout.top,
        // Static, so it composes with the animated `scale` above rather than
        // competing with it: the panel grows out of the corner facing the item.
        transformOrigin: layout.transformOrigin,
        width: layout.width,
      }}
      testID={testID}
    >
      {scrolls ? (
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          {rows}
        </ScrollView>
      ) : (
        rows
      )}
    </MotiView>
  );
}

export type HoldContextMenuOverlayProps = {
  items: readonly HoldContextMenuItem[];
  /** A second copy of the trigger's children, painted at `rect`. Unused on web. */
  children: ReactNode;
  /** Measured window rect of the held item. Where the lifted copy is painted. */
  rect: HoldMenuRect;
  layout: HoldMenuLayout;
  /** Panel height the layout was resolved from. */
  menuHeight: number;
  /**
   * Reports the panel's real height once laid out, so a row that wrapped (large
   * accessibility font, long label) corrects the estimate the layout ran on.
   */
  onMenuHeight: (height: number) => void;
  /** Drives the enter/exit animations — `OverlayShell`'s `open`. */
  open: boolean;
  /** `OverlayShell`'s `onExitComplete`, fired once everything has left. */
  onExitComplete: () => void;
  onSelect: (item: HoldContextMenuItem) => void;
  onClose: () => void;
  /** Whether a press on the lifted item dismisses the menu. */
  closeOnTap: boolean;
  elevation: SurfaceLevel;
  /** Panel / scrim / lift transition overrides. */
  motion?: HoldContextMenuMotion;
  reduce: boolean;
  closeAccessibilityLabel: string;
  menuAccessibilityLabel: string;
  testID?: string;
};

export function HoldContextMenuOverlay({
  items,
  children,
  rect,
  layout,
  menuHeight,
  onMenuHeight,
  open,
  onExitComplete,
  onSelect,
  onClose,
  closeOnTap,
  elevation,
  motion,
  reduce,
  closeAccessibilityLabel,
  menuAccessibilityLabel,
  testID,
}: HoldContextMenuOverlayProps) {
  const handlePanelLayout = useCallback(
    (event: LayoutChangeEvent) => onMenuHeight(event.nativeEvent.layout.height),
    [onMenuHeight],
  );

  const scrimTransition = mergeTransition(MENU_SCRIM_TRANSITION, motion?.scrim);
  // The lift arrives on the panel's own enter transition, so the item and the
  // panel it belongs to move as one thing. It leaves on the panel's exit for the
  // same reason — and because `AnimatePresence` holds the Modal mounted until the
  // slowest child has left, so a lift that springs while the panel tweens would
  // be the thing deciding how long the close takes.
  const liftTransition = reduce ? TIMING_FAST : mergeTransition(MOTION_STANDARD, motion?.lift ?? motion?.enter);
  const liftExitTransition = reduce ? TIMING_FAST : mergeTransition(MENU_EXIT_TRANSITION, motion?.exit);

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {open ? (
        <View className="flex-1" key="hold-context-menu-overlay">
          {/*
           * Scrim. Also the only dismiss control reachable without a pointer —
           * the hold gesture has no keyboard or screen-reader equivalent — so it
           * carries a real button role and name rather than being a bare tap
           * target. `backdrop-blur-xs` is the web half of upstream's BlurView;
           * native gets the scrim alone, since this package has no blur
           * dependency.
           *
           * Web gets neither: it is a dropdown there, and a dropdown does not
           * dim the page behind it. The scrim stays — invisible, full-bleed, and
           * still the click-outside target every menu needs.
           */}
          <MotiView
            animate={{ opacity: 1 }}
            className={cn(HOLD_MENU_LIFTS && 'backdrop-blur-xs')}
            exit={{ opacity: 0 }}
            from={{ opacity: 0 }}
            style={StyleSheet.absoluteFill}
            transition={scrimTransition}
          >
            <Pressable
              accessibilityLabel={closeAccessibilityLabel}
              accessibilityRole="button"
              className={cn('flex-1', HOLD_MENU_LIFTS && 'bg-black/35')}
              onPress={onClose}
              testID={testID ? `${testID}-backdrop` : undefined}
            />
          </MotiView>

          {/*
           * The lift. Hidden from assistive tech: it is a duplicate of the
           * trigger, which is still in the tree behind the modal, and announcing
           * both would offer the same thing twice.
           *
           * Absent on web, where nothing lifts — so `children` renders once
           * there, and a trigger wrapping something expensive pays for it once.
           */}
          {HOLD_MENU_LIFTS ? (
            <MotiView
              accessibilityElementsHidden={true}
              animate={{ scale: 1, translateY: layout.shift }}
              aria-hidden={true}
              exit={{ scale: 1, translateY: 0 }}
              exitTransition={liftExitTransition}
              from={{ scale: reduce ? 1 : HOLD_ITEM_SCALE, translateY: reduce ? layout.shift : 0 }}
              importantForAccessibility="no-hide-descendants"
              style={{ height: rect.height, left: rect.x, position: 'absolute', top: rect.y, width: rect.width }}
              testID={testID ? `${testID}-lifted` : undefined}
              transition={liftTransition}
            >
              {children}
              {/*
               * Swallows presses on the copy so they never reach whatever the
               * children render, which is live but no longer where the user
               * thinks it is. With `closeOnTap` it dismisses; without, it
               * absorbs.
               */}
              <Pressable onPress={closeOnTap ? onClose : undefined} style={StyleSheet.absoluteFill} />
            </MotiView>
          ) : null}

          <HoldContextMenuPanel
            accessibilityLabel={menuAccessibilityLabel}
            elevation={elevation}
            items={items}
            layout={layout}
            menuHeight={menuHeight}
            motion={motion}
            onLayout={handlePanelLayout}
            onSelect={onSelect}
            reduce={reduce}
            testID={testID ? `${testID}-menu` : undefined}
          />
        </View>
      ) : null}
    </AnimatePresence>
  );
}
