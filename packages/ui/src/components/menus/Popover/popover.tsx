import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Dimensions, type LayoutChangeEvent, Modal, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { useModalRender } from '../../../hooks/use-modal-render';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { elevatedShadow, type SurfaceLevel, surfaceBackground } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { type MenuMotion, menuTransformOrigin, resolveMenuMotion } from '../../../theme/motion';
import { Text } from '../../typography/Text/text';
import { OverlayOutlet } from '../Overlay/overlay-portal';

export type PopoverSide = 'top' | 'bottom';
export type PopoverAlign = 'start' | 'center' | 'end';
// biome-ignore lint/style/useExportsLast: type collocated with sibling Popover type exports for readability
export type PopoverTriggerMode = 'click' | 'hover';

type Rect = { x: number; y: number; w: number; h: number };

type PopoverContext = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  rect: Rect | null;
  setRect: (r: Rect) => void;
  side: PopoverSide;
  align: PopoverAlign;
  gap: number;
  panelRadius: number;
  motion?: MenuMotion;
  reduce: boolean;
};

const Ctx = createContext<PopoverContext | null>(null);

function usePopover(component: string) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error(`${component} must be used within <Popover>`);
  return ctx;
}

export type PopoverProps = {
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
  /**
   * Overrides the shared open/close animation — the same `motion` prop
   * `AdaptiveDropdown`, `HoverMenu` and `HoldContextMenu` take. Reduced motion
   * overrides all of it: the panel cross-fades in place.
   *
   * @example
   * motion={{ enter: { stiffness: 420 }, scale: 0.9 }}
   */
  motion?: MenuMotion;
  /** No-op on RN (drove the web goo blur). Kept for API parity. */
  gooStrength?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Popover({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  side = 'bottom',
  align = 'center',
  sideOffset = 14,
  panelRadius = 16,
  motion,
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

  const ctx = useMemo<PopoverContext>(
    () => ({ open, setOpen, toggle, rect, setRect, side, align, gap: sideOffset, panelRadius, motion, reduce }),
    [open, setOpen, toggle, rect, side, align, sideOffset, panelRadius, motion, reduce],
  );

  return (
    <Ctx.Provider value={ctx}>
      <View testID={testID} style={[{ alignSelf: 'flex-start' }, style]}>
        {children}
      </View>
    </Ctx.Provider>
  );
}

export type PopoverTriggerProps = {
  children: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

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
      className="h-10 flex-row items-center justify-center gap-2 self-start rounded-full border border-border bg-surface-3 px-5"
      style={style}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text className="font-medium text-foreground text-sm">{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

function alignLeft(align: PopoverAlign, rect: Rect, panelW: number): number {
  if (align === 'start') return rect.x;
  if (align === 'end') return rect.x + rect.w - panelW;
  return rect.x + rect.w / 2 - panelW / 2;
}

export type PopoverContentProps = {
  children: ReactNode;
  accessibilityLabel?: string;
  /** Float level — picks the `shadow-elevated-N` recipe (drop + dark rim). @default 4 */
  elevation?: SurfaceLevel;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function PopoverContent({ children, accessibilityLabel, elevation = 4, style, testID }: PopoverContentProps) {
  const { open, setOpen, rect, side, align, gap, panelRadius, motion, reduce } = usePopover('PopoverContent');
  const { rendered, onExitComplete: handleExitComplete } = useModalRender(open);
  const [panel, setPanel] = useState({ w: 0, h: 0 });

  const handleClose = useCallback(() => setOpen(false), [setOpen]);
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => setPanel({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }),
    [],
  );

  if (!rendered) return null;

  const screen = Dimensions.get('window');
  const measured = panel.w > 0 && panel.h > 0 && rect !== null;

  // Position the panel in window coords relative to the measured trigger rect.
  let left = 0;
  let top = 0;
  if (rect) {
    left = alignLeft(align, rect, panel.w);
    top = side === 'bottom' ? rect.y + rect.h + gap : rect.y - gap - panel.h;
    // Keep the panel on screen.
    left = Math.max(8, Math.min(left, screen.width - panel.w - 8));
    top = Math.max(8, Math.min(top, screen.height - panel.h - 8));
  }

  // Shared with AdaptiveDropdown, HoverMenu and HoldContextMenu, so every panel
  // this package anchors to a trigger opens and closes the same way.
  const panelMotion = resolveMenuMotion({ motion, reduce, side });
  const transformOrigin = menuTransformOrigin({ align, side });

  return (
    <Modal transparent={true} visible={rendered} animationType="none" onRequestClose={handleClose}>
      <AnimatePresence onExitComplete={handleExitComplete}>
        {open ? (
          <View key="popover-overlay" className="flex-1">
            <Pressable accessibilityLabel="Close" onPress={handleClose} className="absolute top-0 right-0 bottom-0 left-0" />
            <MotiView
              accessibilityLabel={accessibilityLabel}
              testID={testID}
              onLayout={handleLayout}
              {...panelMotion}
              // Held at 0 until the panel has been measured, so it is never
              // painted at an unresolved position — the rest of the pose is the
              // shared one.
              animate={{ ...panelMotion.animate, opacity: measured ? 1 : 0 }}
              className={`max-w-xs border border-border p-4 ${surfaceBackground(elevation)} ${elevatedShadow(elevation)}`}
              // `transformOrigin` is static, so it composes with the animated
              // scale rather than competing with it: the panel grows out of the
              // corner facing the trigger.
              style={[{ position: 'absolute', left, top, borderRadius: panelRadius, transformOrigin }, style]}
            >
              {children}
            </MotiView>
          </View>
        ) : null}
      </AnimatePresence>
      {/* Overlay outlet: above the panel, outside the scale animation. */}
      <OverlayOutlet />
    </Modal>
  );
}
