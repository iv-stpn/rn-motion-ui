// biome-ignore-all lint/style/noExcessiveLinesPerFile: FAB shell, morph transition, and trigger/pane layouts collocated by design
import { type ComponentType, type ReactNode, useCallback, useState } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { AddLine as Plus } from 'rn-motion-ui-icons/icons/add-line';
import { CloseLine as X } from 'rn-motion-ui-icons/icons/close-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { EASE_OUT } from '../../../lib/ease';
import { elevated as elevatedSurface, type SurfaceElevation } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { ICON_BUTTON_LG_SIZE, IconButton } from '../../buttons/IconButton/icon-button';
import { ThemedIcon } from '../../icon/themed-icon';

const TRIGGER_SIZE = ICON_BUTTON_LG_SIZE;
/** The collapsed trigger is a circle, so its radius is half the box — whatever
 *  the shared interactive ramp puts an `lg` IconButton at. */
const TRIGGER_RADIUS = TRIGGER_SIZE / 2;
const PANE_RADIUS = 20;

/** Handed to render-prop children so panel content can close the FAB. */
export type MorphingFABApi = {
  /** Close the FAB back to its collapsed trigger. */
  close: () => void;
};

export type MorphingFABProps = {
  /** Expanded pane content, or a render-prop receiving `{ close }`. */
  children: ReactNode | ((api: MorphingFABApi) => ReactNode);
  /** Collapsed trigger icon component. Defaults to a plus (`AddLine`). Rendered
   *  through the trigger's IconButton at 20px with the foreground stroke colour. */
  icon?: ComponentType<IconProps>;
  position?: 'bottom-right' | 'bottom-left';
  /**
   * Swap the trigger's and pane's ladder shadow for the input field's large,
   * diffuse halo (`shadow-floating`). It replaces the `shadow-elevated-N` rung
   * rather than adding to it, so both keep their `elevation` tint but trade the
   * layered drop for the halo. @default false
   */
  floating?: boolean;
  /**
   * Surface elevation level (0–8) — drives the background tint (`bg-surface-N`)
   * and the `shadow-elevated-N` recipe. `0` is the flat resting surface — a
   * `surface-3` fill with no shadow or border. @default 3
   */
  elevation?: SurfaceElevation;
  /** Expanded pane width in px. Defaults to 300. */
  expandedWidth?: number;
  /** Expanded pane height in px. Defaults to 230. */
  expandedHeight?: number;
  /** Controlled open state. */
  open?: boolean;
  /** Uncontrolled initial open state. */
  defaultOpen?: boolean;
  /** Called whenever the FAB opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Close affordance rendered in a top-right header row while open.
   *  Defaults to a small ×. Pass `null` to omit it when the pane
   *  content owns its own close control. */
  closeIcon?: ReactNode | null;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  /** testID for the collapsed trigger button. */
  triggerTestID?: string;
};

/**
 * A floating action button that morphs into a rounded pane. Collapsed it is a
 * circular IconButton (the `lg` size, plus icon by default) whose `floating` /
 * `elevation` drive its styling. Tapping it springs the shell open into a
 * floating surface of `expandedWidth`×`expandedHeight` and renders `children`
 * inside. The pane closes via the top-right close affordance, the render-prop
 * `close()`, or the controlled `open` prop.
 *
 * The collapsed trigger is styled entirely by the IconButton — the shell only
 * paints its surface (background, rim, shadow) once expanded.
 *
 * Use the render-prop form to build interactive content — a feedback form,
 * an action menu, or any custom flow — directly inside the expanded pane.
 */
export function MorphingFAB({
  children,
  icon,
  position = 'bottom-right',
  floating = false,
  elevation = 3,
  expandedWidth = 300,
  expandedHeight = 230,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  closeIcon,
  style,
  accessibilityLabel,
  testID = 'morphing-fab',
  triggerTestID = 'morphing-fab-trigger',
}: MorphingFABProps) {
  const reduce = useReducedMotion();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const left = position === 'bottom-left';

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const handleOpen = useCallback(() => setOpen(true), [setOpen]);
  const handleClose = useCallback(() => setOpen(false), [setOpen]);

  // Staggered springs: width snaps open fast, height bounces — reads as unfolding.
  const morphTransition = reduce
    ? { type: 'timing' as const, duration: 0 }
    : ({
        type: 'spring' as const,
        stiffness: 200,
        damping: 18,
        mass: 0.95,
        width: { type: 'spring' as const, stiffness: 350, damping: 30, mass: 0.55 },
        borderRadius: { type: 'spring' as const, stiffness: 350, damping: 30, mass: 0.55 },
      } satisfies import('../../../moti/core/types').MotiTransition);

  const paneEnterTransition = reduce
    ? { type: 'timing' as const, duration: 0 }
    : { type: 'timing' as const, duration: 200, delay: 150, easing: EASE_OUT };

  const resolvedPane = typeof children === 'function' ? children({ close: handleClose }) : children;

  return (
    <View
      testID={testID}
      style={[
        { position: 'absolute', bottom: 16, zIndex: 30, pointerEvents: 'box-none', ...(left ? { left: 16 } : { right: 16 }) },
        style,
      ]}
    >
      <MotiView
        animate={{
          width: open ? expandedWidth : TRIGGER_SIZE,
          height: open ? expandedHeight : TRIGGER_SIZE,
          borderRadius: open ? PANE_RADIUS : TRIGGER_RADIUS,
        }}
        transition={morphTransition}
        className={`absolute bottom-0 overflow-hidden ${elevatedSurface(elevation, elevation, floating)}`}
        style={{ ...(left ? { left: 0 } : { right: 0 }) }}
      >
        {open ? (
          <View className="w-full">
            {closeIcon === null ? null : (
              <View className="flex-row items-center justify-end px-3 pt-3">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  testID="morphing-fab-close"
                  onPress={handleClose}
                  className="h-5 w-5 items-center justify-center rounded-full bg-surface-selected"
                >
                  {closeIcon ?? <ThemedIcon icon={X} variant="ghost" size={12} />}
                </Pressable>
              </View>
            )}
            <MotiView
              from={reduce ? { opacity: 1 } : { opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={paneEnterTransition}
              className="p-2"
            >
              {resolvedPane}
            </MotiView>
          </View>
        ) : (
          <IconButton
            icon={icon ?? Plus}
            floating={floating}
            elevation={elevation}
            size="lg"
            shape="pill"
            onPress={handleOpen}
            accessibilityLabel={accessibilityLabel ?? 'Open'}
            testID={triggerTestID}
          />
        )}
      </MotiView>
    </View>
  );
}
