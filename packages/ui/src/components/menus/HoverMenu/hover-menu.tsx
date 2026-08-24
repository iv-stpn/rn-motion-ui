// biome-ignore-all lint/style/noExcessiveLinesPerFile: cross-platform hover menu — web DOM helpers, positioning math, and dual-platform render collocated in one module

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Modal, Platform, Pressable, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { useHoverCapable } from '../../../hooks/use-hover-capable';
import { useModalRender } from '../../../hooks/use-modal-render';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import type { SurfaceElevation } from '../../../lib/elevated';
import { surface } from '../../../lib/surface';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { type MenuMotion, menuTransformOrigin, resolveMenuMotion } from '../../../theme/motion';
import { OverlayBlur } from '../Overlay/overlay-blur';
import { OverlayOutlet } from '../Overlay/overlay-portal';

const DEFAULT_WIDTH = 200;
const DEFAULT_OFFSET = 4;
const DEFAULT_OPEN_DELAY = 100;
const DEFAULT_CLOSE_DELAY = 150;
const VIEWPORT_PADDING = 8;
const OPENING_GUARD_MS = 1000;

type Rect = { x: number; y: number; w: number; h: number };
type PanelSize = { w: number; h: number };
type TriggerRenderProps = { open: boolean; toggle: () => void };
type MenuContentRenderProps = { close: () => void };

// biome-ignore lint/style/useExportsLast: type collocated with the render-prop types above; the component export follows at the end of the file
export type HoverMenuProps = {
  /**
   * The element that opens the menu. On web it opens on hover; on every platform
   * it toggles on press. A plain node is wrapped in a Pressable that toggles it.
   * Pass a function to receive `{ open, toggle }` — use this when the trigger is
   * itself pressable (e.g. a `Button`): wire its `onPress` to `toggle`, since the
   * inner pressable claims the press and the wrapper's own toggle never fires.
   * Hover still reaches the wrapper either way, so web hover-open is unaffected.
   */
  trigger: ReactNode | ((props: TriggerRenderProps) => ReactNode);
  /**
   * Set when the trigger is pressable in its own right (a `Button`, a
   * `Pressable`). The wrapper then drops its own button semantics — role and
   * `aria-expanded` — so the two don't nest, which is invalid DOM on web and a
   * doubled-up accessibility node on native. Hover still lives on the wrapper,
   * so web hover-open is unaffected; wire the trigger's `onPress` to the
   * render prop's `toggle` to keep press working. @default false
   */
  triggerIsPressable?: boolean;
  /** Content rendered inside the floating panel. As a render prop receives `{ close }`. */
  children: ReactNode | ((props: MenuContentRenderProps) => ReactNode);
  /** Controls visibility from outside. If omitted, the menu manages its own open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerAccessibilityLabel?: string;
  /** Which edge of the trigger the panel is aligned to. @default 'start' */
  align?: 'start' | 'end';
  /** Panel width in pixels, or 'trigger' to use the trigger's measured width as a minimum. @default 200 */
  width?: number | 'trigger';
  /** Vertical gap between the trigger and the panel. @default 4 */
  offset?: number;
  /** Hover-open delay in ms (web only). @default 100 */
  openDelay?: number;
  /** Hover-close delay in ms (web only). @default 150 */
  closeDelay?: number;
  contentClassName?: string;
  /** Float level for the panel — picks the `shadow-elevated-N` recipe (drop + dark rim). `0` is the flat resting surface (no shadow or border). @default 5 */
  elevation?: SurfaceElevation;
  /**
   * Overrides the shared open/close animation — the same `motion` prop
   * `AdaptiveDropdown` and `Popover` take, so a consumer can
   * retune every menu in an app from one object. Partial: name one field and the
   * rest of the preset stands.
   *
   * Reduced motion overrides all of it: the panel cross-fades in place.
   *
   * @example
   * motion={{ enter: { stiffness: 420 }, offset: 16 }}
   */
  motion?: MenuMotion;
  testID?: string;
  /**
   * When false, the dimming backdrop is not rendered behind the panel (native
   * only — a web hover menu has no overlay by design, since one would cover the
   * trigger and break hover continuity). Defaults to true.
   */
  overlay?: boolean;
  /** When false, pressing outside the panel will not close it. Defaults to true. */
  closeOnOutsidePress?: boolean;
};

// Minimal web-only DOM types — the RN package tsconfig omits the DOM lib, so the
// browser pointer/keyboard globals aren't declared here. Mirrors the WebNode
// approach in WheelPicker/SwipeableList (Reflect.get + a typeof guard, no cast).
type WebNode = { contains: (node: unknown) => boolean };
type WebPointerEvent = { target: unknown };
type WebKeyEvent = { key: string };
type WebFocusEvent = { target: unknown; relatedTarget: unknown };
type WebDocument = {
  addEventListener: {
    (type: 'pointerdown', listener: (event: WebPointerEvent) => void): void;
    (type: 'keydown', listener: (event: WebKeyEvent) => void): void;
    (type: 'focusout', listener: (event: WebFocusEvent) => void): void;
  };
  removeEventListener: {
    (type: 'pointerdown', listener: (event: WebPointerEvent) => void): void;
    (type: 'keydown', listener: (event: WebKeyEvent) => void): void;
    (type: 'focusout', listener: (event: WebFocusEvent) => void): void;
  };
};

function isWebNode(node: unknown): node is WebNode {
  return node !== null && typeof node === 'object' && typeof Reflect.get(node, 'contains') === 'function';
}

function isWebDocument(value: unknown): value is WebDocument {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof Reflect.get(value, 'addEventListener') === 'function' &&
    typeof Reflect.get(value, 'removeEventListener') === 'function'
  );
}

function getWebDocument(): WebDocument | undefined {
  if (Platform.OS !== 'web') return;
  const doc = Reflect.get(globalThis, 'document');
  return isWebDocument(doc) ? doc : undefined;
}

const OVERLAY_STYLE = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
const POSITION_ABSOLUTE = { position: 'absolute' as const };
// react-native-web maps `position: 'fixed'` to CSS fixed so the panel escapes
// overflow ancestors without a portal; the value isn't in RN's LayoutPosition
// union, so the web-only style is cast. (Modal can't be used on web here: its
// fixed full-viewport container would cover the trigger and break hover.)
// biome-ignore lint/plugin: 'fixed' is honoured by react-native-web but absent from RN's LayoutPosition union, so the web-only style is cast
const WEB_PANEL_POSITION = { position: 'fixed' } as unknown as ViewStyle;

type PanelLayout = { left: number; top: number; openAbove: boolean; panelWidth: number; measured: boolean };

type ComputePanelLayoutOptions = {
  rect: Rect | null;
  panelSize: PanelSize;
  viewportWidth: number;
  viewportHeight: number;
  align: 'start' | 'end';
  offset: number;
  width: number | 'trigger';
};

// Pure geometry for the floating panel: clamps it to the viewport and flips it
// above the trigger when it wouldn't fit below. Pulled out of the component so
// the math is testable and the render stays readable. The slide direction that
// follows from `openAbove` is `resolveMenuMotion`'s job.
function computePanelLayout(options: ComputePanelLayoutOptions): PanelLayout {
  const { rect, panelSize, viewportWidth, viewportHeight, align, offset, width } = options;
  const triggerWidth = rect === null ? DEFAULT_WIDTH : rect.w;
  const panelWidth = width === 'trigger' ? triggerWidth : width;
  const panelH = panelSize.h;
  const measured = rect !== null && panelSize.w > 0 && panelSize.h > 0;

  let left = 0;
  let top = 0;
  let openAbove = false;
  if (rect) {
    const anchoredLeft = align === 'end' ? rect.x + rect.w - panelWidth : rect.x;
    const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - panelWidth - VIEWPORT_PADDING);
    left = Math.min(Math.max(anchoredLeft, VIEWPORT_PADDING), maxLeft);
    const spaceBelow = viewportHeight - (rect.y + rect.h) - offset - VIEWPORT_PADDING;
    const spaceAbove = rect.y - offset - VIEWPORT_PADDING;
    openAbove = panelH > 0 && panelH > spaceBelow && spaceAbove > spaceBelow;
    const rawTop = openAbove ? rect.y - offset - panelH : rect.y + rect.h + offset;
    const maxTop = Math.max(VIEWPORT_PADDING, viewportHeight - panelH - VIEWPORT_PADDING);
    top = Math.min(Math.max(rawTop, VIEWPORT_PADDING), maxTop);
  }

  return { left, top, openAbove, panelWidth, measured };
}

const handlePanelPress = () => undefined;

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: positioning, hover timers, and dual-platform render are collocated around shared refs/state
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the overlay/outside-press branches add two decision points to a component already at the threshold
export function HoverMenu({
  trigger,
  triggerIsPressable = false,
  children,
  open: openProp,
  onOpenChange,
  triggerAccessibilityLabel,
  align = 'start',
  width = DEFAULT_WIDTH,
  offset = DEFAULT_OFFSET,
  openDelay = DEFAULT_OPEN_DELAY,
  closeDelay = DEFAULT_CLOSE_DELAY,
  contentClassName,
  elevation = 5,
  motion,
  testID,
  overlay = true,
  closeOnOutsidePress = true,
}: HoverMenuProps) {
  const canHover = useHoverCapable();
  const reduce = useReducedMotion();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const triggerRef = useRef<View>(null);
  const panelRef = useRef<View>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openingRef = useRef(false);

  const [internalOpen, setInternalOpen] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [panelSize, setPanelSize] = useState<PanelSize>({ w: 0, h: 0 });

  const controlled = openProp !== undefined;
  const open = controlled ? openProp : internalOpen;
  // Mirror `open` into a ref so the hover handlers can read the current value
  // without closing over it — see handleHoverOut for why that matters.
  const openRef = useRef(open);
  openRef.current = open;
  const { rendered, onExitComplete } = useModalRender(open);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);

  const measure = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, w, h) =>
      // Same-value bail as handlePanelLayout: the open path measures and the
      // open-effect measures again, so an unconditional setRect would re-render
      // twice per open for an identical rect.
      setRect((prev) => (prev && prev.x === x && prev.y === y && prev.w === w && prev.h === h ? prev : { x, y, w, h })),
    );
  }, []);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // Hover open/close shared by the trigger and the panel so moving the pointer
  // between them never trips the close: entering either cancels a pending close
  // (and opens if still closed); leaving either cancels a pending open and
  // schedules a close. `onPress` (toggle) clears both timers first so a click and
  // a queued hover never fight over the same state.
  //
  // These are wired to `onPointerEnter`/`onPointerLeave` — the raw DOM events —
  // and NOT to Pressable's `onHoverIn`/`onHoverOut`. react-native-web implements
  // those via `useHover({ contain: true })`, which dispatches a bubbling
  // `react-gui:hover:lock` custom event on enter and ends the hover of any
  // ancestor whose own lock listener sees a different target. Every nested
  // Pressable therefore cancels its ancestors' hover:
  //
  //   - Trigger: a pressable trigger (a `Button`) inside the wrapper fired the
  //     lock as the pointer reached it, so the wrapper's hover ended immediately
  //     after starting. `handleHoverOut` cleared the pending open timer and the
  //     menu never opened on hover at all — only on press.
  //   - Panel: `MenuItem` is a Pressable too, so moving onto an item ended the
  //     panel's hover and scheduled a close while the pointer was still inside.
  //
  // `pointerenter`/`pointerleave` have exactly the semantics wanted here: they
  // fire once for the element-plus-descendants region and ignore movement between
  // children, so a nested pressable is invisible to them. RNW forwards both props
  // straight to the DOM node (`forwardedProps.clickProps`), and they are part of
  // RN's own `ViewProps`, so this stays type-safe and is inert on native — where
  // it never runs anyway, since `canHover` gates it.
  //
  // These read `open` from `openRef` rather than the closure, and keep a stable
  // identity across open changes, so a listener captured at enter time can never
  // act on a stale value.
  const handleHoverIn = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (openRef.current || openTimerRef.current) return;
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      measure();
      setOpen(true);
    }, openDelay);
  }, [measure, setOpen, openDelay]);

  const handleHoverOut = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (!openRef.current || closeTimerRef.current) return;
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, closeDelay);
  }, [setOpen, closeDelay]);

  const toggle = useCallback(() => {
    if (open && openingRef.current) return;
    clearTimers();
    if (!open) measure();
    setOpen(!open);
  }, [open, measure, setOpen, clearTimers]);

  // Clear hover timers on unmount so a pending open/close can't fire after teardown.
  useMountEffect(() => () => clearTimers());

  // Measure whenever the menu opens. Hover and press already measure on their way
  // through, but a *controlled* consumer can flip `open` to true on its own (a
  // switch, a keyboard shortcut, a route change) and never touch either path — the
  // panel renders only `open && rect`, so without this it stayed invisible until
  // something else happened to measure. Re-measuring on every open is also the
  // correct thing anyway: the trigger may have moved since the last one.
  // biome-ignore lint/plugin: measuring a host node via measureInWindow is an imperative side effect keyed on open state
  useEffect(() => {
    if (open) measure();
  }, [open, measure]);

  // Arm the opening guard while the enter animation runs so a trigger click can't
  // toggle the menu straight back to closed (blur/Escape/outside-click still close
  // — they call `close`, not `toggle`). MotiView's `onDidAnimate` clears it when
  // the open animation finishes; the timeout is a fallback if that callback never
  // fires. Skipped under reduced motion (no animation to protect, and the 0ms
  // tween's callback could fire before this arms, leaving the guard stuck on).
  // biome-ignore lint/plugin: arming/clearing an animation-guard ref is a side effect keyed on open state
  useEffect(() => {
    if (!open || reduce) {
      openingRef.current = false;
      return;
    }
    openingRef.current = true;
    const fallback = setTimeout(() => {
      openingRef.current = false;
    }, OPENING_GUARD_MS);
    return () => clearTimeout(fallback);
  }, [open, reduce]);

  // Web outside-dismiss: no transparent overlay (it would cover the trigger and
  // break hover continuity), so listen on document for pointerdown outside the
  // trigger+panel, for Escape, and for focus leaving the group (blur). Native
  // dismisses via the overlay + hardware back (Modal `onRequestClose`).
  // biome-ignore lint/plugin: document-level pointerdown/keydown/focusout listeners can't be expressed as RN event handlers or derived state
  useEffect(() => {
    if (!(canHover && open && closeOnOutsidePress)) return;
    const doc = getWebDocument();
    if (!doc) return;

    const onPointerDown = (event: WebPointerEvent) => {
      const triggerNode = triggerRef.current;
      const panelNode = panelRef.current;
      const target = event.target;
      if ((isWebNode(triggerNode) && triggerNode.contains(target)) || (isWebNode(panelNode) && panelNode.contains(target)))
        return;
      close();
    };
    const onKeyDown = (event: WebKeyEvent) => {
      if (event.key === 'Escape') close();
    };
    // Close on blur — but only when focus actually leaves the menu. `focusout`
    // bubbles and carries `relatedTarget` (the next focus target, null when focus
    // leaves the page), so a within-menu move (trigger → item) keeps
    // `relatedTarget` inside the group and is ignored; a real blur (Tab away, or
    // focus moving outside) closes. No timer needed.
    const onFocusOut = (event: WebFocusEvent) => {
      const triggerNode = triggerRef.current;
      const panelNode = panelRef.current;
      const target = event.target;
      const targetInside =
        (isWebNode(triggerNode) && triggerNode.contains(target)) || (isWebNode(panelNode) && panelNode.contains(target));
      if (!targetInside) return;
      const related = event.relatedTarget;
      const relatedInside =
        related !== null &&
        ((isWebNode(triggerNode) && triggerNode.contains(related)) || (isWebNode(panelNode) && panelNode.contains(related)));
      if (relatedInside) return;
      close();
    };

    doc.addEventListener('pointerdown', onPointerDown);
    doc.addEventListener('keydown', onKeyDown);
    doc.addEventListener('focusout', onFocusOut);
    return () => {
      doc.removeEventListener('pointerdown', onPointerDown);
      doc.removeEventListener('keydown', onKeyDown);
      doc.removeEventListener('focusout', onFocusOut);
    };
  }, [canHover, open, close, closeOnOutsidePress]);

  const handlePanelLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: lw, height: lh } = event.nativeEvent.layout;
    setPanelSize((prev) => (prev.w === lw && prev.h === lh ? prev : { w: lw, h: lh }));
  }, []);

  // Clear the opening guard once the enter animation finishes (opacity settles at
  // 1 — the `value === 1` check ignores the pre-measure opacity 0→0 no-op). After
  // this, a trigger click can toggle the menu closed again.
  const handleDidAnimate = useCallback((styleProp: string, finished: boolean, value: unknown) => {
    if (styleProp === 'opacity' && finished && value === 1) openingRef.current = false;
  }, []);

  const { left, top, openAbove, panelWidth, measured } = computePanelLayout({
    rect,
    panelSize,
    viewportWidth,
    viewportHeight,
    align,
    offset,
    width,
  });

  // Shared with AdaptiveDropdown and Popover, so every panel
  // this package anchors to a trigger opens and closes the same way.
  const side = openAbove ? 'top' : 'bottom';
  const panelMotion = resolveMenuMotion({ motion, reduce, side });
  const transformOrigin = menuTransformOrigin({ align, side });

  const resolvedTrigger = typeof trigger === 'function' ? trigger({ open, toggle }) : trigger;
  const resolvedContent = typeof children === 'function' ? children({ close }) : children;

  // The wrapper only claims button semantics when it is the thing being pressed.
  // A trigger that is pressable in its own right already carries the role, the
  // label, the expanded state and the tab stop, so the wrapper steps back to a
  // plain hover/measure box — otherwise web gets a <button> inside a <button>
  // and keyboard users get two tab stops for one control.
  const wrapperSemantics = triggerIsPressable
    ? ({ tabIndex: -1 } as const)
    : ({
        accessibilityRole: 'button',
        accessibilityLabel: triggerAccessibilityLabel,
        'aria-expanded': open,
        onPress: toggle,
      } as const);

  const panel =
    open && rect ? (
      <Pressable
        key="hover-menu-panel"
        ref={panelRef}
        onPress={handlePanelPress}
        onLayout={handlePanelLayout}
        onPointerEnter={canHover ? handleHoverIn : undefined}
        onPointerLeave={canHover ? handleHoverOut : undefined}
        style={[
          canHover ? WEB_PANEL_POSITION : POSITION_ABSOLUTE,
          { left, top, ...(width === 'trigger' ? { minWidth: panelWidth } : { width: panelWidth }), zIndex: 50 },
        ]}
        testID={testID ? `${testID}-panel` : undefined}
      >
        <MotiView
          {...panelMotion}
          // Held at 0 until the panel has been measured, so it is never painted
          // at an unresolved position. Scale is gated alongside opacity — otherwise
          // the scale animation completes invisibly and the panel pops at full size.
          animate={{ ...panelMotion.animate, opacity: measured ? 1 : 0, scale: measured ? 1 : panelMotion.from.scale }}
          onDidAnimate={handleDidAnimate}
          className={cn(
            'z-50 overflow-hidden',

            surface(elevation, 'menu'),
            contentClassName,
          )}
          // Static, so it composes with the animated scale rather than competing
          // with it: the panel grows out of the corner facing the trigger.
          style={{ transformOrigin }}
        >
          {resolvedContent}
        </MotiView>
      </Pressable>
    ) : null;

  return (
    <>
      {/* Stays a Pressable even when the trigger owns the press: hover lives here so
          web hover-open keeps working, and this is the box we measure to position the
          panel. What it gives up is its interactive identity — see wrapperSemantics. */}
      <Pressable
        ref={triggerRef}
        collapsable={false}
        {...wrapperSemantics}
        onPointerEnter={canHover ? handleHoverIn : undefined}
        onPointerLeave={canHover ? handleHoverOut : undefined}
        testID={testID}
      >
        {resolvedTrigger}
      </Pressable>

      {canHover ? (
        <AnimatePresence onExitComplete={onExitComplete}>{panel}</AnimatePresence>
      ) : (
        <Modal visible={rendered} transparent={true} animationType="none" statusBarTranslucent={true} onRequestClose={close}>
          {overlay ? (
            <View pointerEvents="none" style={OVERLAY_STYLE}>
              <OverlayBlur />
              <View className="absolute inset-0 bg-black/20" />
            </View>
          ) : null}
          <Pressable onPress={closeOnOutsidePress ? close : undefined} style={OVERLAY_STYLE} />
          <AnimatePresence onExitComplete={onExitComplete}>{panel}</AnimatePresence>
          {/* Overlay outlet: native path only — web uses fixed-position in one document. */}
          <OverlayOutlet />
        </Modal>
      )}
    </>
  );
}
