import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Easing } from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { X } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { BottomSheet } from '../BottomSheet/bottom-sheet';
import { Text } from '../Text/text';

const MD_BREAKPOINT = 768;
const DEFAULT_WIDTH = 360;
const VIEWPORT_PADDING = 8;
const DEFAULT_MAX_HEIGHT = 520;
const noop = () => undefined;

type TriggerRenderProps = { open: boolean };
type ContentRenderProps = { close: () => void };

export type AdaptiveDropdownProps = {
  /** The element that opens the dropdown. Wrapped in a Pressable that toggles it. */
  trigger: ReactNode | ((props: TriggerRenderProps) => ReactNode);
  /** Content inside the floating panel / bottom sheet. */
  children: ReactNode | ((props: ContentRenderProps) => ReactNode);
  /** Title shown in the panel header. */
  title?: string;
  /** Show a dismiss button in the panel header. */
  showClose?: boolean;
  /** Trailing node in the panel header (e.g. an action button). */
  headerRight?: ReactNode;
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
  contentClassName?: string;
  /** Class applied to the trigger wrapper — use `"flex-1"` to stretch in a flex-row parent. */
  triggerClassName?: string;
  /** When true, the bottom sheet on small screens stretches to full height. @default false */
  fullSheet?: boolean;
};
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: same reason — wide and small screen paths are tightly coupled to shared anchor/dimension state
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: same reason
export function AdaptiveDropdown({
  trigger,
  children,
  title,
  showClose,
  headerRight,
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
}: AdaptiveDropdownProps) {
  const { width: vpWidth, height: vpHeight } = useWindowDimensions();
  const isWideScreen = vpWidth >= MD_BREAKPOINT;
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
  const resolvedTrigger = typeof trigger === 'function' ? trigger({ open }) : trigger;
  const resolvedContent = typeof children === 'function' ? children({ close }) : children;

  const hasHeader = Boolean(title || showClose || headerRight);
  const header = hasHeader ? (
    <View className="h-14 flex-row items-center justify-between gap-3 border-border border-b px-4">
      {title ? (
        <Text className="flex-1 font-semibold text-base text-foreground/75" numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View className="flex-1" />
      )}
      {headerRight}
      {showClose ? (
        <Pressable onPress={close} hitSlop={8} accessibilityLabel="Close">
          <X size={18} />
        </Pressable>
      ) : null}
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
    <View className={`overflow-hidden${contentClassName ? ` ${contentClassName}` : ''}`}>{resolvedContent}</View>
  );

  const exitTransition = {
    type: 'timing' as const,
    duration: reduced ? 160 : 230,
    easing: reduced ? Easing.linear : Easing.in(Easing.cubic),
  };
  const enterTransition = reduced
    ? { type: 'timing' as const, duration: 160 }
    : { type: 'spring' as const, damping: 26, stiffness: 280, mass: 0.9 };

  return (
    <>
      <View ref={triggerRef} collapsable={false} className={triggerClassName}>
        <Pressable onPress={toggle} accessibilityLabel={triggerAccessibilityLabel}>
          {resolvedTrigger}
        </Pressable>
      </View>

      {isWideScreen ? (
        <Modal visible={panelMounted} transparent={true} animationType="none" statusBarTranslucent={true} onRequestClose={close}>
          <Pressable className="flex-1" onPress={close}>
            <AnimatePresence onExitComplete={handlePanelExitComplete}>
              {open && isWideScreen ? (
                <MotiView
                  key="panel"
                  onLayout={handlePanelLayout}
                  from={{ opacity: 0, translateY: -12 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  exit={{ opacity: 0, translateY: -12 }}
                  transition={enterTransition}
                  exitTransition={exitTransition}
                  style={{ position: 'absolute', top: panelTop, left: panelLeft, width: panelWidth, maxHeight }}
                >
                  <Pressable
                    onPress={noop}
                    style={{ maxHeight }}
                    className="flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-modal"
                  >
                    {header}
                    {body}
                  </Pressable>
                </MotiView>
              ) : null}
            </AnimatePresence>
          </Pressable>
        </Modal>
      ) : (
        <BottomSheet visible={open} onClose={close} fullSheet={fullSheet}>
          {header}
          {body}
        </BottomSheet>
      )}
    </>
  );
}
