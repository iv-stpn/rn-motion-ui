import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Easing } from 'react-native-reanimated';
import { useModalRender } from '../../hooks/use-modal-render';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { X } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { BottomSheet } from '../BottomSheet/bottom-sheet';
import { FullSheet } from '../FullSheet/full-sheet';
import { Text } from '../Text/text';

// Narrow vs. wide layout cutoff — matches FullSheet's SMALL_SCREEN_BREAKPOINT.
const WIDE_BREAKPOINT = 640;

/** Join truthy class strings. (Local helper — this package ships no shared `cn`.) */
function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => typeof part === 'string').join(' ');
}

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
  /** @deprecated Use `open` instead. */
  visible?: boolean;
  /** @deprecated Use `onOpenChange` instead. */
  onClose?: () => void;
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
  /** When true, the caller fully owns the content layout and the modal applies no container padding. */
  customLayout?: boolean;
  /** Called after the close animation has fully completed and the modal is unmounted. */
  onAfterClose?: () => void;
  /** When false, clicking the overlay will not close the modal. Defaults to true. */
  closeOnOverlayClick?: boolean;
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

export type SmallScreenMode = 'bottomSheet' | 'fullSheet';
export type LargeScreenMode = 'modal' | 'rightDrawer';

export type Dimension = number | `${number}%`;
export type WidePanelSize = { width?: Dimension; height?: Dimension; maxWidth?: Dimension; maxHeight?: Dimension };

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: three surfaces (bottomSheet / fullSheet / wide modal+drawer) share one render path — splitting scatters tightly-coupled layout state
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: same reason — the three branches share header/content/padding helpers
export function AdaptiveModal({
  open: openProp,
  onOpenChange,
  visible,
  onClose,
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
  customLayout = false,
  onAfterClose,
  closeOnOverlayClick = true,
}: AdaptiveModalProps) {
  const reduce = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const isWideScreen = isWideScreenOverride ?? width >= WIDE_BREAKPOINT;

  const open = openProp ?? visible ?? false;
  const handleClose = useCallback(() => {
    onClose?.();
    onOpenChange?.(false);
  }, [onClose, onOpenChange]);

  const isBottomSheet = smallScreenMode === 'bottomSheet';
  const isRightDrawer = largeScreenMode === 'rightDrawer';

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

  const closeButton = showClose ? (
    <Pressable onPress={handleClose} hitSlop={8} accessibilityLabel="Close">
      <X size={20} />
    </Pressable>
  ) : null;

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

  const header = hasHeader ? (
    <View className={compact ? 'mb-3' : 'mb-4'}>
      <View className="flex-row items-start justify-between gap-4">
        {renderedTitle || renderedSubtitle ? (
          <View className="min-w-0 flex-1 gap-2">
            {renderedTitle ? <Text className="mr-4 pt-1 font-semibold text-foreground text-xl">{renderedTitle}</Text> : null}
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

  if (isWideScreen) {
    const drawerWidth = Math.min(760, Math.max(460, Math.round(width * 0.44)));
    const maxModalHeight = Math.min(height - 80, 976);

    const widePanelWidth = resolvePanelDimension(widePanelSize?.width, width);
    const widePanelHeight = resolvePanelDimension(widePanelSize?.height, height);
    const widePanelMaxWidth = resolvePanelDimension(widePanelSize?.maxWidth, width);
    const widePanelMaxHeight = resolvePanelDimension(widePanelSize?.maxHeight, height);

    return (
      <Modal
        visible={isWideMounted}
        transparent={true}
        animationType="none"
        statusBarTranslucent={true}
        accessibilityViewIsModal={true}
        onRequestClose={handleClose}
      >
        <AnimatePresence onExitComplete={handleExitComplete}>
          {isWideOpen ? (
            <MotiView
              key="wide-overlay"
              className="flex-1 backdrop-blur-xs"
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={overlayTransition}
            >
              {isRightDrawer ? (
                <TouchableOpacity className="flex-1" activeOpacity={1} onPress={closeOnOverlayClick ? handleClose : undefined}>
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
                          className="h-full bg-surface px-8 pt-8 pb-8"
                          accessibilityViewIsModal={true}
                          aria-modal={true}
                          role="dialog"
                          aria-label={renderedTitle}
                        >
                          {header}
                          {renderContent()}
                        </View>
                      </TouchableOpacity>
                    </MotiView>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  className="flex-1 items-center justify-center px-8"
                  activeOpacity={1}
                  onPress={closeOnOverlayClick ? handleClose : undefined}
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
                      className={cn(widePanelWidth === undefined && 'w-full', !widePanelSize && 'min-w-xl max-w-xl')}
                      style={{
                        width: widePanelWidth,
                        height: widePanelHeight,
                        maxWidth: widePanelMaxWidth,
                        maxHeight: widePanelMaxHeight,
                      }}
                    >
                      <View
                        className={cn(
                          'rounded-2xl border border-border bg-surface shadow-modal',
                          widePanelHeight !== undefined && 'flex-1',
                          containerPaddingClass,
                        )}
                        style={widePanelHeight === undefined ? { maxHeight: maxModalHeight } : undefined}
                        accessibilityViewIsModal={true}
                        aria-modal={true}
                        role="dialog"
                        aria-label={renderedTitle}
                      >
                        {header}
                        {renderContent()}
                      </View>
                    </TouchableOpacity>
                  </MotiView>
                </TouchableOpacity>
              )}
            </MotiView>
          ) : null}
        </AnimatePresence>
      </Modal>
    );
  }

  return isBottomSheet ? (
    <BottomSheet
      open={open}
      onClose={handleClose}
      containerClassName={containerPaddingClass}
      onAfterClose={onAfterClose}
      closeOnOverlayClick={closeOnOverlayClick}
    >
      {header}
      {renderBottomSheetContent()}
    </BottomSheet>
  ) : (
    <FullSheet open={open} onClose={handleClose} customLayout={true} onAfterClose={onAfterClose}>
      <View className={cn('flex-1', containerPaddingClass)}>
        {header}
        {renderContent()}
      </View>
    </FullSheet>
  );
}
