import { AnimatePresence } from '@rn-motion-ui/moti/presence';
import { MotiView } from '@rn-motion-ui/moti/view';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Easing } from 'react-native-reanimated';
import { useModalRender } from '../../hooks/use-modal-render';
import { ChevronRight, X } from '../../lib/icons';

const BACK_BUTTON_HEADER_HEIGHT = 56;
const SMALL_SCREEN_BREAKPOINT = 640;

export type FullSheetMode = 'default' | 'back-button';

export type FullSheetProps = {
  visible: boolean;
  onClose: () => void;
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
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: two layout modes (default/back-button) plus accessibility query — splitting would scatter tightly-coupled state
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: same reason — back-button and default branches share transition/reduced-motion state
export function FullSheet({
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
}: FullSheetProps) {
  const { height, width } = useWindowDimensions();
  const isSmallScreen = width < SMALL_SCREEN_BREAKPOINT;
  const { rendered, onExitComplete } = useModalRender(visible);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // biome-ignore lint/plugin: one-time reduced-motion query + subscription — cannot be derived from render state
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (active) setPrefersReducedMotion(v);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setPrefersReducedMotion);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const handleExitComplete = useCallback(() => {
    onExitComplete();
    onAfterClose?.();
  }, [onExitComplete, onAfterClose]);

  const enterTransition = {
    type: 'timing' as const,
    duration: prefersReducedMotion ? 160 : 340,
    easing: prefersReducedMotion ? Easing.linear : Easing.out(Easing.cubic),
  };
  const exitTransition = {
    type: 'timing' as const,
    duration: prefersReducedMotion ? 160 : 300,
    easing: prefersReducedMotion ? Easing.linear : Easing.in(Easing.cubic),
  };

  const px = compact ? 'px-5' : 'px-6';
  const pt = compact ? 'pt-6' : 'pt-8';
  const pb = compact ? 'pb-5' : 'pb-6';

  if (!rendered) return null;

  // ── Body layout selection ──────────────────────────────────────────────────
  let body: ReactNode;

  if (mode === 'back-button') {
    const headerH = isSmallScreen && title ? BACK_BUTTON_HEADER_HEIGHT : 0;

    let backOverlay: ReactNode = null;
    if (isSmallScreen && title)
      backOverlay = (
        <View
          className="absolute top-0 right-0 left-0 z-10 flex-row items-center bg-surface"
          style={{ height: BACK_BUTTON_HEADER_HEIGHT }}
        >
          {dismissable ? (
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Back" className="ml-2 p-2">
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <ChevronRight size={20} />
              </View>
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
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Back" className="p-2">
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <ChevronRight size={20} />
            </View>
          </Pressable>
        </View>
      );

    body = (
      <>
        <View className="flex-1" style={{ paddingTop: headerH }}>
          {children}
        </View>
        {backOverlay}
      </>
    );
  } else if (customLayout) body = children;
  else {
    const hasHeader = Boolean(title || subtitle || showClose);
    const header = hasHeader ? (
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
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <X size={20} />
            </Pressable>
          ) : null}
        </View>
      </View>
    ) : null;

    body = (
      <View className={`flex-1 ${px} ${pt}`}>
        {header}
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

  return (
    <Modal
      visible={rendered}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={dismissable ? onClose : undefined}
      accessibilityViewIsModal={true}
      aria-modal={true}
    >
      <AnimatePresence onExitComplete={handleExitComplete}>
        {visible ? (
          <MotiView
            key="fullsheet"
            className="flex-1 bg-surface"
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
    </Modal>
  );
}
