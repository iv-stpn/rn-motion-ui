// biome-ignore-all lint/style/noExcessiveLinesPerFile: three surfaces (bottomSheet / fullSheet / wide modal+drawer) share one render path — splitting scatters tightly-coupled layout state

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Easing } from 'react-native-reanimated';
import { useModalRender } from '../../../hooks/use-modal-render';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { useSafeInsets } from '../../../hooks/use-safe-insets';
import { type BreakpointValue, isWidthAtLeast } from '../../../lib/breakpoints';
import { cn } from '../../../lib/cn';
import { type SurfaceElevation, surfaceBackground } from '../../../lib/elevated';
import { surface } from '../../../lib/surface';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { CloseButton } from '../../buttons/CloseButton/close-button';
import { Text } from '../../typography/Text/text';
import { BottomSheet } from '../BottomSheet/bottom-sheet';
import { FullSheet } from '../FullSheet/full-sheet';
import { OverlayOutlet } from '../Overlay/overlay-portal';
import { OverlayScrim } from '../Overlay/overlay-scrim';
import type { OverlayType } from '../Overlay/overlay-type';

/** Narrow vs. wide layout cutoff — matches FullSheet's default. */
const DEFAULT_WIDE_BREAKPOINT: BreakpointValue = 'sm';

/**
 * Freezes `value` while `active` is false, so exit animations keep showing the
 * last children/title/subtitle instead of collapsing mid-exit.
 */
function useLatchedValue<T>(value: T, active: boolean): T {
  const [latched, setLatched] = useState(value);
  // biome-ignore lint/plugin: latched value must trail `value` only while active — syncing state to a prop is intentional, not derivable
  useEffect(() => {
    if (active) setLatched(value);
  }, [value, active]);
  return active ? value : latched;
}

type AdaptiveModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showClose?: boolean;
  smallScreenMode?: SmallScreenMode;
  largeScreenMode?: LargeScreenMode;
  scrollable?: boolean;
  /**
   * Static size for the centered desktop panel (largeScreenMode="modal").
   * Each dimension accepts a pixel number or a percentage string (e.g. `'80%'`), resolved against the window size.
   * When omitted, the panel sizes to content with `min-w-xl max-w-xl` and a max-height cap.
   */
  widePanelSize?: WidePanelSize;
  /** Reduces the padding around the header and content. */
  compact?: boolean;
  /** Overrides the breakpoint-derived wide/narrow layout decision. */
  isWideScreen?: boolean;
  /**
   * Width at which the wide (modal / drawer) layout takes over — a breakpoint
   * name or a raw pixel number. @default 'sm' (640)
   */
  wideBreakpoint?: BreakpointValue;
  /** When true, the caller fully owns the content layout and the modal applies no container padding. */
  customLayout?: boolean;
  /** Called after the close animation has fully completed and the modal is unmounted. */
  onAfterClose?: () => void;
  /**
   * Fires after the modal has fully presented (iOS `Modal.onShow`) — the moment
   * it is safe to request keyboard focus on content inside it. Forwards to the
   * wide `Modal` or the narrow `BottomSheet` / `FullSheet`. No-op on web.
   */
  onShow?: () => void;
  /** The scrim behind the panel: `"blur"`, `"opacity"`, or `"none"`. Defaults to `"blur"`. */
  overlay?: OverlayType;
  /** Overrides `overlay` on the small-screen bottom sheet. When omitted, the sheet uses `overlay`. */
  smallScreenOverlay?: OverlayType;
  /** When false, pressing outside the panel will not close the modal. Defaults to true. */
  closeOnOutsidePress?: boolean;
  /**
   * Swap the wide (desktop) panel's ladder shadow for the input field's large,
   * diffuse halo (`shadow-floating`). It replaces the `shadow-elevated-N` rung
   * rather than adding to it, so the panel keeps its `elevation` tint but
   * trades the layered drop for the halo. @default false
   */
  floating?: boolean;
  /** Surface elevation (0–8) for the wide (desktop) panel — drives the drop shadow + dark-mode rim. `0` is the flat resting surface (no shadow or border). Defaults to 6. */
  elevation?: SurfaceElevation;
  /**
   * Wrap content in device safe-area insets. Passed through to BottomSheet /
   * FullSheet on narrow screens; applied directly to the right-drawer panel on
   * wide screens. Requires `react-native-safe-area-context` and
   * `<SafeAreaProvider>` in the tree. Set to `false` to manage insets yourself.
   * @default true
   */
  safeArea?: boolean;
  testID?: string;
};

function resolvePanelDimension(value: Dimension | undefined, viewportSize: number): number | undefined {
  if (value === undefined) return;
  return typeof value === 'number' ? value : Math.round((Number.parseFloat(value) / 100) * viewportSize);
}

type LayoutPaddingContext = { customLayout: boolean; compact: boolean; isWideScreen: boolean; isBottomSheet: boolean };

function resolveLayoutPaddingClass(
  context: LayoutPaddingContext,
  compactClasses: readonly [string, string, string],
  defaultClasses: readonly [string, string, string],
): string {
  if (context.customLayout) return '';
  const classes = context.compact ? compactClasses : defaultClasses;
  if (context.isWideScreen) return classes[0];
  return context.isBottomSheet ? classes[1] : classes[2];
}

type CenteredPanelGeometry = {
  wideWidth: number | undefined;
  wideHeight: number | undefined;
  wideMaxWidth: number | undefined;
  wideMaxHeight: number | undefined;
  maxModalHeight: number;
};

export type SmallScreenMode = 'bottomSheet' | 'fullSheet';
export type LargeScreenMode = 'modal' | 'rightDrawer';

export type Dimension = number | `${number}%`;
export type WidePanelSize = { width?: Dimension; height?: Dimension; maxWidth?: Dimension; maxHeight?: Dimension };

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the three branches share header/content/padding helpers — the line budget is the surface count, not branch depth
export function AdaptiveModal({
  open: openProp,
  onOpenChange,
  children,
  title,
  subtitle,
  showClose,
  smallScreenMode = 'fullSheet',
  largeScreenMode = 'modal',
  scrollable = true,
  widePanelSize,
  compact = false,
  isWideScreen: isWideScreenOverride,
  wideBreakpoint = DEFAULT_WIDE_BREAKPOINT,
  customLayout = false,
  onAfterClose,
  onShow,
  overlay = 'blur',
  smallScreenOverlay,
  closeOnOutsidePress = true,
  floating = false,
  elevation = 6,
  safeArea = true,
  testID,
}: AdaptiveModalProps) {
  const reduce = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const isWideScreen = isWideScreenOverride ?? isWidthAtLeast(width, wideBreakpoint);
  const insets = useSafeInsets();

  const open = openProp ?? false;
  const handleClose = useCallback(() => {
    onOpenChange?.(false);
  }, [onOpenChange]);

  const isBottomSheet = smallScreenMode === 'bottomSheet';
  const isRightDrawer = largeScreenMode === 'rightDrawer';
  // The small-screen bottom sheet defaults to the same scrim as the wide panel;
  // `smallScreenOverlay` lets a consumer lighten (or drop) it on touch surfaces.
  const smallOverlay = smallScreenOverlay ?? overlay;

  const desktopEnterOffset = 18;
  const desktopExitOffset = 10;
  const drawerEnterOffset = 52;
  const drawerExitOffset = 26;

  const overlayTransition = reduce
    ? { type: 'timing' as const, duration: 120, easing: Easing.linear }
    : { type: 'timing' as const, duration: 220, easing: Easing.out(Easing.cubic) };
  const desktopPanelTransition = reduce
    ? { type: 'timing' as const, duration: 140, easing: Easing.linear }
    : { type: 'spring' as const, damping: 24, stiffness: 260, mass: 0.95 };
  const drawerPanelTransition = reduce
    ? { type: 'timing' as const, duration: 140, easing: Easing.linear }
    : { type: 'spring' as const, damping: 27, stiffness: 280, mass: 0.94 };
  const panelExitTransition = reduce
    ? { type: 'timing' as const, duration: 90, easing: Easing.linear }
    : { type: 'timing' as const, duration: 180, easing: Easing.in(Easing.cubic) };

  const renderedChildren = useLatchedValue(children, open);
  const renderedTitle = useLatchedValue(title, open);
  const renderedSubtitle = useLatchedValue(subtitle, open);

  // The wide surface owns its own Modal + AnimatePresence. useModalRender keeps
  // it mounted until the exit animation finishes (mirrors FullSheet/MorphingModal).
  // When the screen narrows mid-open, `isWideOpen` flips false and the wide branch
  // stops rendering entirely (React unmounts the Modal), so no exit anim plays —
  // the narrow surface takes over immediately.
  const isWideOpen = open && isWideScreen;
  const { rendered: isWideMounted, onExitComplete } = useModalRender(isWideOpen);

  const closeButton = showClose ? <CloseButton onPress={handleClose} /> : null;

  const handleExitComplete = useCallback(() => {
    onExitComplete();
    onAfterClose?.();
  }, [onExitComplete, onAfterClose]);

  const hasHeader = Boolean(renderedTitle || renderedSubtitle || showClose);

  const paddingContext: LayoutPaddingContext = { customLayout, compact, isWideScreen, isBottomSheet };
  const containerPaddingClass = resolveLayoutPaddingClass(
    paddingContext,
    ['px-6 pt-6', 'px-6 pt-3', 'px-5 pt-6'],
    ['px-10 pt-8', 'px-8 pt-4', 'px-6 pt-8'],
  );
  const contentBottomPaddingClass = resolveLayoutPaddingClass(paddingContext, ['pb-6', 'pb-3', 'pb-5'], ['pb-8', 'pb-5', 'pb-6']);

  const renderHeader = () =>
    hasHeader ? (
      <View className={compact ? 'mb-3' : 'mb-4'}>
        <View className="flex-row items-start justify-between gap-4">
          {renderedTitle || renderedSubtitle ? (
            <View className="min-w-0 flex-1 gap-2">
              {renderedTitle ? (
                <Text weight="semibold" className="mr-4 pt-1 text-foreground text-xl">
                  {renderedTitle}
                </Text>
              ) : null}
              {renderedSubtitle ? (
                <Text className="text-base text-muted-foreground leading-relaxed">{renderedSubtitle}</Text>
              ) : null}
            </View>
          ) : (
            <View className="flex-1" />
          )}
          {closeButton}
        </View>
      </View>
    ) : null;

  const renderContent = useCallback(
    (contentClassName?: string) => {
      if (scrollable)
        return (
          <ScrollView
            className={cn('min-h-0 flex-1', contentClassName)}
            contentContainerClassName="grow"
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className={contentBottomPaddingClass}>{renderedChildren}</View>
          </ScrollView>
        );

      return <View className={cn('w-full flex-1', contentClassName, contentBottomPaddingClass)}>{renderedChildren}</View>;
    },
    [renderedChildren, contentBottomPaddingClass, scrollable],
  );

  const renderBottomSheetContent = useCallback(() => {
    if (scrollable)
      return (
        <ScrollView
          className="w-full"
          style={{ maxHeight: Math.round(height * 0.72) }}
          contentContainerClassName="grow"
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className={contentBottomPaddingClass}>{renderedChildren}</View>
        </ScrollView>
      );

    return <View className={cn('w-full', contentBottomPaddingClass)}>{renderedChildren}</View>;
  }, [renderedChildren, contentBottomPaddingClass, height, scrollable]);

  const renderDrawerPanel = (drawerWidth: number) => (
    <TouchableOpacity className="flex-1" activeOpacity={1} onPress={closeOnOutsidePress ? handleClose : undefined}>
      <View className="flex-1 items-end">
        <MotiView
          className="h-full"
          from={{ opacity: 0, translateX: drawerEnterOffset }}
          animate={{ opacity: 1, translateX: 0 }}
          exit={{ opacity: 0, translateX: drawerExitOffset }}
          transition={drawerPanelTransition}
          exitTransition={panelExitTransition}
        >
          <TouchableOpacity activeOpacity={1} className="h-full" style={{ width: drawerWidth }}>
            <View
              className={cn('h-full px-8 pt-8 pb-8', surfaceBackground(elevation))}
              accessibilityViewIsModal={true}
              aria-modal={true}
              role="dialog"
              aria-label={renderedTitle}
              testID={testID}
              style={safeArea ? { paddingTop: insets.top, paddingBottom: insets.bottom } : undefined}
            >
              {renderHeader()}
              {renderContent()}
            </View>
          </TouchableOpacity>
        </MotiView>
      </View>
    </TouchableOpacity>
  );

  const renderCenteredPanel = (geometry: CenteredPanelGeometry) => {
    const { wideWidth, wideHeight, wideMaxWidth, wideMaxHeight, maxModalHeight } = geometry;
    return (
      <TouchableOpacity
        className="flex-1 items-center justify-center px-8"
        activeOpacity={1}
        onPress={closeOnOutsidePress ? handleClose : undefined}
      >
        <MotiView
          from={{ opacity: 0, scale: 0.965, translateY: desktopEnterOffset }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          exit={{ opacity: 0, scale: 0.985, translateY: desktopExitOffset }}
          transition={desktopPanelTransition}
          exitTransition={panelExitTransition}
        >
          <TouchableOpacity
            activeOpacity={1}
            className={cn(wideWidth === undefined && 'w-full', !widePanelSize && 'min-w-xl max-w-xl')}
            style={{ width: wideWidth, height: wideHeight, maxWidth: wideMaxWidth, maxHeight: wideMaxHeight }}
          >
            <View
              className={cn(
                surface(elevation, 'modal', floating),

                wideHeight !== undefined && 'flex-1',
                containerPaddingClass,
              )}
              style={wideHeight === undefined ? { maxHeight: maxModalHeight } : undefined}
              accessibilityViewIsModal={true}
              aria-modal={true}
              role="dialog"
              testID={testID}
              aria-label={renderedTitle}
            >
              {renderHeader()}
              {renderContent()}
            </View>
          </TouchableOpacity>
        </MotiView>
      </TouchableOpacity>
    );
  };

  const renderWideSurface = () => {
    const drawerWidth = Math.min(760, Math.max(460, Math.round(width * 0.44)));
    const maxModalHeight = Math.min(height - 80, 976);

    const wideWidth = resolvePanelDimension(widePanelSize?.width, width);
    const wideHeight = resolvePanelDimension(widePanelSize?.height, height);
    const wideMaxWidth = resolvePanelDimension(widePanelSize?.maxWidth, width);
    const wideMaxHeight = resolvePanelDimension(widePanelSize?.maxHeight, height);

    return (
      <Modal
        visible={isWideMounted}
        transparent={true}
        animationType="none"
        statusBarTranslucent={true}
        accessibilityViewIsModal={true}
        onRequestClose={handleClose}
        onShow={onShow}
      >
        <AnimatePresence onExitComplete={handleExitComplete}>
          {isWideOpen ? (
            <MotiView
              key="wide-overlay"
              className={cn('flex-1', overlay === 'blur' && 'backdrop-blur-xs')}
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={overlayTransition}
            >
              <OverlayScrim type={overlay} dimClassName="bg-black/40" dimOnBlur={false} />
              {isRightDrawer
                ? renderDrawerPanel(drawerWidth)
                : renderCenteredPanel({ wideWidth, wideHeight, wideMaxWidth, wideMaxHeight, maxModalHeight })}
            </MotiView>
          ) : null}
        </AnimatePresence>
        {/* Overlay outlet: above the panel, outside the scrim and panel animations. */}
        <OverlayOutlet />
      </Modal>
    );
  };

  if (isWideScreen) return renderWideSurface();

  return isBottomSheet ? (
    <BottomSheet
      open={open}
      onOpenChange={handleClose}
      containerClassName={containerPaddingClass}
      onAfterClose={onAfterClose}
      onShow={onShow}
      overlay={smallOverlay}
      closeOnOutsidePress={closeOnOutsidePress}
      safeArea={safeArea}
      testID={testID}
    >
      {renderHeader()}
      {renderBottomSheetContent()}
    </BottomSheet>
  ) : (
    <FullSheet
      open={open}
      onOpenChange={handleClose}
      customLayout={true}
      onAfterClose={onAfterClose}
      onShow={onShow}
      safeArea={safeArea}
      testID={testID}
    >
      <View className={cn('flex-1', containerPaddingClass)}>
        {renderHeader()}
        {renderContent()}
      </View>
    </FullSheet>
  );
}
