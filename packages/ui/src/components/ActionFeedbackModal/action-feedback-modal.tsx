import { useModalRender } from '@rn-motion-ui/hooks/use-modal-render';
import { AnimatePresence } from '@rn-motion-ui/moti/presence';
import { MotiView } from '@rn-motion-ui/moti/view';
import { useCallback, useEffect, useMemo } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Check, X } from '../../lib/icons';
import { Button } from '../Button/button';
import { Loader } from '../Loader/loader';

// Hardcoded semantic colour tokens — kept close to standard green/red so the
// modal looks correct on any host app without requiring a theme context.
const COLORS = {
  success: '#16a34a',
  successTint: 'rgba(34, 197, 94, 0.15)',
  destructive: '#dc2626',
  destructiveTint: 'rgba(239, 68, 68, 0.15)',
  muted: '#6b7280',
} as const;

function LoadingContent({ loadingMessage, tagline }: { loadingMessage?: string; tagline?: string }) {
  return (
    <View className="items-center gap-4 py-2">
      <Loader size={32} />
      <View className="items-center gap-1.5">
        {loadingMessage ? <Text className="text-center text-muted-foreground text-sm">{loadingMessage}</Text> : null}
        {tagline ? <Text className="text-center text-muted-foreground text-xs">{tagline}</Text> : null}
      </View>
    </View>
  );
}

function SuccessContent({
  successLabel,
  successMessage,
  tagline,
}: {
  successLabel?: string;
  successMessage?: string;
  tagline?: string;
}) {
  return (
    <View className="items-center gap-4 py-2">
      <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: COLORS.successTint }}>
        <Check size={28} color={COLORS.success} />
      </View>
      <View className="items-center gap-1.5">
        {successLabel ? <Text className="text-center font-semibold text-base text-foreground">{successLabel}</Text> : null}
        {successMessage ? <Text className="text-center text-muted-foreground text-sm">{successMessage}</Text> : null}
        {tagline ? <Text className="text-center text-muted-foreground text-xs">{tagline}</Text> : null}
      </View>
    </View>
  );
}

function ErrorContent({
  errorTitle,
  errorMessage,
  dismissLabel,
  tagline,
  onClose,
}: {
  errorTitle: string;
  errorMessage?: string;
  dismissLabel: string;
  tagline?: string;
  onClose: () => void;
}) {
  return (
    <View className="gap-4">
      <View className="flex-row items-start justify-between gap-3">
        <View
          className="h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: COLORS.destructiveTint }}
        >
          <X size={20} color={COLORS.destructive} />
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <X size={20} color={COLORS.muted} />
        </TouchableOpacity>
      </View>
      <View className="gap-1.5">
        <Text className="font-semibold text-base text-foreground">{errorTitle}</Text>
        {errorMessage ? <Text className="text-muted-foreground text-sm leading-relaxed">{errorMessage}</Text> : null}
        {tagline ? <Text className="text-muted-foreground text-xs">{tagline}</Text> : null}
      </View>
      <Button variant="secondary" size="sm" onPress={onClose}>
        {dismissLabel}
      </Button>
    </View>
  );
}

const SUCCESS_AUTO_CLOSE_MS = 2500;

export type ActionFeedbackState = 'loading' | 'success' | 'error';

export type ActionFeedbackModalProps = {
  visible: boolean;
  state: ActionFeedbackState;
  loadingMessage?: string;
  successLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  errorTitle?: string;
  dismissLabel?: string;
  tagline?: string;
  onClose: () => void;
};

export function ActionFeedbackModal({
  visible,
  state,
  loadingMessage,
  successLabel,
  successMessage,
  errorMessage,
  errorTitle = 'Error',
  dismissLabel = 'Dismiss',
  tagline,
  onClose,
}: ActionFeedbackModalProps) {
  const { rendered, onExitComplete } = useModalRender(visible);
  const isDismissible = state === 'error';

  // Auto-close after success — mirrors offkeep's useTimeout behaviour.
  // biome-ignore lint/plugin: timer side-effect cannot be expressed as derived state — fires once when success lands, cleans up on unmount
  useEffect(() => {
    if (visible && state === 'success') {
      const timer = setTimeout(onClose, SUCCESS_AUTO_CLOSE_MS);
      return () => clearTimeout(timer);
    }
  }, [visible, state, onClose]);

  const onRequestClose = useMemo(() => (state === 'error' ? onClose : undefined), [state, onClose]);
  const handleBackdropPress = useCallback(() => {
    if (isDismissible) onClose();
  }, [isDismissible, onClose]);

  if (!rendered) return null;

  return (
    <Modal visible={rendered} transparent={true} animationType="none" statusBarTranslucent={true} onRequestClose={onRequestClose}>
      <AnimatePresence onExitComplete={onExitComplete}>
        {visible ? (
          <MotiView
            key="action-feedback-backdrop"
            className="flex-1 items-center justify-center px-6"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'timing', duration: 200 }}
            exitTransition={{ type: 'timing', duration: 180 }}
          >
            <TouchableOpacity
              className="absolute inset-0"
              activeOpacity={1}
              onPress={handleBackdropPress}
              disabled={!isDismissible}
            />
            <MotiView
              from={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280, mass: 0.9 }}
              exitTransition={{ type: 'timing', duration: 150 }}
              className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-modal"
            >
              {state === 'loading' && <LoadingContent loadingMessage={loadingMessage} tagline={tagline} />}
              {state === 'success' && (
                <SuccessContent successLabel={successLabel} successMessage={successMessage} tagline={tagline} />
              )}
              {state === 'error' && (
                <ErrorContent
                  errorTitle={errorTitle}
                  errorMessage={errorMessage}
                  dismissLabel={dismissLabel}
                  tagline={tagline}
                  onClose={onClose}
                />
              )}
            </MotiView>
          </MotiView>
        ) : null}
      </AnimatePresence>
    </Modal>
  );
}
