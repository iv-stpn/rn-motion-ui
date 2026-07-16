import { AnimatePresence, MotiView } from 'moti';
import { type ReactNode, useCallback, useState } from 'react';
import { Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { Plus, X } from '../../lib/icons';

// RN FALLBACK vs web: the web menu morphs a single `layoutId` box from the
// trigger into the panel and reveals the grid with an animated `clip-path`
// iris. RN has neither shared-element layout nor clip-path, so the trigger and
// panel cross-fade/scale in place (AnimatePresence) and the grid items bloom
// from the centre via a radial stagger (scale/opacity spring per cell). Escape
// / outside-tap close is dropped (no window listeners on RN) — close via the X
// header button or by selecting an item (documented).

/** Icon renderer matching the `../../lib/icons` signature. */
export type BloomIcon = (props: { size?: number; color?: string }) => ReactNode;

export type BloomMenuItem = { label: string; icon: BloomIcon };

const TRIGGER_W = 144;
const TRIGGER_H = 44;
const PANEL_W = 320;
const BOX_H = 300;
const COLS = 3;

// Folder-open feel: a touch of overshoot as the panel expands, kept subtle.
const SPRING_FOLDER = { type: 'spring', stiffness: 300, damping: 26, mass: 0.9 } as const;

export interface BloomMenuProps {
  items: BloomMenuItem[];
  onSelect?: (label: string) => void;
  /** Header label shown above the grid. Default "Create". */
  title?: string;
  /** Trigger label. Default "Create". */
  triggerLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

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

export function BloomMenu({ items, onSelect, title = 'Create', triggerLabel = 'Create', style, testID }: BloomMenuProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const morph = reduce ? { type: 'timing' as const, duration: 150 } : SPRING_FOLDER;

  const rows = Math.ceil(items.length / COLS);

  const select = useCallback(
    (label: string) => {
      onSelect?.(label);
      setOpen(false);
    },
    [onSelect],
  );

  return (
    <View testID={testID} className="self-start" style={[{ position: 'relative' }, style]}>
      {/* Spacer reserves the trigger footprint in normal flow. */}
      <View style={{ width: TRIGGER_W, height: TRIGGER_H }} />

      {/* Centering box sized to the OPEN panel, centred on the trigger so the
          morph grows from the middle outward. box-none lets taps fall through
          the empty margins to the page. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: TRIGGER_W / 2 - PANEL_W / 2,
          top: TRIGGER_H / 2 - BOX_H / 2,
          width: PANEL_W,
          height: BOX_H,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AnimatePresence>
          {open ? (
            <MotiView
              key="panel"
              from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              transition={morph}
              className="overflow-hidden border border-border bg-card"
              style={{ width: PANEL_W, borderRadius: 16 }}
            >
              {/* header */}
              <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
                <Text className="text-sm font-medium text-muted-foreground">{title}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={() => setOpen(false)}>
                  <X size={16} color="#71717a" />
                </Pressable>
              </View>

              {/* grid */}
              <View className="flex-row flex-wrap">
                {items.map((item, i) => {
                  // Radial stagger: delay each cell by its distance from the grid
                  // centre so the bloom reads as centre-out, not row-by-row.
                  const col = i % COLS;
                  const row = Math.floor(i / COLS);
                  const dist = Math.hypot(col - (COLS - 1) / 2, row - (rows - 1) / 2);
                  const Icon = item.icon;
                  return (
                    <Pressable
                      key={item.label}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      onPress={() => select(item.label)}
                      className={cellClass(i, items.length)}
                      style={{ width: PANEL_W / COLS }}
                    >
                      <MotiView
                        from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={
                          reduce
                            ? { type: 'timing', duration: 0 }
                            : { type: 'spring', stiffness: 440, damping: 34, delay: 100 + dist * 70 }
                        }
                        style={{ alignItems: 'center', gap: 8 }}
                      >
                        <Icon size={20} color="#111111" />
                        <Text className="text-sm font-medium text-foreground">{item.label}</Text>
                      </MotiView>
                    </Pressable>
                  );
                })}
              </View>
            </MotiView>
          ) : (
            <MotiView
              key="trigger"
              from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              transition={morph}
            >
              <Pressable
                accessibilityRole="button"
                aria-expanded={open}
                accessibilityLabel={triggerLabel}
                onPress={() => setOpen(true)}
                className="flex-row items-center justify-center gap-2 border border-border bg-card"
                style={{ width: TRIGGER_W, height: TRIGGER_H, borderRadius: 16 }}
              >
                <Text className="text-sm font-medium text-foreground">{triggerLabel}</Text>
                <Plus size={16} color="#111111" />
              </Pressable>
            </MotiView>
          )}
        </AnimatePresence>
      </View>
    </View>
  );
}
