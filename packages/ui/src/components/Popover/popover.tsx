import { AnimatePresence, MotiView } from 'moti';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

export type PopoverSide = 'top' | 'bottom';
export type PopoverAlign = 'start' | 'center' | 'end';
export type PopoverTriggerMode = 'click' | 'hover';

type Rect = { x: number; y: number; w: number; h: number };

// RN FALLBACK vs web: the web popover melts out of the trigger via an SVG goo
// filter (feGaussianBlur + feColorMatrix) morphing a clip-path. RN has no SVG
// filters or clip-path morph, so the panel enters with a scale/opacity/translate
// spring anchored near the trigger edge instead. `gooStrength`/`panelRadius` are
// kept on the API for parity; `gooStrength` is a no-op here.
type PopoverCtx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  rect: Rect | null;
  setRect: (r: Rect) => void;
  side: PopoverSide;
  align: PopoverAlign;
  gap: number;
  panelRadius: number;
  reduce: boolean;
};

const Ctx = createContext<PopoverCtx | null>(null);

function usePopover(component: string) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error(`${component} must be used within <Popover>`);
  return ctx;
}

export interface PopoverProps {
  children: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Uncontrolled initial open state. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Kept for web parity; on RN both modes tap-to-toggle (no hover on touch). */
  trigger?: PopoverTriggerMode;
  /** Which side of the trigger the panel opens from. Default "bottom". */
  side?: PopoverSide;
  /** Alignment along the trigger's edge. Default "center". */
  align?: PopoverAlign;
  /** Gap between trigger and panel, in px. Default 14. */
  sideOffset?: number;
  /** Corner radius of the panel, in px. Default 16. */
  panelRadius?: number;
  /** No-op on RN (drove the web goo blur). Kept for API parity. */
  gooStrength?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Popover({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  side = 'bottom',
  align = 'center',
  sideOffset = 14,
  panelRadius = 16,
  style,
  testID,
}: PopoverProps) {
  const reduce = useReducedMotion();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [rect, setRect] = useState<Rect | null>(null);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  const toggle = useCallback(() => setOpen(!open), [setOpen, open]);

  const ctx = useMemo<PopoverCtx>(
    () => ({ open, setOpen, toggle, rect, setRect, side, align, gap: sideOffset, panelRadius, reduce }),
    [open, setOpen, toggle, rect, side, align, sideOffset, panelRadius, reduce],
  );

  return (
    <Ctx.Provider value={ctx}>
      <View testID={testID} style={[{ alignSelf: 'flex-start' }, style]}>
        {children}
      </View>
    </Ctx.Provider>
  );
}

export interface PopoverTriggerProps {
  children: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function PopoverTrigger({ children, accessibilityLabel, style, testID }: PopoverTriggerProps) {
  const { toggle, setRect, open } = usePopover('PopoverTrigger');
  const ref = useRef<View>(null);

  const onPress = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => {
      setRect({ x, y, w, h });
      toggle();
    });
  }, [setRect, toggle]);

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      aria-expanded={open}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      className="h-10 flex-row items-center justify-center gap-2 self-start rounded-full border border-border bg-card px-5"
      style={style}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text className="text-sm font-medium text-foreground">{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export interface PopoverContentProps {
  children: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function PopoverContent({ children, accessibilityLabel, style, testID }: PopoverContentProps) {
  const { open, setOpen, rect, side, align, gap, panelRadius, reduce } = usePopover('PopoverContent');
  const [rendered, setRendered] = useState(open);
  const [panel, setPanel] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (open) setRendered(true);
  }, [open]);

  if (!rendered) return null;

  const screen = Dimensions.get('window');
  const measured = panel.w > 0 && panel.h > 0 && rect != null;

  // Position the panel in window coords relative to the measured trigger rect.
  let left = 0;
  let top = 0;
  if (rect) {
    left = align === 'start' ? rect.x : align === 'end' ? rect.x + rect.w - panel.w : rect.x + rect.w / 2 - panel.w / 2;
    top = side === 'bottom' ? rect.y + rect.h + gap : rect.y - gap - panel.h;
    // Keep the panel on screen.
    left = Math.max(8, Math.min(left, screen.width - panel.w - 8));
    top = Math.max(8, Math.min(top, screen.height - panel.h - 8));
  }

  const enterY = reduce ? 0 : side === 'bottom' ? -8 : 8;

  return (
    <Modal transparent visible={rendered} animationType="none" onRequestClose={() => setOpen(false)}>
      <AnimatePresence onExitComplete={() => setRendered(false)}>
        {open ? (
          <View key="popover-overlay" style={{ flex: 1 }}>
            <Pressable
              accessibilityLabel="Close"
              onPress={() => setOpen(false)}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <MotiView
              accessibilityLabel={accessibilityLabel}
              testID={testID}
              onLayout={(e) => setPanel({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
              from={{ opacity: 0, scale: reduce ? 1 : 0.96, translateY: enterY }}
              animate={{ opacity: measured ? 1 : 0, scale: 1, translateY: 0 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.96, translateY: enterY }}
              transition={
                reduce ? { type: 'timing', duration: 120 } : { type: 'spring', stiffness: 300, damping: 26, mass: 0.8 }
              }
              className="max-w-xs border border-border bg-card p-4"
              style={[{ position: 'absolute', left, top, borderRadius: panelRadius }, style]}
            >
              {children}
            </MotiView>
          </View>
        ) : null}
      </AnimatePresence>
    </Modal>
  );
}
