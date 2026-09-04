import { useCallback, useEffect } from 'react';
import { AccessibilityInfo, Platform, TouchableOpacity, View } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import type { SurfaceElevation } from '../../../lib/elevated';
import { surface } from '../../../lib/surface';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { TIMING_BASE } from '../../../theme/motion';
import { Button } from '../../buttons/Button/button';
import { Text } from '../../typography/Text/text';
import { OverlayScrim } from '../Overlay/overlay-scrim';
import { OverlayShell, type OverlayShellContext } from '../Overlay/overlay-shell';
import type { OverlayType } from '../Overlay/overlay-type';
import { MORPH_CONTENT_TRANSITION, RM_TRANSITION } from './action-feedback-motion';
import { MorphIcon } from './morph-icon';

const SUCCESS_AUTO_CLOSE_MS = 2500;

// biome-ignore lint/style/useExportsLast: the state union heads the module — MORPH_SIZE above and the announcement helper below are both keyed on it
export type ActionFeedbackState = 'loading' | 'success' | 'error';

type StateContentProps = {
  state: ActionFeedbackState;
  reduced: boolean;
  loadingMessage?: string;
  successLabel?: string;
  successMessage?: string;
  errorTitle: string;
  errorMessage?: string;
  tagline?: string;
  dismissLabel: string;
  onDismiss: () => void;
  testID?: string;
};

/**
 * The text under the morph vessel, cross-faded as the state changes.
 *
 * Each block is a flex child of a `gap-4` column, so rendering one with no text
 * inside still costs a 16px gap under the icon — hence the emptiness checks.
 * `error` always has a title and a button, so it always renders.
 */
function StateContent(props: StateContentProps) {
  const { state, reduced, loadingMessage, successLabel, successMessage, errorTitle, errorMessage } = props;
  const { tagline, dismissLabel, onDismiss, testID } = props;
  const transition = reduced ? RM_TRANSITION : MORPH_CONTENT_TRANSITION;
  const hasLoadingContent = Boolean(loadingMessage || tagline);
  const hasSuccessContent = Boolean(successLabel || successMessage || tagline);
  const taglineText = tagline ? <Text className="text-center text-muted-foreground text-xs">{tagline}</Text> : null;

  return (
    <AnimatePresence exitBeforeEnter={true} initial={false}>
      {state === 'loading' && hasLoadingContent && (
        <MotiView
          key="loading-content"
          from={{ opacity: 0, translateY: 4 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: -4 }}
          transition={transition}
          className="w-full items-center gap-1.5"
        >
          {loadingMessage ? <Text className="text-center text-muted-foreground text-sm">{loadingMessage}</Text> : null}
          {taglineText}
        </MotiView>
      )}
      {state === 'success' && hasSuccessContent && (
        <MotiView
          key="success-content"
          from={{ opacity: 0, translateY: 4 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: -4 }}
          transition={transition}
          className="w-full items-center gap-1.5"
        >
          {successLabel ? (
            <Text weight="semibold" className="text-center text-base text-foreground">
              {successLabel}
            </Text>
          ) : null}
          {successMessage ? <Text className="text-center text-muted-foreground text-sm">{successMessage}</Text> : null}
          {taglineText}
        </MotiView>
      )}
      {state === 'error' && (
        <MotiView
          key="error-content"
          from={{ opacity: 0, translateY: 4 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: -4 }}
          transition={transition}
          className="w-full items-center gap-1.5"
        >
          <Text weight="semibold" className="text-center text-base text-foreground">
            {errorTitle}
          </Text>
          {errorMessage ? (
            <Text className="text-center text-muted-foreground text-sm leading-relaxed">{errorMessage}</Text>
          ) : null}
          {taglineText}
          <Button
            variant="neutral"
            size="sm"
            onPress={onDismiss}
            className="mt-2"
            testID={testID ? `${testID}-dismiss` : undefined}
          >
            {dismissLabel}
          </Button>
        </MotiView>
      )}
    </AnimatePresence>
  );
}

type AnnouncementParts = {
  state: ActionFeedbackState;
  loadingMessage?: string;
  successLabel?: string;
  successMessage?: string;
  errorTitle: string;
  errorMessage?: string;
};

/**
 * What the outcome sounds like: the same words that are on screen for the
 * active state, joined so it reads as one sentence rather than fragments.
 */
function announcementFor(parts: AnnouncementParts): string {
  const { state, loadingMessage, successLabel, successMessage, errorTitle, errorMessage } = parts;
  if (state === 'loading') return loadingMessage ?? '';
  if (state === 'success') return [successLabel, successMessage].filter(Boolean).join('. ');
  return [errorTitle, errorMessage].filter(Boolean).join('. ');
}

export type ActionFeedbackModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  state: ActionFeedbackState;
  loadingMessage?: string;
  successLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  errorTitle?: string;
  dismissLabel?: string;
  tagline?: string;
  /**
   * Swap the panel's ladder shadow for the input field's large, diffuse halo
   * (`shadow-floating`). It replaces the `shadow-elevated-N` rung rather than
   * adding to it, so the panel keeps its `elevation` tint but trades the
   * layered drop for the halo. @default false
   */
  floating?: boolean;
  /** Surface elevation (0–8) — drives the drop shadow + dark-mode rim. `0` is the flat resting surface (no shadow or border). Defaults to 6. */
  elevation?: SurfaceElevation;
  testID?: string;
  /** The scrim behind the panel: `"blur"`, `"opacity"`, or `"none"`. Defaults to `"blur"`. */
  overlay?: OverlayType;
  /** When false, pressing outside the panel will not close it. Defaults to true. */
  closeOnOutsidePress?: boolean;
  /**
   * Fires after the modal has fully presented (iOS `Modal.onShow`) — the moment
   * it is safe to request keyboard focus on content inside it. No-op on web.
   */
  onShow?: () => void;
};

export function ActionFeedbackModal({
  open: openProp,
  onOpenChange,
  state,
  loadingMessage,
  successLabel,
  successMessage,
  errorMessage,
  errorTitle = 'Error',
  dismissLabel = 'Dismiss',
  tagline,
  floating = false,
  elevation = 6,
  testID,
  overlay = 'blur',
  closeOnOutsidePress = true,
  onShow,
}: ActionFeedbackModalProps) {
  const isOpen = openProp ?? false;
  const isDismissible = state === 'error';
  const canDismiss = isDismissible && closeOnOutsidePress;
  const liveRegion = state === 'error' ? 'assertive' : 'polite';
  const reduced = useReducedMotion();

  const announcement = announcementFor({ state, loadingMessage, successLabel, successMessage, errorTitle, errorMessage });

  // iOS has no live-region equivalent — `accessibilityLiveRegion` is Android
  // only, and VoiceOver does not re-read a subtree that changed under it. So the
  // outcome is pushed explicitly there. On Android the live region below already
  // fires, and on web `announceForAccessibility` is a no-op in react-native-web,
  // so both would otherwise double-announce.
  // biome-ignore lint/plugin: a screen-reader announcement is an imperative side effect keyed on the resolved state — there is nothing to derive.
  useEffect(() => {
    if (Platform.OS !== 'ios' || !isOpen || state === 'loading' || !announcement) return;
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [isOpen, state, announcement]);

  const handleClose = useCallback(() => {
    onOpenChange?.(false);
  }, [onOpenChange]);

  // Auto-close after success.
  // biome-ignore lint/plugin: timer side-effect cannot be expressed as derived state — fires once when success lands, cleans up on unmount
  useEffect(() => {
    if (isOpen && state === 'success') {
      const timer = setTimeout(handleClose, SUCCESS_AUTO_CLOSE_MS);
      return () => clearTimeout(timer);
    }
  }, [isOpen, state, handleClose]);

  const handleBackdropPress = useCallback(() => {
    if (closeOnOutsidePress && isDismissible) handleClose();
  }, [closeOnOutsidePress, isDismissible, handleClose]);

  const renderContent = ({ open: isAnimOpen, onExitComplete }: OverlayShellContext) => (
    <AnimatePresence onExitComplete={onExitComplete}>
      {isAnimOpen ? (
        <MotiView
          key="action-feedback-backdrop"
          className="flex-1 items-center justify-center px-6"
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduced ? RM_TRANSITION : TIMING_BASE}
          exitTransition={{ type: 'timing', duration: reduced ? 100 : 180 }}
        >
          <OverlayScrim type={overlay} dimClassName="bg-black/50" />
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={handleBackdropPress} disabled={!canDismiss} />
          <MotiView
            from={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={reduced ? RM_TRANSITION : { type: 'spring', damping: 24, stiffness: 280, mass: 0.9 }}
            exitTransition={{ type: 'timing', duration: reduced ? 100 : 150 }}
            className={cn(
              'w-full max-w-sm',

              surface(elevation, 'modal', floating),
              'p-6',
            )}
            testID={testID}
          >
            {/* One persistent live region rather than per-state ones: aria-live
                only announces mutations *inside* a region that already existed,
                and each state block mounts fresh. This wrapper outlives the
                swaps, so loading → success/error is announced. Errors interrupt
                (`assertive`); progress and success wait their turn. */}
            <View className="w-full items-center gap-4 py-2" accessibilityLiveRegion={liveRegion} aria-live={liveRegion}>
              <MorphIcon state={state} reduced={reduced} />
              <StateContent
                dismissLabel={dismissLabel}
                errorMessage={errorMessage}
                errorTitle={errorTitle}
                loadingMessage={loadingMessage}
                onDismiss={handleClose}
                reduced={reduced}
                state={state}
                successLabel={successLabel}
                successMessage={successMessage}
                tagline={tagline}
                testID={testID}
              />
            </View>
          </MotiView>
        </MotiView>
      ) : null}
    </AnimatePresence>
  );

  return (
    <OverlayShell
      open={isOpen}
      onClose={handleClose}
      dismissable={isDismissible}
      // The dialog is named by whatever it is currently reporting, so focusing
      // it announces the outcome rather than an anonymous "dialog".
      accessibilityLabel={announcement || undefined}
      onShow={onShow}
    >
      {renderContent}
    </OverlayShell>
  );
}
