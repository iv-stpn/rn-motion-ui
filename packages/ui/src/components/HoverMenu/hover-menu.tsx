// biome-ignore lint/style/noExcessiveLinesPerFile: cross-platform hover menu — web DOM helpers, positioning math, and dual-platform render collocated in one module

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Modal, Platform, Pressable, useWindowDimensions, type View, type ViewStyle } from 'react-native';
import { useHoverCapable } from '../../hooks/use-hover-capable';
import { useModalRender } from '../../hooks/use-modal-render';
import { useMountEffect } from '../../hooks/use-mount-effect';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { EASE_IN_OUT, SPRING_PANEL } from '../../lib/ease';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';

const DEFAULT_WIDTH = 200;
const DEFAULT_OFFSET = 4;
const DEFAULT_OPEN_DELAY = 100;
const DEFAULT_CLOSE_DELAY = 150;
const VIEWPORT_PADDING = 8;
const OPENING_GUARD_MS = 1000;

type Rect = { x: number; y: number; w: number; h: number };
type PanelSize = { w: number; h: number };
type TriggerRenderProps = { open: boolean };
type MenuContentRenderProps = { close: () => void };

// biome-ignore lint/style/useExportsLast: type collocated with the render-prop types above; the component export follows at the end of the file
export type HoverMenuProps = {
  /** The element that opens the menu. On web it opens on hover; on every platform it toggles on press. */
  trigger: ReactNode | ((props: TriggerRenderProps) => ReactNode);
  /** Content rendered inside the floating panel. As a render prop receives `{ close }`. */
  children: ReactNode | ((props: MenuContentRenderProps) => ReactNode);
  /** Controls visibility from outside. If omitted, the menu manages its own open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerAccessibilityLabel?: string;
  /** Which edge of the trigger the panel is aligned to. @default 'start' */
  align?: 'start' | 'end';
  /** Panel width in pixels, or 'trigger' to match the trigger's measured width. @default 200 */
  width?: number | 'trigger';
  /** Vertical gap between the trigger and the panel. @default 4 */
  offset?: number;
  /** Hover-open delay in ms (web only). @default 100 */
  openDelay?: number;
  /** Hover-close delay in ms (web only). @default 150 */
  closeDelay?: number;
  contentClassName?: string;
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
const REDUCED_TRANSITION = { type: 'timing', duration: 0 } as const;
const EXIT_TRANSITION = { type: 'timing', duration: 180, easing: EASE_IN_OUT } as const;

type PanelLayout = { left: number; top: number; openAbove: boolean; panelWidth: number; enterY: number; measured: boolean };

type ComputePanelLayoutOptions = {
  rect: Rect | null;
  panelSize: PanelSize;
  viewportWidth: number;
  viewportHeight: number;
  align: 'start' | 'end';
  offset: number;
  width: number | 'trigger';
  reduce: boolean;
};

// Pure geometry for the floating panel: clamps it to the viewport, flips it above
// the trigger when it wouldn't fit below, and picks a slide-in direction. Pulled
// out of the component so the math is testable and the render stays readable.
function computePanelLayout(options: ComputePanelLayoutOptions): PanelLayout {
  const { rect, panelSize, viewportWidth, viewportHeight, align, offset, width, reduce } = options;
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

  let enterY = -12;
  if (reduce) enterY = 0;
  else if (openAbove) enterY = 12;
  return { left, top, openAbove, panelWidth, enterY, measured };
}

const handlePanelPress = () => undefined;

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: positioning, hover timers, and dual-platform render are collocated around shared refs/state
export function HoverMenu({
  trigger,
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
    triggerRef.current?.measureInWindow((x, y, w, h) => setRect({ x, y, w, h }));
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
  // These read `open` from `openRef` (not the closure) and keep a stable identity
  // across open changes. react-native-web's `useHover` captures the hover-end
  // handler when the pointer ENTERS — it attaches the `pointerleave` listener
  // inside the `pointerenter` handler and does not re-bind it when the prop
  // changes. A handler that closed over `open` was captured at enter time, while
  // the menu was still closed (hover opens on a timer AFTER enter), so the first
  // hover's `pointerleave` ran `handleHoverOut` with `open === false` and bailed
  // (`if (!open) return`) — never scheduling the close. The menu only closed once
  // a later hover entered while already open (capturing `open === true`), i.e.
  // from the second hover on. Reading the ref defeats the stale capture.
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
    if (!(canHover && open)) return;
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
  }, [canHover, open, close]);

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

  const { left, top, panelWidth, enterY, measured } = computePanelLayout({
    rect,
    panelSize,
    viewportWidth,
    viewportHeight,
    align,
    offset,
    width,
    reduce,
  });

  const resolvedTrigger = typeof trigger === 'function' ? trigger({ open }) : trigger;
  const resolvedContent = typeof children === 'function' ? children({ close }) : children;

  const panel =
    open && rect ? (
      <Pressable
        key="hover-menu-panel"
        ref={panelRef}
        onPress={handlePanelPress}
        onLayout={handlePanelLayout}
        onHoverIn={canHover ? handleHoverIn : undefined}
        onHoverOut={canHover ? handleHoverOut : undefined}
        style={[canHover ? WEB_PANEL_POSITION : POSITION_ABSOLUTE, { left, top, width: panelWidth, zIndex: 50 }]}
      >
        <MotiView
          from={{ opacity: 0, translateY: enterY }}
          animate={{ opacity: measured ? 1 : 0, translateY: 0 }}
          exit={{ opacity: 0, translateY: enterY }}
          transition={reduce ? REDUCED_TRANSITION : SPRING_PANEL}
          exitTransition={reduce ? REDUCED_TRANSITION : EXIT_TRANSITION}
          onDidAnimate={handleDidAnimate}
          className={`z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-modal ${contentClassName ?? ''}`}
        >
          {resolvedContent}
        </MotiView>
      </Pressable>
    ) : null;

  return (
    <>
      <Pressable
        ref={triggerRef}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={triggerAccessibilityLabel}
        aria-expanded={open}
        onPress={toggle}
        onHoverIn={canHover ? handleHoverIn : undefined}
        onHoverOut={canHover ? handleHoverOut : undefined}
      >
        {resolvedTrigger}
      </Pressable>

      {canHover ? (
        <AnimatePresence onExitComplete={onExitComplete}>{panel}</AnimatePresence>
      ) : (
        <Modal visible={rendered} transparent={true} animationType="none" statusBarTranslucent={true} onRequestClose={close}>
          <Pressable onPress={close} style={OVERLAY_STYLE} />
          <AnimatePresence onExitComplete={onExitComplete}>{panel}</AnimatePresence>
        </Modal>
      )}
    </>
  );
}
