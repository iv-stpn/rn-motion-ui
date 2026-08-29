import { type ReactNode, useCallback, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { AddLine as Plus } from 'rn-motion-ui-icons/icons/add-line';
import { CloseLine as X } from 'rn-motion-ui-icons/icons/close-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { EASE_OUT } from '../../../lib/ease';
import type { SurfaceElevation } from '../../../lib/elevated';
import { MENU_RADIUS } from '../../../lib/radius';
import { surface } from '../../../lib/surface';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';
import { OverlayBlur } from '../Overlay/overlay-blur';
import { OverlayShell } from '../Overlay/overlay-shell';

/** Props passed to a morphing menu icon renderer. */
export type MorphingIconProps = { size?: number; color?: string };

/** Icon renderer — compatible with this project's icon set signature. */
export type MorphingIcon = (props: MorphingIconProps) => ReactNode;

// biome-ignore lint/style/useExportsLast: type collocated with sibling MorphingIcon export for readability
export type MorphingMenuItem = { label: string; icon: MorphingIcon; testID?: string };

const TRIGGER_W = 144;
const TRIGGER_H = 44;
const PANEL_W = 320;
const BOX_H = 300;
const COLS = 3;

// The card is centred on the trigger's centre point, so the 320×300 stage sits
// at (72 - 160, 22 - 150) relative to the trigger's top-left corner.
const STAGE_LEFT = TRIGGER_W / 2 - PANEL_W / 2;
const STAGE_TOP = TRIGGER_H / 2 - BOX_H / 2;

// Folder-open feel: a touch of overshoot as the card expands, kept subtle.
const SPRING_FOLDER = { type: 'spring', stiffness: 300, damping: 32, mass: 0.9 } as const;
const INSTANT = { type: 'timing' as const, duration: 0 };

// `pointerEvents: 'box-none'` MUST come from StyleSheet.create, not an inline
// style object — the inline path drops it on react-native-web, and the empty
// stage margins would then swallow the scrim taps meant to close the menu.
const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', pointerEvents: 'box-none' },
});

export type MorphingMenuProps = {
  items: MorphingMenuItem[];
  onSelect?: (label: string) => void;
  /** Header label shown above the grid. Default "Create". */
  title?: string;
  /** Trigger label. Default "Create". */
  triggerLabel?: string;
  /**
   * Swap the morph card's ladder shadow for the input field's large, diffuse
   * halo (`shadow-floating`). It replaces the `shadow-elevated-N` rung rather
   * than adding to it, so the card keeps its `elevation` tint but trades the
   * layered drop for the halo. @default false
   */
  floating?: boolean;
  /**
   * Surface elevation of the morph card (0–8) — drives the background tint and
   * the `shadow-elevated-N` recipe. `0` is the flat resting surface (no shadow
   * or border). Defaults to `6`.
   */
  elevation?: SurfaceElevation;
  /** Additional UniWind class names merged onto the outer wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * When false, the dimming backdrop is not rendered behind the panel. Defaults
   * to false — like `MorphingFab`, it morphs in place with no scrim.
   */
  overlay?: boolean;
  /** When false, pressing outside the panel will not close it. Defaults to true. */
  closeOnOutsidePress?: boolean;
  /**
   * Root testID. The trigger takes `-trigger`, the close button `-close`, and
   * each cell `-item-<index>` — positional, since `MorphingMenuItem` has no `id`.
   * An item's own `testID` overrides the one derived for it.
   */
  testID?: string;
};

function cellClass(i: number, count: number) {
  const rows = Math.ceil(count / COLS);
  const lastRowStart = (rows - 1) * COLS;
  const borderR = i % COLS !== COLS - 1 && i < count - 1;
  const borderB = i < lastRowStart;
  if (borderR && borderB) return 'items-center justify-center px-3 py-6 border-r-[1.5px] border-b-[1.5px] border-border';
  if (borderR) return 'items-center justify-center px-3 py-6 border-r-[1.5px] border-border';
  if (borderB) return 'items-center justify-center px-3 py-6 border-b-[1.5px] border-border';
  return 'items-center justify-center px-3 py-6';
}

type MorphingCellProps = {
  item: MorphingMenuItem;
  className: string;
  reduce: boolean;
  dist: number;
  onSelect: (label: string) => void;
  testID?: string;
};

function MorphingCell({ item, className, reduce, dist, onSelect, testID }: MorphingCellProps) {
  const handlePress = useCallback(() => onSelect(item.label), [onSelect, item.label]);
  const Icon = item.icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      onPress={handlePress}
      className={className}
      style={{ width: PANEL_W / COLS }}
      testID={testID}
    >
      <MotiView
        from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
        transition={reduce ? INSTANT : { type: 'spring', stiffness: 440, damping: 34, delay: 100 + dist * 70 }}
        exitTransition={reduce ? INSTANT : { type: 'timing', duration: 120 }}
        className="items-center gap-2"
      >
        {/* Icons default to the `foreground` token — no explicit color needed. */}
        <Icon size={20} />
        <Text weight="medium" className="text-foreground text-sm">
          {item.label}
        </Text>
      </MotiView>
    </Pressable>
  );
}

type MorphingPanelProps = {
  items: MorphingMenuItem[];
  title: string;
  reduce: boolean;
  rows: number;
  onSelect: (label: string) => void;
  onClose: () => void;
  testID?: string;
};

/** Header + grid, fixed at the panel's open-state size and centred in the card. */
function MorphingPanel({ items, title, reduce, rows, onSelect, onClose, testID }: MorphingPanelProps) {
  const headerEnter = reduce ? INSTANT : { type: 'timing' as const, duration: 200, delay: 120 };
  const headerExit = reduce ? INSTANT : { type: 'timing' as const, duration: 120 };
  return (
    <View style={{ width: PANEL_W }}>
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={headerEnter}
        exitTransition={headerExit}
        className="flex-row items-center justify-between border-border border-b-[1.5px] px-4 py-3"
      >
        <Text weight="medium" className="text-muted-foreground text-sm">
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={onClose}
          testID={testID ? `${testID}-close` : undefined}
        >
          <ThemedIcon icon={X} variant="ghost" size={16} />
        </Pressable>
      </MotiView>

      <View className="flex-row flex-wrap">
        {items.map((item, i) => {
          // Radial stagger: delay each cell by its distance from the grid
          // centre so the morph reads as centre-out, not row-by-row.
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const dist = Math.hypot(col - (COLS - 1) / 2, row - (rows - 1) / 2);
          return (
            <MorphingCell
              key={item.label}
              item={item}
              className={cellClass(i, items.length)}
              reduce={reduce}
              dist={dist}
              onSelect={onSelect}
              testID={item.testID ?? (testID ? `${testID}-item-${i}` : undefined)}
            />
          );
        })}
      </View>
    </View>
  );
}

type MeasurePanelProps = { items: MorphingMenuItem[]; title: string; onLayout: (e: LayoutChangeEvent) => void };

/**
 * Hidden measuring copy of the panel, mounted in the page so its natural height
 * is known before the first open even though the animated panel only mounts
 * once the overlay Modal opens.
 */
function MeasurePanel({ items, title, onLayout }: MeasurePanelProps) {
  return (
    <View
      aria-hidden={true}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: PANEL_W, opacity: 0 }}
      onLayout={onLayout}
    >
      <View className="flex-row items-center justify-between border-border border-b-[1.5px] px-4 py-3">
        <Text weight="medium" className="text-muted-foreground text-sm">
          {title}
        </Text>
        <ThemedIcon icon={X} variant="ghost" size={16} />
      </View>
      <View className="flex-row flex-wrap">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <View key={item.label} className={cellClass(i, items.length)} style={{ width: PANEL_W / COLS }}>
              <View className="items-center gap-2">
                <Icon size={20} />
                <Text weight="medium" className="text-foreground text-sm">
                  {item.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function MorphingMenu({
  items,
  onSelect,
  title = 'Create',
  triggerLabel = 'Create',
  floating = false,
  elevation = 6,
  className,
  style,
  overlay = false,
  closeOnOutsidePress = true,
  testID,
}: MorphingMenuProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  // Measured window position of the trigger — the morph card re-anchors here
  // inside the overlay Modal so it grows out of the same spot the trigger sits.
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  // Measured natural height of the panel content — the card's open-state frame.
  const [panelH, setPanelH] = useState<number | null>(null);
  const triggerRef = useRef<View>(null);
  const morph = reduce ? { type: 'timing' as const, duration: 150 } : SPRING_FOLDER;

  const rows = Math.ceil(items.length / COLS);

  const select = useCallback(
    (label: string) => {
      onSelect?.(label);
      setOpen(false);
    },
    [onSelect],
  );

  const handleClose = useCallback(() => setOpen(false), []);

  const handleOpen = useCallback(() => {
    const node = triggerRef.current;
    if (!node) {
      setOpen(true);
      return;
    }
    node.measureInWindow((x, y) => {
      setAnchor({ x, y });
      setOpen(true);
    });
  }, []);

  const onPanelLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    if (next > 0) setPanelH(next);
  }, []);

  const faceFade = reduce ? INSTANT : { type: 'timing' as const, duration: 120 };
  const faceReturn = reduce ? INSTANT : { type: 'timing' as const, duration: 150, delay: 80 };
  const backdropTransition = reduce ? INSTANT : { type: 'timing' as const, duration: 200, easing: EASE_OUT };

  return (
    <>
      <View testID={testID} className={cn('self-start', className)} style={[{ position: 'relative' }, style]}>
        {/* Trigger — reserves the footprint in normal flow and opens the menu. */}
        <View
          ref={triggerRef}
          collapsable={false}
          className="overflow-hidden rounded-menu bg-surface-3"
          style={{ width: TRIGGER_W, height: TRIGGER_H }}
        >
          <Pressable
            accessibilityRole="button"
            aria-expanded={open}
            accessibilityLabel={triggerLabel}
            onPress={handleOpen}
            className="flex-1 flex-row items-center justify-center gap-2"
            testID={testID ? `${testID}-trigger` : undefined}
          >
            <Text weight="medium" className="text-foreground text-sm">
              {triggerLabel}
            </Text>
            <ThemedIcon icon={Plus} variant="ghost" size={16} />
          </Pressable>
        </View>

        <MeasurePanel items={items} title={title} onLayout={onPanelLayout} />
      </View>

      <OverlayShell open={open} onClose={handleClose}>
        {({ open: isAnimOpen, onExitComplete }) => (
          <AnimatePresence onExitComplete={onExitComplete}>
            {isAnimOpen && anchor ? (
              <View key="morphing-menu" className="flex-1">
                {/* Scrim: dims the page when `overlay`, and closes on outside
                    press when `closeOnOutsidePress`. Always mounted so a press
                    outside still lands on something when the dim is hidden. */}
                <MotiView
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={backdropTransition}
                  className="absolute top-0 right-0 bottom-0 left-0"
                >
                  {overlay ? <OverlayBlur /> : null}
                  <Pressable
                    accessibilityLabel="Close"
                    onPress={closeOnOutsidePress ? handleClose : undefined}
                    className={overlay ? 'flex-1 bg-foreground/40' : 'flex-1'}
                    testID={testID ? `${testID}-backdrop` : undefined}
                  />
                </MotiView>

                {/* Centring stage for the morph, anchored on the trigger's
                    centre point. The card below is its only child, so as the
                    card's frame animates the stage keeps it centred. */}
                <View
                  style={[
                    styles.stage,
                    {
                      position: 'absolute',
                      left: anchor.x + STAGE_LEFT,
                      top: anchor.y + STAGE_TOP,
                      width: PANEL_W,
                      height: BOX_H,
                    },
                  ]}
                >
                  <MotiView
                    from={{ width: TRIGGER_W, height: TRIGGER_H }}
                    animate={{ width: PANEL_W, height: panelH ?? BOX_H }}
                    exit={{ width: TRIGGER_W, height: TRIGGER_H }}
                    transition={morph}
                    exitTransition={morph}
                    className={cn('items-center justify-center overflow-hidden', surface(elevation, 'menu', floating))}
                  >
                    <MorphingPanel
                      items={items}
                      title={title}
                      reduce={reduce}
                      rows={rows}
                      onSelect={select}
                      onClose={handleClose}
                      testID={testID}
                    />

                    {/* Trigger face: fades out as the morph begins. Its background
                        masks the panel's hairlines while the card is closing. */}
                    <MotiView
                      from={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      exit={{ opacity: 1 }}
                      transition={faceFade}
                      exitTransition={faceReturn}
                      pointerEvents="none"
                      className="bg-surface-3"
                      style={[
                        // Full-bleed over the card: no outline to inset from, so
                        // the face covers it corner to corner at the card's own radius.
                        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: MENU_RADIUS },
                      ]}
                    >
                      <View className="flex-1 flex-row items-center justify-center gap-2">
                        <Text weight="medium" className="text-foreground text-sm">
                          {triggerLabel}
                        </Text>
                        <ThemedIcon icon={Plus} variant="ghost" size={16} />
                      </View>
                    </MotiView>
                  </MotiView>
                </View>
              </View>
            ) : null}
          </AnimatePresence>
        )}
      </OverlayShell>
    </>
  );
}
