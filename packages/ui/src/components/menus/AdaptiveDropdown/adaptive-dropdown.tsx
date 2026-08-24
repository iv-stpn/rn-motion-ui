import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { type BreakpointValue, isWidthAtLeast } from '../../../lib/breakpoints';
import { cn } from '../../../lib/cn';
import type { SurfaceElevation } from '../../../lib/elevated';
import { surface } from '../../../lib/surface';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { type MenuMotion, menuTransformOrigin, resolveMenuMotion } from '../../../theme/motion';
import { Text } from '../../typography/Text/text';
import { BottomSheet } from '../BottomSheet/bottom-sheet';
import { OverlayBlur } from '../Overlay/overlay-blur';
import { OverlayOutlet } from '../Overlay/overlay-portal';

/** Floating panel vs. bottom sheet cutoff. */
const DEFAULT_WIDE_BREAKPOINT: BreakpointValue = 'md';
const DEFAULT_WIDTH = 360;
const VIEWPORT_PADDING = 8;
const DEFAULT_MAX_HEIGHT = 520;

const noop = () => undefined;

export type TriggerRenderProps = { open: boolean; toggle: () => void };
export type ContentRenderProps = { close: () => void };

export type AdaptiveDropdownProps = {
  /**
   * The element that opens the dropdown. A plain node is wrapped in a Pressable
   * that toggles it. Pass a function to receive `{ open, toggle }` — use this
   * when the trigger is itself pressable (e.g. a `Button`): wire its `onPress`
   * to `toggle`, since the inner pressable claims the press and the wrapper's
   * own toggle never fires.
   */
  trigger: ReactNode | ((props: TriggerRenderProps) => ReactNode);
  /** Content inside the floating panel / bottom sheet. */
  children: ReactNode | ((props: ContentRenderProps) => ReactNode);
  /** Title shown in the panel header. */
  title?: string;
  /** Trailing node in the panel header (e.g. an action button). */
  headerSuffix?: ReactNode;
  /** Controls visibility from outside. Omit to let the component manage its own state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerAccessibilityLabel?: string;
  /** Which edge of the trigger to align the panel to. @default 'start' */
  align?: 'start' | 'end';
  /** Panel width in pixels (wide screen only). @default 360 */
  width?: number;
  /** Gap between trigger bottom and panel top. @default 8 */
  offset?: number;
  /** Maximum panel height before content scrolls. @default 520 */
  maxHeight?: number;
  /** When true, panel content is wrapped in a ScrollView. @default false */
  scrollable?: boolean;
  /**
   * Class applied to the panel's content wrapper. The panel adds no inset of its
   * own, so this is where one goes: `"p-1"` for a menu whose rows should not run
   * to the edge, nothing at all for content that should.
   */
  contentClassName?: string;
  /** Class applied to the trigger wrapper — use `"flex-1"` to stretch in a flex-row parent. */
  triggerClassName?: string;
  /** When true, the bottom sheet on small screens stretches to full height. @default false */
  fullSheet?: boolean;
  /** Float level for the wide-screen panel — picks the `shadow-elevated-N` recipe (drop + dark rim). `0` is the flat resting surface (no shadow or border). @default 5 */
  elevation?: SurfaceElevation;
  /**
   * Minimum window width for the floating-panel layout; below it the content
   * opens as a bottom sheet. A breakpoint name from the default scale or a raw
   * pixel number. @default 'md'
   */
  wideBreakpoint?: BreakpointValue;
  /**
   * Open/close animation for the floating panel — the shared anchored-menu motion
   * every menu in this package uses. Override one field and the rest of the preset
   * stands.
   *
   * Wide screen only: below `wideBreakpoint` the content is a `BottomSheet`, which
   * slides from the edge on its own spring rather than scaling out of a corner.
   * Reduced motion overrides all of it — the panel cross-fades in place.
   *
   * @example
   * // Slower, and no slide
   * motion={{ enter: { damping: 30, stiffness: 180 }, offset: 0 }}
   */
  motion?: MenuMotion;
  testID?: string;
  /** When false, the dimming backdrop is not rendered behind the panel. Defaults to true. */
  overlay?: boolean;
  /** When false, pressing outside the panel will not close it. Defaults to true. */
  closeOnOutsidePress?: boolean;
};
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the overlay/outside-press branches add two decision points to a component already at the threshold
export function AdaptiveDropdown({
  trigger,
  children,
  title,
  headerSuffix,
  open: openProp,
  onOpenChange,
  triggerAccessibilityLabel,
  align = 'start',
  width = DEFAULT_WIDTH,
  offset = 8,
  maxHeight = DEFAULT_MAX_HEIGHT,
  scrollable = false,
  contentClassName,
  triggerClassName,
  fullSheet = false,
  elevation = 5,
  wideBreakpoint = DEFAULT_WIDE_BREAKPOINT,
  motion,
  testID,
  overlay = true,
  closeOnOutsidePress = true,
}: AdaptiveDropdownProps) {
  const { width: vpWidth, height: vpHeight } = useWindowDimensions();
  const isWideScreen = isWidthAtLeast(vpWidth, wideBreakpoint);
  const reduced = useReducedMotion();

  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const close = useCallback(() => setOpen(false), [setOpen]);

  // Floating panel mount state — immediately reset when leaving wide screen.
  const [panelMounted, setPanelMounted] = useState(false);

  // biome-ignore lint/plugin: responds to breakpoint flip — fires at the moment of change, not derivable from render state
  useEffect(() => {
    if (open && isWideScreen) setPanelMounted(true);
    else if (!isWideScreen) {
      setPanelMounted(false);
      setContentHeight(0);
    }
  }, [open, isWideScreen]);

  const handlePanelExitComplete = useCallback(() => {
    setPanelMounted(false);
    setContentHeight(0);
  }, []);

  const measure = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, width: w, height: h }));
  }, []);

  const toggle = useCallback(() => {
    if (!open) measure();
    setOpen(!open);
  }, [open, measure, setOpen]);

  const handlePanelLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (Math.abs(h - contentHeight) > 0.5) setContentHeight(h);
    },
    [contentHeight],
  );

  // ── Positioning ────────────────────────────────────────────────────────────
  const panelWidth = width;
  const maxLeft = Math.max(VIEWPORT_PADDING, vpWidth - panelWidth - VIEWPORT_PADDING);
  const spaceBelow = anchor ? vpHeight - (anchor.y + anchor.height) - offset - VIEWPORT_PADDING : 0;
  const spaceAbove = anchor ? anchor.y - offset - VIEWPORT_PADDING : 0;
  const openAbove = Boolean(anchor) && contentHeight > spaceBelow && spaceAbove > spaceBelow;

  let panelLeft = 0;
  let panelTop = 0;
  if (anchor) {
    const raw = align === 'end' ? anchor.x + anchor.width - panelWidth : anchor.x;
    panelLeft = Math.min(Math.max(raw, VIEWPORT_PADDING), maxLeft);
    panelTop = openAbove ? Math.max(VIEWPORT_PADDING, anchor.y - offset - contentHeight) : anchor.y + anchor.height + offset;
  }

  // ── Content resolution ─────────────────────────────────────────────────────
  const resolvedTrigger = typeof trigger === 'function' ? trigger({ open, toggle }) : trigger;
  const resolvedContent = typeof children === 'function' ? children({ close }) : children;

  const header =
    title || headerSuffix ? (
      <View className="flex-row items-center justify-between gap-3 px-3">
        {title ? (
          <Text weight="medium" className="flex-1 pt-3 text-foreground/75 text-sm" numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <View className="flex-1" />
        )}
        {headerSuffix}
      </View>
    ) : null;

  const body = scrollable ? (
    <ScrollView
      className="min-h-0 shrink"
      showsVerticalScrollIndicator={false}
      bounces={false}
      keyboardShouldPersistTaps="handled"
    >
      <View className={contentClassName}>{resolvedContent}</View>
    </ScrollView>
  ) : (
    <View className={cn('overflow-hidden', contentClassName)}>{resolvedContent}</View>
  );

  // Shared with Popover and HoverMenu, so every panel this
  // package anchors to a trigger opens and closes the same way.
  const panelMotion = resolveMenuMotion({ motion, reduce: reduced, side: openAbove ? 'top' : 'bottom' });
  const transformOrigin = menuTransformOrigin({ align, side: openAbove ? 'top' : 'bottom' });

  return (
    <>
      <View ref={triggerRef} collapsable={false} className={triggerClassName} testID={testID}>
        <Pressable onPress={toggle} accessibilityLabel={triggerAccessibilityLabel}>
          {resolvedTrigger}
        </Pressable>
      </View>

      {isWideScreen ? (
        <Modal visible={panelMounted} transparent={true} animationType="none" statusBarTranslucent={true} onRequestClose={close}>
          <Pressable className="flex-1" onPress={closeOnOutsidePress ? close : undefined}>
            {overlay ? (
              <View pointerEvents="none" className="absolute inset-0">
                <OverlayBlur />
                <View className="absolute inset-0 bg-black/20" />
              </View>
            ) : null}
            <AnimatePresence onExitComplete={handlePanelExitComplete}>
              {open && isWideScreen ? (
                <MotiView
                  key="panel"
                  onLayout={handlePanelLayout}
                  {...panelMotion}
                  className={cn('absolute flex-col overflow-hidden', surface(elevation, 'menu'))}
                  // `transformOrigin` is static, so it composes with the animated
                  // scale rather than competing with it: the panel grows out of the
                  // corner facing the trigger.
                  style={{ top: panelTop, left: panelLeft, width: panelWidth, maxHeight, transformOrigin }}
                  testID={testID ? `${testID}-panel` : undefined}
                >
                  {/*
                   * Swallows presses so a tap on the panel's own padding doesn't
                   * reach the dismiss Pressable filling the modal behind it. On
                   * react-native-web that Pressable is a DOM node with a click
                   * handler, and clicks bubble regardless of RN's responder
                   * negotiation — so claiming the responder on the panel view is
                   * not enough; a Pressable that handles the press is.
                   */}
                  <Pressable className="min-h-0 flex-col" onPress={noop}>
                    {header}
                    {body}
                  </Pressable>
                </MotiView>
              ) : null}
            </AnimatePresence>
          </Pressable>
          {/* Overlay outlet: above the panel, outside the scale animation. */}
          <OverlayOutlet />
        </Modal>
      ) : (
        <BottomSheet
          open={open}
          onOpenChange={close}
          fullSheet={fullSheet}
          overlay={overlay}
          closeOnOutsidePress={closeOnOutsidePress}
        >
          {header}
          {body}
        </BottomSheet>
      )}
    </>
  );
}
