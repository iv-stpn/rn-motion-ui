// biome-ignore-all lint/style/useExportsLast: prop types head the module and the re-export block closes it, so the public surface reads top-to-bottom
/**
 * HoldContextMenu — hold an item; it lifts off the page, the rest of the screen
 * dims, and an iOS-style action panel grows out of the corner nearest it.
 *
 * A port of [react-native-hold-menu](https://github.com/enesozturk/react-native-hold-menu)
 * (MIT, Enes Öztürk) onto this package's primitives. The interaction is the same
 * one; the machinery underneath is this library's.
 *
 * ## What changed, and why
 *
 * | Upstream | Here |
 * | --- | --- |
 * | `<HoldMenuProvider>` at app root, `@gorhom/portal` host, shared `SharedValue`s | nothing — each menu owns a `Modal` through `OverlayShell` |
 * | `expo-blur` scrim | `backdrop-blur-xs` on web, scrim alone on native (no blur dependency) |
 * | `expo-haptics` style names | `haptics` hook — `Vibration` on Android, or your own function |
 * | `items[].text`, `isTitle`, `isDestructive` | `items[].label`, `heading`, `destructive` (+ `id`, `disabled`) |
 * | `actionParams` map keyed by label | close over what you need in `onPress` |
 * | `bottom` + `menuAnchorPosition` | `side` + `align`, matching `Popover`/`AdaptiveDropdown` |
 * | `theme="light" \| "dark"` | theme tokens — follows the active scheme on its own |
 * | RNGH `LongPressGestureHandler`, UI-thread `measure()` | `Pressable` + `measureInWindow` |
 * | menu width fixed at 60% of the screen | `menuWidth`, default 240, clamped to the viewport |
 * | — | web right-click, and the keyboard/screen-reader paths a hold gesture cannot offer |
 *
 * `MENU_WIDTH`/`WINDOW_*` upstream are module constants read from `Dimensions`
 * at import time, which is wrong after a rotation; every measurement here is
 * taken per-open and every dimension comes from `useWindowDimensions`.
 *
 * ## Two interactions, one component
 *
 * The hold-and-lift is a touch idiom. A mouse already has a button that means
 * "what can I do with this", so on web the component is a context menu in the
 * ordinary sense: right-click, and a plain dropdown opens anchored to the item.
 *
 * | | Native | Web |
 * | --- | --- | --- |
 * | Gesture | hold (`activateOn`) | right-click, Shift+F10, ContextMenu key |
 * | Behind the panel | dim + blur | nothing — the page stays lit |
 * | The item | lifts, scaled, over the scrim | stays exactly where it is |
 * | Travel | item and panel move together to fit | pinned; the panel shrinks and scrolls |
 * | `children` | rendered twice (original + lifted copy) | rendered once |
 *
 * `'tap'` and `'double-tap'` read the same with a mouse, so those two keep the
 * press on web — only `'hold'` becomes the right-click. Everything else about the
 * split is {@link HOLD_MENU_LIFTS}, which is the one place the platform is
 * checked.
 *
 * @example
 * ```tsx
 * <HoldContextMenu
 *   items={[
 *     { id: 'reply', label: 'Reply', icon: MessageCircle, onPress: () => reply(message.id) },
 *     { id: 'copy', label: 'Copy', icon: Copy, onPress: () => copy(message.body), separator: true },
 *     { id: 'delete', label: 'Delete', icon: Trash2, destructive: true, onPress: () => remove(message.id) },
 *   ]}
 * >
 *   <MessageBubble message={message} />
 * </HoldContextMenu>
 * ```
 */

import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StyleProp, View, ViewStyle } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import type { SurfaceLevel } from '../../../lib/elevated';
import type { DragBehavior } from '../../gestures/drag-behavior';
import { useHoldBehavior } from '../../gestures/use-drag-behavior';
import { OverlayShell, type OverlayShellContext } from '../Overlay/overlay-shell';
import type { HoldContextMenuItem } from './hold-context-menu-item';
import { HOLD_MENU_DEFAULT_WIDTH, type HoldMenuAlign, type HoldMenuSide } from './hold-context-menu-layout';
import type { HoldContextMenuMotion } from './hold-context-menu-motion';
import { HoldContextMenuOverlay } from './hold-context-menu-overlay';
import {
  type HoldContextMenuDragOptions,
  HoldContextMenuTrigger,
  type HoldContextMenuTriggerMode,
} from './hold-context-menu-trigger';
import {
  HOLD_MENU_LIFTS,
  type HoldContextMenuActivation,
  type HoldContextMenuHaptics,
  useHoldActivation,
} from './use-hold-activation';
import { useHoldMenuLayout } from './use-hold-menu-layout';

/** Long press that opens the menu, in ms. RN's own default is 500 — too slow to feel like a menu. */
const DEFAULT_HOLD_DURATION = 300;

export type HoldContextMenuProps = {
  /**
   * The actions. An empty list makes the trigger inert — nothing to open.
   *
   * Upstream's `items`, renamed field for field: `text` → `label`, `isTitle` →
   * `heading`, `isDestructive` → `destructive`, plus `id` (React key + testID)
   * and `disabled`. `withSeparator` → `separator`.
   */
  items: readonly HoldContextMenuItem[];
  /**
   * What the user holds. On native it renders twice while the menu is open —
   * once in place, once lifted — so keep it cheap and free of its own state.
   * On web it renders once, since nothing is lifted there.
   */
  children: ReactNode;
  /**
   * How the menu is summoned.
   *
   * On web `'hold'` means right-click instead: a mouse has a button for this,
   * and holding one down to open a menu is a touch idiom. `'tap'` and
   * `'double-tap'` read the same with a pointer, so those two stay on the press
   * there. See {@link HOLD_MENU_LIFTS}.
   * @default 'hold'
   */
  activateOn?: HoldContextMenuActivation;
  /**
   * Hold before the menu opens, in ms. Sets `holdDelay` on the resolved
   * behavior; the squeeze animation fills that same window.
   * Native-only — nothing is held on web.
   * @default 300
   */
  holdDuration?: number;
  /**
   * Timing and slop overrides for the hold gesture — forwarded to
   * `<Holdable>` / `<HoldDraggable>`. Merged with `holdDuration` if given:
   * `{ holdDelay: holdDuration, ...behavior }`.
   */
  behavior?: DragBehavior;
  /**
   * Drag options that upgrade the hold gesture to a `<HoldDraggable>`.
   *
   * When provided, a move past `escapeSlop` after arming lifts a drag. The
   * hold still opens the menu, and an escape closes it before the drag takes
   * over.
   *
   * Only active on native; on web the menu is a right-click and there is no
   * gesture widget to upgrade.
   */
  dragOptions?: HoldContextMenuDragOptions;
  /**
   * Which side of the item the panel opens on. `'auto'` prefers below and flips
   * when there is more room above.
   * @default 'auto'
   */
  side?: HoldMenuSide;
  /**
   * Which edge of the item the panel aligns to. `'auto'` picks the roomier half
   * of the screen.
   * @default 'auto'
   */
  align?: HoldMenuAlign;
  /**
   * Panel width in px, clamped to the viewport.
   * @default 240
   */
  menuWidth?: number;
  /**
   * Pin the item where it is. The panel then takes the whole overflow by
   * shrinking and scrolling rather than sliding the pair up the screen.
   *
   * Always on for web's dropdown, where nothing lifts and so nothing travels.
   * @default false
   */
  disableMove?: boolean;
  /**
   * Whether a press on the lifted item dismisses the menu.
   *
   * Defaults to `true` — the iOS behaviour, and upstream's `closeOnTap` default
   * of `false` leaves the item looking pressable while doing nothing.
   *
   * Moot on web: there is no lifted copy, and the scrim over the item closes the
   * dropdown the way clicking outside any dropdown does.
   * @default true
   */
  closeOnTap?: boolean;
  /**
   * Activation feedback.
   *
   * `true` (default) buzzes for 10 ms through RN's `Vibration` on **Android
   * only** — which needs the `VIBRATE` permission, and is a no-op without it.
   * iOS and web get nothing: RN has no impact-feedback API, and
   * `Vibration.vibrate()` on iOS ignores the duration and fires a 400 ms buzz,
   * which is not what a menu opening should feel like.
   *
   * Pass a function for the real thing:
   * `haptics={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}`.
   * @default true
   */
  haptics?: HoldContextMenuHaptics;
  /**
   * Whether a web right-click opens the menu.
   *
   * This is the keyboard path too: browsers raise `contextmenu` for Shift+F10
   * and the ContextMenu key on the focused trigger. No-op on native.
   *
   * With the default `activateOn="hold"` this is the *only* way in on web, so
   * `false` there leaves the trigger with no menu at all. Pair it with
   * `activateOn="tap"` if you want to turn right-click off and keep the menu
   * reachable.
   * @default true
   */
  openOnContextMenu?: boolean;
  /**
   * Who owns the press.
   *
   * `'pressable'` (default) is the component: it wraps `children` in a
   * `Pressable`, activates on {@link HoldContextMenuProps.activateOn}, and
   * squeezes under the finger.
   *
   * `'passive'` is you. Nothing is wrapped, so no second button nests inside a
   * child that is already one and no extra tab stop lands in a long list — but
   * the trigger then has no gesture of its own, and nothing squeezes. Drive it
   * with {@link HoldContextMenuProps.open} (and, on web, either this component's
   * `contextmenu` listener or your own on {@link HoldContextMenuProps.wrapperRef}).
   * @default 'pressable'
   */
  trigger?: HoldContextMenuTriggerMode;
  /**
   * Controls whether the menu is open, making the component controlled.
   *
   * The anchor is measured when this flips true, so a host may open the menu
   * without a gesture having measured anything first. The panel paints one commit
   * later, once that measurement lands.
   *
   * Leave it out to let the trigger own the state.
   */
  open?: boolean;
  /**
   * Receives the measured wrapper — the node the panel anchors to, and on web a
   * real DOM element. Pass one to attach your own listeners to it (a `contextmenu`
   * handler that resolves items before opening, say) under
   * `trigger="passive"`.
   */
  wrapperRef?: RefObject<View | null>;
  /** Inert trigger — no activation, no menu. */
  disabled?: boolean;
  /**
   * Fires when a hold lands, right after the menu opens — one gesture, both
   * outcomes. Use it for an action that should ride the same hold, e.g. a
   * multi-select toggle that flips as the panel appears.
   *
   * To get the gesture without the panel, use `trigger="passive"` and drive the
   * controlled {@link HoldContextMenuProps.open} yourself.
   */
  onHold?: () => void;
  /** Called whenever an item is chosen, after that item's own `onPress`. */
  onSelect?: (item: HoldContextMenuItem) => void;
  /** Called when the menu opens and when it closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Float level for the panel — picks the `shadow-elevated-N` recipe.
   * @default 6
   */
  elevation?: SurfaceLevel;
  /**
   * Overrides for the open/close animation. `enter`, `exit`, `scale` and `offset`
   * are the shared anchored-menu knobs — the same four `AdaptiveDropdown`,
   * `HoverMenu` and `Popover` take, doing the same thing — plus `scrim` and `lift`
   * for the two surfaces only this menu animates.
   *
   * Reduced motion overrides all of it: the panel cross-fades in place.
   *
   * @example
   * // The iOS pop this component had before the menus were standardised.
   * motion={{ scale: 0.6, offset: 0 }}
   */
  motion?: HoldContextMenuMotion;
  /** Accessible name for the trigger. Falls back to whatever the children expose. */
  accessibilityLabel?: string;
  /**
   * Overrides the per-activation default hint on the trigger. Native only —
   * `react-native-web` has no DOM equivalent and drops it.
   */
  accessibilityHint?: string;
  /** Accessible name for the panel. @default 'Actions' */
  menuAccessibilityLabel?: string;
  /**
   * Accessible name for the scrim, which is a real button because it is the
   * dismiss control that needs no pointer.
   * @default 'Close menu'
   */
  closeAccessibilityLabel?: string;
  /** Merged onto the trigger wrapper — e.g. `"max-w-[80%] self-end"` for a chat bubble. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Base testID for the trigger wrapper. Everything the menu mounts derives from
   * it, so one `testID` here is enough to reach any part of an open menu:
   *
   * | Suffix | Element |
   * | --- | --- |
   * | *(none)* | the trigger wrapper, in the page |
   * | `-backdrop` | the scrim — the click-outside target |
   * | `-lifted` | the copy of the children painted at the item's rect (native only) |
   * | `-panel` | the floating surface |
   * | `-menu` | the list inside it |
   * | `-menu-item-<id>` | one action row, by its item `id` |
   * | `-menu-<id>` | a `heading` row |
   * | `-menu-<id>-separator` | the band a row's `separator` draws below it |
   */
  testID?: string;
};

/**
 * Tracks whether the in-place item is currently hidden behind its lifted copy,
 * and resets layout state when the exit animation finishes.
 *
 * Extracted so its `useState`/`useEffect` lines do not count toward
 * `HoldContextMenu`'s line limit.
 */
function useLiftedState(open: boolean, clearRect: () => void, resetMenuHeight: () => void) {
  const [lifted, setLifted] = useState(false);

  // biome-ignore lint/plugin: the handover has to land in a later commit than the one that opens the Modal — a value derived during render is by definition the same commit
  useEffect(() => {
    if (open && HOLD_MENU_LIFTS) setLifted(true);
  }, [open]);

  const handleAfterClose = useCallback(() => {
    setLifted(false);
    resetMenuHeight();
    clearRect();
  }, [clearRect, resetMenuHeight]);

  return { lifted, handleAfterClose };
}

export function HoldContextMenu({
  items,
  children,
  activateOn = 'hold',
  holdDuration = DEFAULT_HOLD_DURATION,
  behavior,
  dragOptions,
  side = 'auto',
  align = 'auto',
  menuWidth = HOLD_MENU_DEFAULT_WIDTH,
  disableMove = false,
  closeOnTap = true,
  haptics = true,
  openOnContextMenu = true,
  disabled = false,
  onHold: onHoldProp,
  onSelect,
  onOpenChange,
  open: openProp,
  trigger = 'pressable',
  wrapperRef: wrapperRefProp,
  elevation = 6,
  motion,
  accessibilityLabel,
  accessibilityHint,
  menuAccessibilityLabel = 'Actions',
  closeAccessibilityLabel = 'Close menu',
  className,
  style,
  testID,
}: HoldContextMenuProps) {
  const reduce = useReducedMotion();
  const ownWrapperRef = useRef<View | null>(null);
  // The host's ref when it passed one, so it can reach the same node this
  // measures — see the `wrapperRef` prop.
  const wrapperRef = wrapperRefProp ?? ownWrapperRef;

  // `holdDelay` is always pinned to `holdDuration`: this component is named for
  // the hold, so when it owns the gesture the hold must exist on every platform
  // — including a draggable trigger on mobile web, where the *drag* tuning
  // defaults `holdDelay` to `null` and a `<HoldDraggable>` would otherwise
  // never fire it. `behavior` spreads on top, so an explicit `holdDelay` (or
  // any other override) from the host still wins.
  const holdBehavior = useMemo<DragBehavior>(() => ({ holdDelay: holdDuration, ...behavior }), [behavior, holdDuration]);
  const tuning = useHoldBehavior(holdBehavior);
  // Squeeze starts when `isPressed` fires (at armDelay) and ends when the hold
  // fires (at holdDelay) — so the animation duration is exactly the gap.
  const squeezeDuration = (tuning.holdDelay ?? DEFAULT_HOLD_DURATION) - tuning.armDelay;

  const { rect, open, pressed, close, clearRect, onAccessibilityAction, onHold, onPress, onPressIn, onPressOut } =
    useHoldActivation({
      activateOn,
      enabled: !disabled && items.length > 0,
      haptics,
      afterHold: onHoldProp,
      onOpenChange,
      open: openProp,
      openOnContextMenu,
      wrapperRef,
    });

  const { layout, menuHeight, onMenuHeight, resetMenuHeight } = useHoldMenuLayout({
    align,
    // Travel only makes sense for something that left the page. A dropdown stays
    // put and takes the overflow by shrinking, so web is always pinned.
    disableMove: disableMove || !HOLD_MENU_LIFTS,
    items,
    menuWidth,
    rect,
    side,
  });

  const { lifted, handleAfterClose } = useLiftedState(open, clearRect, resetMenuHeight);

  const handleSelect = useCallback(
    (item: HoldContextMenuItem) => {
      // Close first: the panel starts leaving while the action runs, and an
      // action that navigates does not leave a modal stranded on the old screen.
      close();
      item.onPress?.();
      onSelect?.(item);
    },
    [close, onSelect],
  );

  return (
    <>
      <HoldContextMenuTrigger
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        activateOn={activateOn}
        behavior={holdBehavior}
        className={className}
        disabled={disabled}
        dragOptions={dragOptions}
        holdDuration={squeezeDuration}
        lifted={lifted}
        mode={trigger}
        onAccessibilityAction={onAccessibilityAction}
        onHold={onHold}
        onHoldEscape={close}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        open={open}
        pressed={pressed}
        reduce={reduce}
        style={style}
        testID={testID}
        wrapperRef={wrapperRef}
      >
        {children}
      </HoldContextMenuTrigger>

      <OverlayShell accessibilityLabel={menuAccessibilityLabel} onAfterClose={handleAfterClose} onClose={close} open={open}>
        {({ open: animating, onExitComplete }: OverlayShellContext) =>
          // `rect` and `layout` are set together and cleared only once the exit
          // completes, so this never null-checks away a live overlay.
          layout && rect ? (
            <HoldContextMenuOverlay
              closeAccessibilityLabel={closeAccessibilityLabel}
              closeOnTap={closeOnTap}
              elevation={elevation}
              items={items}
              layout={layout}
              menuAccessibilityLabel={menuAccessibilityLabel}
              menuHeight={menuHeight}
              motion={motion}
              onClose={close}
              onExitComplete={onExitComplete}
              onMenuHeight={onMenuHeight}
              onSelect={handleSelect}
              open={animating}
              rect={rect}
              reduce={reduce}
              squeezes={trigger !== 'passive' && HOLD_MENU_LIFTS}
              testID={testID}
            >
              {children}
            </HoldContextMenuOverlay>
          ) : null
        }
      </OverlayShell>
    </>
  );
}

export type { HoldContextMenuIcon, HoldContextMenuItem } from './hold-context-menu-item';
export type {
  HoldMenuAlign,
  HoldMenuInsets,
  HoldMenuLayout,
  HoldMenuRect,
  HoldMenuSide,
  HoldMenuViewport,
} from './hold-context-menu-layout';
export type { HoldContextMenuMotion } from './hold-context-menu-motion';
export type { HoldContextMenuDragOptions, HoldContextMenuTriggerMode } from './hold-context-menu-trigger';
export type { HoldContextMenuActivation, HoldContextMenuHaptics } from './use-hold-activation';
