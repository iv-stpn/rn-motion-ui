import { type ReactNode, useCallback } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Easing } from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { ChevronRight, X } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { OverlayShell } from '../Overlay/overlay-shell';
import { Text } from '../Text/text';

const BACK_BUTTON_HEADER_HEIGHT = 56;
const SMALL_SCREEN_BREAKPOINT = 640;

type BuildBodyArgs = {
  mode: FullSheetMode;
  isSmallScreen: boolean;
  title: string | undefined;
  subtitle: string | undefined;
  showClose: boolean | undefined;
  dismissable: boolean;
  handleClose: () => void;
  customLayout: boolean;
  children: ReactNode;
  headerSlot: FullSheetProps['header'];
  compact: boolean;
  scrollable: boolean;
  px: string;
  pt: string;
  pb: string;
  closeIcon: ReactNode | undefined;
  backIcon: ReactNode | undefined;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: two layout modes (back-button/default) plus header-slot branching share one body builder — splitting would scatter tightly-coupled layout state
function buildBody({
  mode,
  isSmallScreen,
  title,
  subtitle,
  showClose,
  dismissable,
  handleClose,
  customLayout,
  children,
  headerSlot,
  compact,
  scrollable,
  px,
  pt,
  pb,
  closeIcon,
  backIcon,
}: BuildBodyArgs): ReactNode {
  if (mode === 'back-button') {
    const headerH = isSmallScreen && title ? BACK_BUTTON_HEADER_HEIGHT : 0;
    let backOverlay: ReactNode = null;
    if (isSmallScreen && title)
      backOverlay = (
        <View
          className="absolute top-0 right-0 left-0 z-10 flex-row items-center bg-surface-3"
          style={{ height: BACK_BUTTON_HEADER_HEIGHT }}
        >
          {dismissable ? (
            <Pressable onPress={handleClose} hitSlop={8} accessibilityLabel="Back" className="ml-2 p-2">
              <View style={{ transform: [{ rotate: '180deg' }] }}>{backIcon ?? <ChevronRight size={20} />}</View>
            </Pressable>
          ) : (
            <View className="ml-2 h-10 w-10" />
          )}
          <Text className="flex-1 pr-4 pl-2 font-semibold text-foreground text-xl" numberOfLines={1}>
            {title}
          </Text>
        </View>
      );
    else if (dismissable)
      backOverlay = (
        <View className="absolute top-3 left-4">
          <Pressable onPress={handleClose} hitSlop={8} accessibilityLabel="Back" className="p-2">
            <View style={{ transform: [{ rotate: '180deg' }] }}>{backIcon ?? <ChevronRight size={20} />}</View>
          </Pressable>
        </View>
      );
    return (
      <>
        <View className="flex-1" style={{ paddingTop: headerH }}>
          {children}
        </View>
        {backOverlay}
      </>
    );
  }

  if (customLayout) return children;

  let resolvedHeader: ReactNode;
  if (headerSlot === undefined) {
    const hasHeader = Boolean(title || subtitle || showClose);
    resolvedHeader = hasHeader ? (
      <View className={compact ? 'mb-3' : 'mb-4'}>
        <View className="flex-row items-start justify-between gap-4">
          {title || subtitle ? (
            <View className="min-w-0 flex-1 gap-2">
              {title ? <Text className="mr-4 pt-1 font-semibold text-foreground text-xl">{title}</Text> : null}
              {subtitle ? <Text className="text-base text-muted-foreground leading-relaxed">{subtitle}</Text> : null}
            </View>
          ) : (
            <View className="flex-1" />
          )}
          {showClose && dismissable ? (
            <Pressable onPress={handleClose} hitSlop={8} accessibilityLabel="Close">
              {closeIcon ?? <X size={20} />}
            </Pressable>
          ) : null}
        </View>
      </View>
    ) : null;
  } else resolvedHeader = typeof headerSlot === 'function' ? headerSlot({ close: handleClose }) : headerSlot;

  return (
    <View className={`flex-1 ${px} ${pt}`}>
      {resolvedHeader}
      {scrollable ? (
        <ScrollView
          className="min-h-0 flex-1"
          contentContainerClassName="grow"
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className={pb}>{children}</View>
        </ScrollView>
      ) : (
        <View className={`w-full flex-1 ${pb}`}>{children}</View>
      )}
    </View>
  );
}

export type FullSheetMode = 'default' | 'back-button';

/** Context passed to the `header` render-prop. */
export type FullSheetHeaderCtx = { close: () => void };

export type FullSheetProps = {
  // New preferred API
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Deprecated aliases
  /** @deprecated Use `open` instead. */
  visible?: boolean;
  /** @deprecated Use `onOpenChange` instead. */
  onClose?: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Show a close (X) button in the default-mode header. */
  showClose?: boolean;
  /** Wrap content in a ScrollView (default true). */
  scrollable?: boolean;
  /** Tighter horizontal/vertical padding (default false). */
  compact?: boolean;
  /** Caller owns all layout — no header or content padding is applied. */
  customLayout?: boolean;
  /**
   * `'default'` — standard header with optional title and close button (default).
   * `'back-button'` — back arrow overlaid at top-left; caller owns content layout.
   */
  mode?: FullSheetMode;
  /** When false, buttons are hidden and the sheet cannot be dismissed. */
  dismissable?: boolean;
  /** Called after the close animation fully completes. */
  onAfterClose?: () => void;
  /**
   * Replaces the built-in title/subtitle/X header.
   * Pass a ReactNode or a function `(ctx: FullSheetHeaderCtx) => ReactNode`.
   * When omitted, the existing title/subtitle/showClose props build the header.
   */
  header?: ReactNode | ((ctx: FullSheetHeaderCtx) => ReactNode);
  /** Replace the close (×) button icon. Default: `<X size={20} />`. */
  closeIcon?: ReactNode;
  /** Replace the back-button chevron icon. Default: rotated `<ChevronRight size={20} />`. */
  backIcon?: ReactNode;
};

export function FullSheet({
  open,
  onOpenChange,
  visible,
  onClose,
  children,
  title,
  subtitle,
  showClose,
  scrollable = true,
  compact = false,
  customLayout = false,
  mode = 'default',
  dismissable = true,
  onAfterClose,
  header: headerSlot,
  closeIcon,
  backIcon,
}: FullSheetProps) {
  const isOpen = open ?? visible ?? false;
  const { height, width } = useWindowDimensions();
  const isSmallScreen = width < SMALL_SCREEN_BREAKPOINT;
  const reduced = useReducedMotion();

  const handleClose = useCallback(() => {
    onClose?.();
    onOpenChange?.(false);
  }, [onClose, onOpenChange]);

  const enterTransition = {
    type: 'timing' as const,
    duration: reduced ? 160 : 340,
    easing: reduced ? Easing.linear : Easing.out(Easing.cubic),
  };
  const exitTransition = {
    type: 'timing' as const,
    duration: reduced ? 160 : 300,
    easing: reduced ? Easing.linear : Easing.in(Easing.cubic),
  };

  const px = compact ? 'px-5' : 'px-6';
  const pt = compact ? 'pt-6' : 'pt-8';
  const pb = compact ? 'pb-5' : 'pb-6';

  return (
    <OverlayShell open={isOpen} onClose={handleClose} onAfterClose={onAfterClose} dismissable={dismissable}>
      {({ open: isAnimOpen, onExitComplete }) => {
        const body = buildBody({
          mode,
          isSmallScreen,
          title,
          subtitle,
          showClose,
          dismissable,
          handleClose,
          customLayout,
          children,
          headerSlot,
          compact,
          scrollable,
          px,
          pt,
          pb,
          closeIcon,
          backIcon,
        });
        return (
          <AnimatePresence onExitComplete={onExitComplete}>
            {isAnimOpen ? (
              <MotiView
                key="fullsheet"
                className="flex-1 bg-surface-3"
                from={{ translateY: height }}
                animate={{ translateY: 0 }}
                exit={{ translateY: height }}
                transition={enterTransition}
                exitTransition={exitTransition}
              >
                {body}
              </MotiView>
            ) : null}
          </AnimatePresence>
        );
      }}
    </OverlayShell>
  );
}
