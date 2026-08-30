/** biome-ignore-all lint/style/useExportsLast: the prop type sits with the component it describes */
// The file-system's background context menu: a `Menu` panel opened at an
// arbitrary point — a right-click on the empty view area (web) or a long-press
// on the background (native) — where there is no entry to hold.
//
// This replaces the `trigger="passive"` use of the removed `HoldContextMenu`,
// which was the one menu in the package that could anchor to a point rather than
// to a held item: `HoldItem` has no imperative open, so the same 1×1-anchor
// trick is reproduced here. A positioned 1×1 `View` is measured with
// `measureInWindow` (its window rect is the container's offset plus the press
// point), and the panel anchors to that rect through the shared placement math
// in `rows/menu-placement.ts`. There is no gesture and no lift — the panel is
// the whole feature, so `OverlayShell` + `Menu` + a scrim is all that is left.

import { isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from '../../../../hooks/use-reduced-motion';
import { useSafeInsets } from '../../../../hooks/use-safe-insets';
import { cn } from '../../../../lib/cn';
import { surface } from '../../../../lib/surface';
import { MotiView } from '../../../../moti/components/view';
import { AnimatePresence } from '../../../../moti/presence/animate-presence';
import { MENU_SCRIM_TRANSITION, resolveMenuMotion } from '../../../../theme/motion';
import { OverlayBlur } from '../../../menus/Overlay/overlay-blur';
import { OverlayShell, type OverlayShellContext } from '../../../menus/Overlay/overlay-shell';
import { Menu, type MenuEntry } from '../../../rows/menu';
import {
  estimateHoldMenuHeight,
  HOLD_MENU_DEFAULT_WIDTH,
  HOLD_MENU_LIST_CLASS,
  type HoldMenuLayout,
  type HoldMenuRect,
  resolveHoldMenuLayout,
} from '../../../rows/menu-placement';

const MENU_ACCESSIBILITY_LABEL = 'Actions';
const CLOSE_ACCESSIBILITY_LABEL = 'Close menu';
const PANEL_ELEVATION = 6;

export type FileSystemBackgroundMenuProps = {
  /** The rows, already translated to `Menu` entries. */
  items: readonly MenuEntry[];
  /** Container-local point the panel anchors to. Converted to a window rect via `measureInWindow`. */
  anchor: { x: number; y: number };
  open: boolean;
  onClose: () => void;
  testID?: string;
};

/**
 * The height-estimate shape the pure placement math expects: one entry per
 * `Menu` row, marking the two kinds whose height is a fixed px value (a heading
 * and a separator) rather than a text line box.
 */
function toHeightItems(entries: readonly MenuEntry[]): { heading?: boolean; separator?: boolean }[] {
  const result: { heading?: boolean; separator?: boolean }[] = [];
  for (const entry of entries) {
    // Drop the bare-element shorthand, the falsy placeholders and arbitrary
    // `node` entries — only the object entries have a predictable row height.
    if (entry && !isValidElement(entry) && entry.type !== 'node')
      result.push({ heading: entry.type === 'label', separator: entry.type === 'separator' });
  }
  return result;
}

type ScrimProps = { onClose: () => void; testID?: string };

/**
 * The click-outside scrim. Native paints a dim over a `BlurView` (`OverlayBlur`
 * + `bg-black/35`); on Android the blur needs an enclosing `<BlurProvider>` (its
 * `BlurTarget` wraps the content to frost), and without one the dim stands
 * alone. Web keeps the scrim invisible — a dropdown does not dim the page behind
 * it — but still full-bleed, because it is the only dismiss control reachable
 * without a pointer.
 */
function BackgroundScrim({ onClose, testID }: ScrimProps) {
  const dims = Platform.OS !== 'web';

  return (
    <MotiView
      animate={{ opacity: 1 }}
      className={cn(dims && 'backdrop-blur-xs')}
      exit={{ opacity: 0 }}
      from={{ opacity: 0 }}
      style={StyleSheet.absoluteFill}
      transition={MENU_SCRIM_TRANSITION}
    >
      {dims ? <OverlayBlur /> : null}
      <Pressable
        accessibilityLabel={CLOSE_ACCESSIBILITY_LABEL}
        accessibilityRole="button"
        className={cn('flex-1', dims && 'bg-black/35')}
        onPress={onClose}
        testID={testID ? `${testID}-backdrop` : undefined}
      />
    </MotiView>
  );
}

type PanelProps = {
  items: readonly MenuEntry[];
  layout: HoldMenuLayout;
  /** Natural panel height, estimated then corrected — decides whether it scrolls. */
  menuHeight: number;
  onClose: () => void;
  onMenuHeight: (event: LayoutChangeEvent) => void;
  reduce: boolean;
  testID?: string;
};

function BackgroundPanel({ items, layout, menuHeight, onClose, onMenuHeight, reduce, testID }: PanelProps) {
  const scrolls = menuHeight > layout.maxHeight;
  // The same open/close every anchored menu in the package uses. `shift` is the
  // travel that keeps the pair on screen, so it is where the panel rests — the
  // slide is applied on top of it rather than replacing it.
  const panelMotion = resolveMenuMotion({ reduce, restingTranslateY: layout.shift, side: layout.side });

  const list = (
    <Menu
      accessibilityLabel={MENU_ACCESSIBILITY_LABEL}
      className={HOLD_MENU_LIST_CLASS}
      entries={items}
      onClose={onClose}
      testID={testID ? `${testID}-menu` : undefined}
    />
  );

  return (
    <MotiView
      {...panelMotion}
      className={cn('absolute overflow-hidden border-[1.5px] border-border', surface(PANEL_ELEVATION, 'menu'))}
      onLayout={onMenuHeight}
      style={{
        left: layout.left,
        maxHeight: layout.maxHeight,
        top: layout.top,
        // Static, so it composes with the animated `scale` rather than competing
        // with it: the panel grows out of the corner nearest the anchor point.
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

/**
 * Opens a `Menu` panel at an arbitrary container-local point, without a held
 * item or a gesture. The anchor is a 1×1 `View` positioned at the point; its
 * window rect — measured once on open — is what the panel anchors to.
 */
export function FileSystemBackgroundMenu({ items, anchor, open, onClose, testID }: FileSystemBackgroundMenuProps) {
  const reduce = useReducedMotion();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const insets = useSafeInsets();

  const anchorRef = useRef<View | null>(null);
  const [rect, setRect] = useState<HoldMenuRect | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState(0);

  // The panel is placed on the frame it opens, before `onLayout` can report
  // anything, so the estimate goes first and the measurement corrects it.
  // Corrections only ever grow the height: a measured height is already clamped
  // by the `maxHeight` it was given, so feeding a shrunken one back in would
  // resolve a smaller layout, which clamps harder, which shrinks it again.
  const estimatedHeight = useMemo(() => estimateHoldMenuHeight(toHeightItems(items)), [items]);
  const menuHeight = Math.max(estimatedHeight, measuredHeight);

  // Measure the anchor when the menu opens (and not before — a zero-sized node
  // measured early would refuse to anchor and leave `rect` null). The rect is
  // cleared once the overlay has fully left, so the next open starts fresh.
  // biome-ignore lint/plugin: measuring a laid-out node is imperative — the rect is not derivable during render
  useEffect(() => {
    if (!open || rect) return;
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      if (width === 0 || height === 0) return;
      setRect({ x, y, width, height });
    });
  }, [open, rect]);

  const layout = useMemo<HoldMenuLayout | null>(() => {
    if (!rect) return null;
    return resolveHoldMenuLayout({
      align: 'auto',
      // Web pins the panel and lets it scroll — a dropdown stays put, nothing
      // lifts to travel. Native travels the pair up when the panel is too tall
      // for the space below the press point. Mirrors the removed HoldContextMenu's
      // platform split (`disableMove: !HOLD_MENU_LIFTS`).
      disableMove: Platform.OS === 'web',
      insets,
      item: rect,
      menuHeight,
      menuWidth: HOLD_MENU_DEFAULT_WIDTH,
      side: 'bottom',
      viewport: { height: viewportHeight, width: viewportWidth },
    });
  }, [insets, menuHeight, rect, viewportHeight, viewportWidth]);

  const handleMenuHeight = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setMeasuredHeight((previous) => (height > previous ? height : previous));
  }, []);

  const handleAfterClose = useCallback(() => {
    setRect(null);
    setMeasuredHeight(0);
  }, []);

  return (
    <>
      <View
        ref={anchorRef}
        collapsable={false}
        style={{ height: 1, left: anchor.x, position: 'absolute', top: anchor.y, width: 1 }}
      />
      <OverlayShell accessibilityLabel={MENU_ACCESSIBILITY_LABEL} onAfterClose={handleAfterClose} onClose={onClose} open={open}>
        {({ open: animating, onExitComplete }: OverlayShellContext) =>
          // `rect` and `layout` are set together and cleared only once the exit
          // completes, so this never null-checks away a live overlay.
          layout && rect ? (
            <AnimatePresence onExitComplete={onExitComplete}>
              {animating ? (
                <View className="flex-1">
                  <BackgroundScrim onClose={onClose} testID={testID} />
                  <BackgroundPanel
                    items={items}
                    layout={layout}
                    menuHeight={menuHeight}
                    onClose={onClose}
                    onMenuHeight={handleMenuHeight}
                    reduce={reduce}
                    testID={testID}
                  />
                </View>
              ) : null}
            </AnimatePresence>
          ) : null
        }
      </OverlayShell>
    </>
  );
}
