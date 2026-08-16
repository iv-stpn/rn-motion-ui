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
 * The rows are not this module's either: upstream's `MenuList` and `MenuItem` are
 * this package's {@link Menu}, which every anchored panel here fills its panel
 * with. What is left below is the surface — where it sits, how big it may get,
 * whether it scrolls — and the two things only this menu has, the scrim and the
 * lifted copy.
 *
 * The lift is a *copy* of the children painted at the measured rect while the
 * original is held invisible in place, so the item appears to rise out of the
 * page. `children` therefore renders twice — the same constraint upstream has,
 * since it clones its children into the portal.
 *
 * The scrim is upstream's `Backdrop` in two layers: on iOS an expo-blur
 * `BlurView` (via {@link HoldScrimBlur}) under the translucent dark
 * `Pressable` — the same blur-under-dim stack upstream animates; on Android
 * the dim layer alone; and on web neither, since a dropdown does not dim the
 * page behind it. See {@link HOLD_MENU_LIFTS}.
 *
 * On web there is no lift (see {@link HOLD_MENU_LIFTS}), which leaves this a
 * dropdown: an invisible click-outside scrim and the panel, anchored to the item
 * where it already sits. `children` renders once there.
 */

import { type ReactNode, useCallback, useEffect, useMemo } from 'react';
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
import { Menu } from '../../rows/menu';
import { type HoldContextMenuItem, holdMenuEntries } from './hold-context-menu-item';
import { HOLD_ITEM_SCALE, HOLD_MENU_LIST_CLASS, type HoldMenuLayout, type HoldMenuRect } from './hold-context-menu-layout';
import type { HoldContextMenuMotion } from './hold-context-menu-motion';
import { HoldScrimBlur } from './hold-scrim-blur';
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
  /**
   * Base testID. The surface takes `-panel`, the list `-menu`, and the list
   * derives its own rows from that: `-menu-item-<id>` for an action row,
   * `-menu-<id>` for a heading, `-menu-<id>-separator` for a separator.
   */
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

  const entries = useMemo(() => holdMenuEntries(items, onSelect), [items, onSelect]);

  /*
   * The list is the menu; the panel is the surface it sits on. `role="menu"`, the
   * accessible name and the testID all go on `Menu` rather than on the panel, so
   * each `menuitem` is owned directly by the element carrying that role instead
   * of reaching it through a wrapper — and so the two don't nest one menu inside
   * another. `HOLD_MENU_LIST_CLASS` is the inset: the list ships a default one,
   * and overriding it with a number this panel chose is what keeps the pre-layout
   * height estimate exact.
   */
  const list = (
    <Menu
      accessibilityLabel={accessibilityLabel}
      className={HOLD_MENU_LIST_CLASS}
      entries={entries}
      testID={testID ? `${testID}-menu` : undefined}
    />
  );

  return (
    <MotiView
      {...panelMotion}
      className={cn(
        'absolute overflow-hidden rounded-menu border border-border',
        surfaceBackground(elevation),
        elevatedShadow(elevation),
      )}
      key="hold-context-menu-panel"
      onLayout={onLayout}
      style={{
        left: layout.left,
        maxHeight: layout.maxHeight,
        top: layout.top,
        // Static, so it composes with the animated `scale` above rather than
        // competing with it: the panel grows out of the corner facing the item.
        transformOrigin: layout.transformOrigin,
        width: layout.width,
      }}
      testID={testID ? `${testID}-panel` : undefined}
    >
      {scrolls ? (
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          {list}
        </ScrollView>
      ) : (
        list
      )}
    </MotiView>
  );
}

type LiftReadyProps = { onReady?: () => void };

/**
 * Announces that the lifted copy has actually mounted.
 *
 * Rendered inside the `HOLD_MENU_LIFTS` branch of the overlay, so its effect
 * runs only when the copy subtree is in the tree. This is the trigger's
 * permission to hide: the copy lives inside the `Modal` and renders only once
 * the measured rect lands, which on Android can be a frame or two after the
 * menu opens — gating the hide on `open` alone leaves a hole where the item
 * was until the copy mounts (the remount flicker). Rendering nothing keeps
 * the tree free of an extra node.
 */
function LiftReady({ onReady }: LiftReadyProps) {
  // biome-ignore lint/plugin: the handover signal is a post-commit fact — the copy being in the tree — not something derivable during render
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
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
  /**
   * Fired once the lifted copy has actually mounted, so the trigger can hide
   * behind it without a gap. Never fired on web, where nothing lifts.
   */
  onLiftReady?: () => void;
  /** `OverlayShell`'s `onExitComplete`, fired once everything has left. */
  onExitComplete: () => void;
  onSelect: (item: HoldContextMenuItem) => void;
  onClose: () => void;
  /** Whether a press on the lifted item dismisses the menu. */
  closeOnTap: boolean;
  /**
   * Whether the trigger squeezed before this opened — i.e. the lift starts from
   * {@link HOLD_ITEM_SCALE} and springs out of it, continuing a shrink the user
   * already saw.
   *
   * False for a `'passive'` trigger, which has no press to squeeze from: starting
   * the copy at 0.95 there would be a 5% pop out of an item that never moved. The
   * lift then travels without scaling.
   */
  squeezes: boolean;
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
  onLiftReady,
  onSelect,
  onClose,
  closeOnTap,
  squeezes,
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
           * target. On iOS the blur sits inside the fading MotiView, under the
           * dim layer: upstream's `AnimatedBlurView` stack, with the `MotiView`
           * opacity fade standing in for its intensity animation (the blur and
           * the dim come up together either way). Android keeps the dim layer
           * alone — upstream gives Android the plain translucent scrim — and
           * `backdrop-blur-xs` is the web half of the blur, so web's scrim
           * paints the dim over a CSS blur.
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
            {HOLD_MENU_LIFTS ? <HoldScrimBlur /> : null}
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
            <>
              {/*
               * Mount signal for the handover: fires once this subtree is in
               * the tree, telling the trigger it may hide (after its own
               * HANDOVER_DELAY) without leaving a hole.
               */}
              <LiftReady onReady={onLiftReady} />
              <MotiView
                accessibilityElementsHidden={true}
                animate={{ scale: 1, translateY: layout.shift }}
                aria-hidden={true}
                exit={{ scale: 1, translateY: 0 }}
                exitTransition={liftExitTransition}
                from={{ scale: reduce || !squeezes ? 1 : HOLD_ITEM_SCALE, translateY: reduce ? layout.shift : 0 }}
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
            </>
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
            testID={testID}
          />
        </View>
      ) : null}
    </AnimatePresence>
  );
}
