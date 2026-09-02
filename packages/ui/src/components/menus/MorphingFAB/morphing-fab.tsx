// biome-ignore-all lint/style/noExcessiveLinesPerFile: FAB shell, morph transition, and trigger/pane layouts collocated by design
import { type ComponentType, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, type StyleProp, useWindowDimensions, View, type ViewStyle } from 'react-native';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { AddLine as Plus } from 'rn-motion-ui-icons/icons/add-line';
import { CloseLine as X } from 'rn-motion-ui-icons/icons/close-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { EASE_OUT, springLayout } from '../../../lib/ease';
import { elevated as elevatedSurface, type SurfaceElevation } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { TIMING_INSTANT } from '../../../theme/motion';
import { ICON_BUTTON_LG_SIZE, IconButton } from '../../buttons/IconButton/icon-button';
import { ThemedIcon } from '../../icon/themed-icon';
import { useBlurTargetRef } from '../Overlay/blur-context';
import { OutsidePressBackdrop, type OutsidePressFrame } from '../Overlay/outside-press-backdrop';
import type { OverlayType } from '../Overlay/overlay-type';
import { TeleportedOverlay } from '../Overlay/teleported-overlay';
import { getWebDocument, isWebNode, type WebPointerEvent } from '../Overlay/web-document';

const TRIGGER_SIZE = ICON_BUTTON_LG_SIZE;
/** The collapsed trigger is a circle, so its radius is half the box — whatever
 *  the shared interactive ramp puts an `lg` IconButton at. */
const TRIGGER_RADIUS = TRIGGER_SIZE / 2;
const PANE_RADIUS = 20;
/** Web animates the size through Moti; Fabric can't round-trip layout props
 *  through `useAnimatedStyle`, so native keeps a static size and drives the
 *  change via this layout transition. */
const IS_WEB = Platform.OS === 'web';
/** The pre-7.0.0 morph spring — underdamped (ζ≈0.65) so the pane overshoots and
 *  settles with a visible bounce, the "unfolding" read. Fabric can't stagger
 *  width against height (one layout transition drives the whole size), so both
 *  axes share this bouncy spring and the radius mirrors it for lockstep. */
const MORPH_SPRING = { stiffness: 200, damping: 18, mass: 0.95 };
const MORPH_LAYOUT = springLayout(MORPH_SPRING);
/** Web's staggered springs — width snaps open fast, height bounces, reading as
 *  unfolding. Web animates the size through Moti, so it still gets the per-axis
 *  stagger Fabric can't express; native shares the base `MORPH_SPRING`. */
const WEB_MORPH_TRANSITION = {
  type: 'spring' as const,
  ...MORPH_SPRING,
  width: { type: 'spring' as const, stiffness: 350, damping: 30, mass: 0.55 },
  borderRadius: { type: 'spring' as const, stiffness: 350, damping: 30, mass: 0.55 },
} satisfies import('../../../moti/core/types').MotiTransition;

/** Fabric-safe radius spring — mirrors `MORPH_LAYOUT` so the corner stays in
 *  lockstep with the layout-driven resize. */
const NATIVE_MORPH_TRANSITION = { type: 'spring' as const, ...MORPH_SPRING };

/**
 * The shell's animated geometry. Web animates the size through Moti alongside
 * the radius (smooth staggered springs); Fabric keeps a static size and drives
 * the change via the `layout` transition (layout props don't round-trip Yoga).
 */
function fabShellGeometry(open: boolean, expandedWidth: number, expandedHeight: number, left: boolean) {
  const size = { width: open ? expandedWidth : TRIGGER_SIZE, height: open ? expandedHeight : TRIGGER_SIZE };
  const anchor = left ? { left: 0 } : { right: 0 };
  return {
    animate: IS_WEB
      ? { ...size, borderRadius: open ? PANE_RADIUS : TRIGGER_RADIUS }
      : { borderRadius: open ? PANE_RADIUS : TRIGGER_RADIUS },
    style: IS_WEB ? anchor : { ...size, ...anchor },
  };
}

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
  /**
   * The scrim behind the pane: `"blur"`, `"opacity"`, or `"none"`. Defaults to
   * `"none"` — like the other morphing menus, it morphs in place with no scrim.
   */
  overlay?: OverlayType;
  /**
   * When true (default), pressing/clicking outside the pane closes the FAB.
   * Works on every platform: web listens on the document, native gets a
   * full-window transparent backdrop measured from the FAB's position.
   * @default true
   */
  closeOnOutsidePress?: boolean;
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
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the open/teleport branches gate the blur teleport and backdrop — flattening them would repeat the shell subtree
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the shell wires trigger measurement, outside-press handling, the morph pane, and the Android blur teleport around shared refs/state — splitting would prop-drill the shared values across function boundaries
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
  overlay = 'none',
  closeOnOutsidePress = true,
}: MorphingFABProps) {
  const reduce = useReducedMotion();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const left = position === 'bottom-left';
  // On Android the blur must render OUTSIDE the `BlurTarget` it frosts (see
  // `OverlayHost`), so a `"blur"` FAB teleports its backdrop + shell there —
  // the morph still runs, the shell just lives in the overlay host instead of
  // inline. The host tree is ALSO where the Fabric layout transition captures
  // its start frame correctly: inside the `BlurTarget`/ScrollView tree the
  // shell's LinearTransition starts from the pane's top-left corner, so the
  // pane appears to grow from there instead of unfolding from the trigger
  // (verified on-device: blur/teleported morphs correctly, none/opacity do
  // not). Whenever a host exists, render through it for EVERY `overlay` —
  // `overlay` still decides the scrim, teleporting only relocates the
  // backdrop + shell into the host. Without a provider (`blurTargetRef`
  // null) the FAB stays inline.
  const blurTargetRef = useBlurTargetRef();
  const teleported = Platform.OS === 'android' && blurTargetRef !== null;

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const handleOpen = useCallback(() => setOpen(true), [setOpen]);
  const handleClose = useCallback(() => setOpen(false), [setOpen]);

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const rootRef = useRef<View>(null);
  /**
   * The outside-press backdrop's window-covering frame — negative offsets from
   * the FAB's window position, so an absolutely-positioned child inside the
   * (small, corner-anchored) root still covers the whole window and catches
   * outside taps on native (web closes via its document listener instead).
   * Null while closed or before the async native measure lands.
   */
  const [backdropFrame, setBackdropFrame] = useState<OutsidePressFrame | null>(null);

  // Measure the root's window position whenever the pane opens (or the window
  // resizes while open — rotation) so the native outside-press backdrop exactly
  // covers the window. `measureInWindow` is async on native; until the frame
  // lands there is simply no backdrop yet.
  // biome-ignore lint/plugin: measuring the root on open/rotate is a DOM/native measure side effect, not derived state — the backdrop frame must follow the window
  useEffect(() => {
    if (!(open && (overlay !== 'none' || closeOnOutsidePress))) {
      setBackdropFrame(null);
      return;
    }
    rootRef.current?.measureInWindow((x, y) => {
      setBackdropFrame({ top: -y, left: -x, width: windowWidth, height: windowHeight });
    });
  }, [open, overlay, closeOnOutsidePress, windowWidth, windowHeight]);

  /**
   * The root's fixed window corner — the FAB pins its bottom edge and one
   * horizontal edge (`left`/`right`) as it grows, so this is that bottom corner.
   * Measured on every root layout (mount, open/close, rotation) via the root's
   * `onLayout` below; the teleported overlay derives its top-left from this minus
   * the current shell size, so it never re-measures (and never glitches) when the
   * pane opens or closes.
   */
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const measureAnchor = useCallback(() => {
    if (!teleported) {
      setAnchor(null);
      return;
    }
    // The FAB pins one horizontal edge and the bottom edge as it grows, so the
    // anchor is that fixed corner: bottom-left for `position="bottom-left"`,
    // bottom-right otherwise.
    rootRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x: left ? x : x + width, y: y + height }));
  }, [teleported, left]);

  // `onLayout` alone misses the teleport toggle — flipping `overlay` to "blur"
  // changes the children, not the root's own layout, so no layout event fires and
  // the shell never measures. Run the measure once per teleport/left change
  // (mount + toggle); `onLayout` below covers rotation and size changes, and the
  // extra run on every `open` covers the root having scrolled under the FAB
  // while closed (the teleported shell must open where the trigger IS, not where
  // it was at mount).
  // biome-ignore lint/plugin: measuring the root is a native measure side effect, not derived state — the teleported overlay must follow the window
  // biome-ignore lint/correctness/useExhaustiveDependencies: `open` is an intentional re-measure trigger (scroll-under-FAB while closed), not a body dependency
  useEffect(() => {
    measureAnchor();
  }, [measureAnchor, open]);

  // Close on an outside press (web). The FAB is inline — no modal backdrop to
  // catch a stray press — so a document-level `pointerdown` listener detects a
  // press landing anywhere but the FAB and folds it shut. `getWebDocument()`
  // returns undefined off-web, where an inline control has no outside press.
  // biome-ignore lint/plugin: document-level pointerdown can't be expressed as an RN handler or derived state
  useEffect(() => {
    if (!(open && closeOnOutsidePress)) return;
    const doc = getWebDocument();
    if (!doc) return;

    const onPointerDown = (event: WebPointerEvent) => {
      const node = rootRef.current;
      const target = event.target;
      if (isWebNode(node) && node.contains(target)) return;
      setOpen(false);
    };

    doc.addEventListener('pointerdown', onPointerDown);
    return () => doc.removeEventListener('pointerdown', onPointerDown);
  }, [open, closeOnOutsidePress, setOpen]);

  // Web restores the pre-7.0.0 staggered springs (width snaps open fast, height
  // bounces); Fabric springs only the radius and drives the size via the layout
  // transition above.
  const morphSpring = IS_WEB ? WEB_MORPH_TRANSITION : NATIVE_MORPH_TRANSITION;
  const morphTransition = reduce ? TIMING_INSTANT : morphSpring;

  const paneEnterTransition = reduce ? TIMING_INSTANT : { type: 'timing' as const, duration: 200, delay: 150, easing: EASE_OUT };

  const resolvedPane = typeof children === 'function' ? children({ close: handleClose }) : children;
  const shell = fabShellGeometry(open, expandedWidth, expandedHeight, left);

  // The teleported wrapper's top-left: the fixed root's top-left — its bottom
  // corner (the anchor) minus the expanded size. The root never resizes, so
  // this is constant and the teleported shell can't drift from the inline one.
  const rootWindow = anchor ? { x: left ? anchor.x : anchor.x - expandedWidth, y: anchor.y - expandedHeight } : null;

  // Outside-press backdrop (native): covers the whole window so a tap anywhere
  // outside the pane folds it back — the web path is the document listener
  // above. When `overlay` is on it also dims the page. Teleported it passes
  // `blurInline={false}` so the frost actually renders OUT of the BlurTarget.
  const backdrop =
    open && (overlay !== 'none' || closeOnOutsidePress) && backdropFrame !== null ? (
      <OutsidePressBackdrop
        frame={backdropFrame}
        onPress={closeOnOutsidePress ? handleClose : undefined}
        overlay={overlay}
        blurInline={!teleported}
        testID={`${testID}-backdrop`}
      />
    ) : null;

  const shellView = (
    <MotiView
      animate={shell.animate}
      transition={morphTransition}
      layout={reduce || IS_WEB ? undefined : MORPH_LAYOUT}
      className={`absolute bottom-0 overflow-hidden ${elevatedSurface(elevation, elevation, floating)}`}
      style={shell.style}
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
  );

  return (
    <View
      ref={rootRef}
      collapsable={false}
      testID={testID}
      onLayout={measureAnchor}
      style={[
        {
          position: 'absolute',
          bottom: 16,
          zIndex: 30,
          pointerEvents: 'box-none',
          // Keep the root at the FULL expanded size in both states. A root that
          // resizes with the shell moves its top-left when the pane opens, so
          // the shell's Fabric layout transition morphs around that moving
          // origin — the pane appears to grow from its top-left corner instead
          // of unfolding from the trigger, and collapses inverted on close.
          // With a fixed root the shell (anchored right/bottom in
          // `fabShellGeometry`) morphs about its own pinned bottom corner. The
          // constant size also keeps the box non-zero, so Fabric mounts the
          // absolute shell (a 0×0 parent drops it).
          width: expandedWidth,
          height: expandedHeight,
          ...(left ? { left: 16 } : { right: 16 }),
        },
        style,
      ]}
    >
      {teleported ? (
        <TeleportedOverlay teleported={teleported} rootWindow={rootWindow} width={expandedWidth} height={expandedHeight}>
          {backdrop}
          {shellView}
        </TeleportedOverlay>
      ) : (
        <>
          {backdrop}
          {shellView}
        </>
      )}
    </View>
  );
}
