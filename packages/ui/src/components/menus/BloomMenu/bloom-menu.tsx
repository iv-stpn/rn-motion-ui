import { type ReactNode, useCallback, useState } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { AddLine as Plus } from 'rn-motion-ui-icons/icons/add-line';
import { CloseLine as X } from 'rn-motion-ui-icons/icons/close-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { MotiView } from '../../../moti/components/view';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';

/** Props passed to a bloom menu icon renderer. */
export type BloomIconProps = { size?: number; color?: string };

/** Icon renderer — compatible with this project's icon set signature. */
export type BloomIcon = (props: BloomIconProps) => ReactNode;

// biome-ignore lint/style/useExportsLast: type collocated with sibling BloomIcon export for readability
export type BloomMenuItem = { label: string; icon: BloomIcon; testID?: string };

const TRIGGER_W = 144;
const TRIGGER_H = 44;
const PANEL_W = 320;
const BOX_H = 300;
const COLS = 3;

// Folder-open feel: a touch of overshoot as the card expands, kept subtle.
const SPRING_FOLDER = { type: 'spring', stiffness: 300, damping: 32, mass: 0.9 } as const;

export type BloomMenuProps = {
  items: BloomMenuItem[];
  onSelect?: (label: string) => void;
  /** Header label shown above the grid. Default "Create". */
  title?: string;
  /** Trigger label. Default "Create". */
  triggerLabel?: string;
  /** Additional UniWind class names merged onto the outer wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Root testID. The trigger takes `-trigger`, the close button `-close`, and
   * each cell `-item-<index>` — positional, since `BloomMenuItem` has no `id`.
   * An item's own `testID` overrides the one derived for it.
   */
  testID?: string;
};

function cellClass(i: number, count: number) {
  const rows = Math.ceil(count / COLS);
  const lastRowStart = (rows - 1) * COLS;
  const borderR = i % COLS !== COLS - 1 && i < count - 1;
  const borderB = i < lastRowStart;
  if (borderR && borderB) return 'items-center justify-center px-3 py-6 border-r border-b border-border';
  if (borderR) return 'items-center justify-center px-3 py-6 border-r border-border';
  if (borderB) return 'items-center justify-center px-3 py-6 border-b border-border';
  return 'items-center justify-center px-3 py-6';
}

type BloomCellProps = {
  item: BloomMenuItem;
  className: string;
  reduce: boolean;
  open: boolean;
  dist: number;
  onSelect: (label: string) => void;
  testID?: string;
};

function cellTransition(reduce: boolean, open: boolean, dist: number) {
  if (reduce) return { type: 'timing' as const, duration: 0 };
  // Radial stagger only on the way in; the close is a quick uniform fade so
  // the shrinking card never traps lingering cells.
  if (open) return { type: 'spring' as const, stiffness: 440, damping: 34, delay: 100 + dist * 70 };
  return { type: 'timing' as const, duration: 120 };
}

function BloomCell({ item, className, reduce, open, dist, onSelect, testID }: BloomCellProps) {
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
        animate={reduce ? { opacity: open ? 1 : 0 } : { opacity: open ? 1 : 0, scale: open ? 1 : 0.85 }}
        transition={cellTransition(reduce, open, dist)}
        className="items-center gap-2"
      >
        {/* Icons default to the `foreground` token — no explicit color needed. */}
        <Icon size={20} />
        <Text className="font-medium text-foreground text-sm">{item.label}</Text>
      </MotiView>
    </Pressable>
  );
}

export function BloomMenu({
  items,
  onSelect,
  title = 'Create',
  triggerLabel = 'Create',
  className,
  style,
  testID,
}: BloomMenuProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  // Measured natural height of the panel content — the card's open-state frame.
  // Content is always mounted, so this lands on first layout, before any tap.
  const [panelH, setPanelH] = useState<number | null>(null);
  const morph = reduce ? { type: 'timing' as const, duration: 150 } : SPRING_FOLDER;

  const rows = Math.ceil(items.length / COLS);

  const select = useCallback(
    (label: string) => {
      onSelect?.(label);
      setOpen(false);
    },
    [onSelect],
  );

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  const onPanelLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    if (next > 0) setPanelH(next);
  }, []);

  return (
    <View testID={testID} className={cn('self-start', className)} style={[{ position: 'relative' }, style]}>
      {/* Spacer reserves the trigger footprint in normal flow. */}
      <View style={{ width: TRIGGER_W, height: TRIGGER_H }} />

      {/* Centring stage for the morph, anchored on the trigger's centre point.
          The card below is its only flex child, so as the card's frame animates
          the stage keeps it centred — the panel grows outward in all directions
          equally, like the web's translate(-50%,-50%) container. box-none lets
          taps fall through the empty margins to the page. */}
      <View
        style={[
          {
            position: 'absolute',
            left: TRIGGER_W / 2 - PANEL_W / 2,
            top: TRIGGER_H / 2 - BOX_H / 2,
            width: PANEL_W,
            height: BOX_H,
            alignItems: 'center',
            justifyContent: 'center',
          },
          { pointerEvents: 'box-none' },
        ]}
      >
        {/* The shared-layout card: one element whose frame springs between the
            trigger and the panel, carrying the border/background/radius across
            the morph — the RN stand-in for the web's shared `layoutId`. Its
            overflow clip doubles as the clip-path iris over the centred panel. */}
        <MotiView
          animate={{ width: open ? PANEL_W : TRIGGER_W, height: open ? (panelH ?? BOX_H) : TRIGGER_H }}
          transition={morph}
          className="items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-3"
        >
          {/* Panel content, fixed at its open-state size and centred in the
              card, so the growing clip reveals it centre-out (iris). The grid
              chrome (hairlines) stays opaque — like the web's clip-path over an
              opaque grid, the card's clip alone reveals it. Only the header and
              the cells fade. When closed it hides behind the trigger face. */}
          <View
            aria-hidden={!open}
            onLayout={onPanelLayout}
            style={[{ width: PANEL_W }, { pointerEvents: open ? 'auto' : 'none' }]}
          >
            {/* header: fades in slightly after the morph starts (web: delay 0.12s) */}
            <MotiView
              animate={{ opacity: open ? 1 : 0 }}
              transition={open ? { type: 'timing', duration: 200, delay: reduce ? 0 : 120 } : { type: 'timing', duration: 120 }}
              className="flex-row items-center justify-between border-border border-b px-4 py-3"
            >
              <Text className="font-medium text-muted-foreground text-sm">{title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close menu"
                onPress={handleClose}
                testID={testID ? `${testID}-close` : undefined}
              >
                <ThemedIcon icon={X} variant="ghost" size={16} />
              </Pressable>
            </MotiView>

            {/* grid */}
            <View className="flex-row flex-wrap">
              {items.map((item, i) => {
                // Radial stagger: delay each cell by its distance from the grid
                // centre so the bloom reads as centre-out, not row-by-row.
                const col = i % COLS;
                const row = Math.floor(i / COLS);
                const dist = Math.hypot(col - (COLS - 1) / 2, row - (rows - 1) / 2);
                return (
                  <BloomCell
                    key={item.label}
                    item={item}
                    className={cellClass(i, items.length)}
                    reduce={reduce}
                    open={open}
                    dist={dist}
                    onSelect={select}
                    testID={item.testID ?? (testID ? `${testID}-item-${i}` : undefined)}
                  />
                );
              })}
            </View>
          </View>

          {/* Trigger face: an overlay on the card that fades out as the morph
              begins (the web counter-scales it via `layout`; here it simply
              stays centred in the growing card while fading). Its background
              masks the panel's hairlines while the menu is closed. */}
          <MotiView
            aria-hidden={open}
            animate={{ opacity: open ? 0 : 1 }}
            transition={open ? { type: 'timing', duration: 120 } : { type: 'timing', duration: 150, delay: reduce ? 0 : 80 }}
            className="bg-surface-3"
            style={[
              { position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderRadius: 15 },
              { pointerEvents: open ? 'none' : 'auto' },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              aria-expanded={open}
              accessibilityLabel={triggerLabel}
              onPress={handleOpen}
              className="flex-1 flex-row items-center justify-center gap-2"
              testID={testID ? `${testID}-trigger` : undefined}
            >
              <Text className="font-medium text-foreground text-sm">{triggerLabel}</Text>
              <ThemedIcon icon={Plus} variant="secondary" size={16} />
            </Pressable>
          </MotiView>
        </MotiView>
      </View>
    </View>
  );
}
