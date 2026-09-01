import { type ReactNode, useCallback } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Easing } from 'react-native-reanimated';
import { RightLine as ChevronRight } from 'rn-motion-ui-icons/icons/right-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { useSafeInsets } from '../../../hooks/use-safe-insets';
import { type BreakpointValue, isWidthAtLeast } from '../../../lib/breakpoints';
import { cn } from '../../../lib/cn';
import type { SurfaceElevation } from '../../../lib/elevated';
import { CARD_RADIUS } from '../../../lib/radius';
import { surface } from '../../../lib/surface';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { CloseButton } from '../../buttons/CloseButton/close-button';
import { Text } from '../../typography/Text/text';
import { OverlayShell } from '../Overlay/overlay-shell';

const BACK_BUTTON_HEADER_HEIGHT = 56;
/** Narrow vs. wide layout cutoff — matches AdaptiveModal's default. */
const DEFAULT_WIDE_BREAKPOINT: BreakpointValue = 'sm';

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

function buildBackButtonBody(args: BuildBodyArgs): ReactNode {
  const { isSmallScreen, title, dismissable, handleClose, children, backIcon } = args;
  const headerHeight = isSmallScreen && title ? BACK_BUTTON_HEADER_HEIGHT : 0;
  let backOverlay: ReactNode = null;
  if (isSmallScreen && title)
    backOverlay = (
      <View
        className="absolute top-0 right-0 left-0 z-10 flex-row items-center bg-surface-3"
        style={{ height: BACK_BUTTON_HEADER_HEIGHT }}
      >
        {dismissable ? (
          <Pressable onPress={handleClose} hitSlop={8} accessibilityLabel="Back" className="ml-2 p-2">
            <View className="rotate-180">{backIcon ?? <ChevronRight size={20} />}</View>
          </Pressable>
        ) : (
          <View className="ml-2 h-10 w-10" />
        )}
        <Text weight="semibold" className="flex-1 pr-4 pl-2 text-foreground text-xl" numberOfLines={1}>
          {title}
        </Text>
      </View>
    );
  else if (dismissable)
    backOverlay = (
      <View className="absolute top-3 left-4">
        <Pressable onPress={handleClose} hitSlop={8} accessibilityLabel="Back" className="p-2">
          <View className="rotate-180">{backIcon ?? <ChevronRight size={20} />}</View>
        </Pressable>
      </View>
    );
  return (
    <>
      <View className="flex-1" style={{ paddingTop: headerHeight }}>
        {children}
      </View>
      {backOverlay}
    </>
  );
}

function resolveDefaultHeader(args: BuildBodyArgs): ReactNode {
  const { headerSlot, title, subtitle, showClose, compact, dismissable, handleClose, closeIcon } = args;
  if (headerSlot !== undefined) return typeof headerSlot === 'function' ? headerSlot({ close: handleClose }) : headerSlot;

  const hasHeader = Boolean(title || subtitle || showClose);
  if (!hasHeader) return null;

  return (
    <View className={compact ? 'mb-3' : 'mb-4'}>
      <View className="flex-row items-start justify-between gap-4">
        {title || subtitle ? (
          <View className="min-w-0 flex-1 gap-2">
            {title ? (
              <Text weight="semibold" className="mr-4 pt-1 text-foreground text-xl">
                {title}
              </Text>
            ) : null}
            {subtitle ? <Text className="text-base text-muted-foreground leading-relaxed">{subtitle}</Text> : null}
          </View>
        ) : (
          <View className="flex-1" />
        )}
        {showClose && dismissable ? (closeIcon ?? <CloseButton onPress={handleClose} />) : null}
      </View>
    </View>
  );
}

function buildDefaultBody(args: BuildBodyArgs): ReactNode {
  const { customLayout, children, scrollable, px, pt, pb } = args;
  if (customLayout) return children;

  const resolvedHeader = resolveDefaultHeader(args);
  return (
    <View className={cn('flex-1', px, pt)}>
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
        <View className={cn('w-full flex-1', pb)}>{children}</View>
      )}
    </View>
  );
}

function buildBody(args: BuildBodyArgs): ReactNode {
  return args.mode === 'back-button' ? buildBackButtonBody(args) : buildDefaultBody(args);
}

export type FullSheetMode = 'default' | 'back-button';

/** Context passed to the `header` render-prop. */
export type FullSheetHeaderCtx = { close: () => void };

export type FullSheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
   * Swap the sheet's ladder shadow for the input field's large, diffuse halo
   * (`shadow-floating`). It replaces the `shadow-elevated-N` rung rather than
   * adding to it, so the sheet keeps its `elevation` tint but trades the
   * layered drop for the halo. @default false
   */
  floating?: boolean;
  /**
   * Surface elevation of the sheet (0–8) — drives the background tint and the
   * `shadow-elevated-N` recipe (drop shadow + dark-mode rim). `0` is the flat
   * resting surface (no shadow or border). Defaults to `6`.
   */
  elevation?: SurfaceElevation;
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
  /** Replace the entire close button. Default: `<CloseButton onPress={…} />`. */
  closeIcon?: ReactNode;
  /** Replace the back-button chevron icon. Default: rotated `<ChevronRight size={20} />`. */
  backIcon?: ReactNode;
  /**
   * Width at or above which the sheet uses its wide layout. A breakpoint name
   * from the shared scale or a raw pixel number. @default 'sm' (640)
   */
  wideBreakpoint?: BreakpointValue;
  /**
   * Wrap content in device safe-area insets (status bar top, home indicator
   * bottom). Requires `react-native-safe-area-context` and `<SafeAreaProvider>`
   * in the tree. Set to `false` to manage insets yourself. @default true
   */
  safeArea?: boolean;
  testID?: string;
};

export function FullSheet({
  open,
  onOpenChange,
  children,
  title,
  subtitle,
  showClose,
  scrollable = true,
  compact = false,
  customLayout = false,
  floating = false,
  elevation = 6,
  mode = 'default',
  dismissable = true,
  onAfterClose,
  header: headerSlot,
  closeIcon,
  backIcon,
  wideBreakpoint = DEFAULT_WIDE_BREAKPOINT,
  safeArea = true,
  testID,
}: FullSheetProps) {
  const isOpen = open ?? false;
  const { height, width } = useWindowDimensions();
  const isSmallScreen = !isWidthAtLeast(width, wideBreakpoint);
  const reduced = useReducedMotion();
  const insets = useSafeInsets();

  const handleClose = useCallback(() => {
    onOpenChange?.(false);
  }, [onOpenChange]);

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
                className={cn('flex-1', surface(elevation, undefined, floating))}
                from={{ translateY: height, borderRadius: CARD_RADIUS }}
                animate={{ translateY: 0, borderRadius: 0 }}
                exit={{ translateY: height, borderRadius: CARD_RADIUS }}
                transition={enterTransition}
                exitTransition={exitTransition}
                testID={testID}
                style={safeArea ? { paddingTop: insets.top, paddingBottom: insets.bottom } : undefined}
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
