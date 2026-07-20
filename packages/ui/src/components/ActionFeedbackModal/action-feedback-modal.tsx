import { useCallback, useEffect, useMemo } from 'react';
import { Modal, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useModalRender } from '../../hooks/use-modal-render';
import { EASE_OUT } from '../../lib/ease';
import { Check, X } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { Button } from '../Button/button';
import { Loader } from '../Loader/loader';

// Hardcoded semantic colour tokens — kept close to standard green/red so the
// modal looks correct on any host app without requiring a theme context.
const COLORS = {
  success: '#16a34a',
  destructive: '#dc2626',
  muted: '#6b7280',
  white: '#ffffff',
} as const;

// --- Morph icon --------------------------------------------------------------
// A single circular vessel that morphs its size + fill colour as `state`
// changes, while the glyph inside cross-fades (spinner ↔ check ↔ close). The
// icon persists across state transitions so the morph reads as one continuous
// shape-change rather than three static icons swapping in/out. Ported from
// offkeep's web ActionFeedbackModal MorphIcon (framer-motion → moti).

const MORPH_SIZE: Record<ActionFeedbackState, number> = { loading: 40, success: 44, error: 38 };
const MORPH_BG: Record<ActionFeedbackState, string> = {
  loading: 'transparent',
  success: COLORS.success,
  error: COLORS.destructive,
};

const MORPH_CONTAINER_TRANSITION = { type: 'timing', duration: 300, easing: EASE_OUT } as const;
const MORPH_GLYPH_TRANSITION = { type: 'timing', duration: 240, easing: EASE_OUT } as const;
const MORPH_SPINNER_TRANSITION = { type: 'timing', duration: 180, easing: EASE_OUT } as const;
const MORPH_CONTENT_TRANSITION = { type: 'timing', duration: 180, easing: EASE_OUT } as const;

const morphGlyphStyle: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  alignItems: 'center',
  justifyContent: 'center',
};

type MorphIconProps = { state: ActionFeedbackState };

function MorphIcon({ state }: MorphIconProps) {
  const size = MORPH_SIZE[state];
  const backgroundColor = MORPH_BG[state];

  return (
    <MotiView
      animate={{ width: size, height: size, backgroundColor }}
      transition={MORPH_CONTAINER_TRANSITION}
      // Static size mirrors the animate target so the vessel paints at the
      // correct dimensions on the first frame; the animated style still wins
      // every subsequent frame (motify merges as [static, animated]).
      style={{ width: size, height: size }}
      className="items-center justify-center rounded-full"
    >
      <AnimatePresence initial={false}>
        {state === 'loading' && (
          <MotiView
            key="spinner"
            from={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={MORPH_SPINNER_TRANSITION}
            style={morphGlyphStyle}
          >
            <Loader size={28} color={COLORS.muted} />
          </MotiView>
        )}
        {state === 'success' && (
          <MotiView
            key="check"
            from={{ opacity: 0, scale: 0.3, rotate: '-25deg' }}
            animate={{ opacity: 1, scale: 1, rotate: '0deg' }}
            exit={{ opacity: 0, scale: 0.3, rotate: '25deg' }}
            transition={MORPH_GLYPH_TRANSITION}
            style={morphGlyphStyle}
          >
            <Check size={26} color={COLORS.white} />
          </MotiView>
        )}
        {state === 'error' && (
          <MotiView
            key="close"
            from={{ opacity: 0, scale: 0.3, rotate: '25deg' }}
            animate={{ opacity: 1, scale: 1, rotate: '0deg' }}
            exit={{ opacity: 0, scale: 0.3, rotate: '-25deg' }}
            transition={MORPH_GLYPH_TRANSITION}
            style={morphGlyphStyle}
          >
            <X size={20} color={COLORS.white} />
          </MotiView>
        )}
      </AnimatePresence>
    </MotiView>
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
              <View className="w-full items-center gap-4 py-2">
                <MorphIcon state={state} />
                <AnimatePresence exitBeforeEnter={true} initial={false}>
                  {state === 'loading' && (
                    <MotiView
                      key="loading-content"
                      from={{ opacity: 0, translateY: 4 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      exit={{ opacity: 0, translateY: -4 }}
                      transition={MORPH_CONTENT_TRANSITION}
                      className="w-full items-center gap-1.5"
                    >
                      {loadingMessage ? (
                        <Text className="text-center text-muted-foreground text-sm">{loadingMessage}</Text>
                      ) : null}
                      {tagline ? <Text className="text-center text-muted-foreground text-xs">{tagline}</Text> : null}
                    </MotiView>
                  )}
                  {state === 'success' && (
                    <MotiView
                      key="success-content"
                      from={{ opacity: 0, translateY: 4 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      exit={{ opacity: 0, translateY: -4 }}
                      transition={MORPH_CONTENT_TRANSITION}
                      className="w-full items-center gap-1.5"
                    >
                      {successLabel ? (
                        <Text className="text-center font-semibold text-base text-foreground">{successLabel}</Text>
                      ) : null}
                      {successMessage ? (
                        <Text className="text-center text-muted-foreground text-sm">{successMessage}</Text>
                      ) : null}
                      {tagline ? <Text className="text-center text-muted-foreground text-xs">{tagline}</Text> : null}
                    </MotiView>
                  )}
                  {state === 'error' && (
                    <MotiView
                      key="error-content"
                      from={{ opacity: 0, translateY: 4 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      exit={{ opacity: 0, translateY: -4 }}
                      transition={MORPH_CONTENT_TRANSITION}
                      className="w-full items-center gap-1.5"
                    >
                      <Text className="text-center font-semibold text-base text-foreground">{errorTitle}</Text>
                      {errorMessage ? (
                        <Text className="text-center text-muted-foreground text-sm leading-relaxed">{errorMessage}</Text>
                      ) : null}
                      {tagline ? <Text className="text-center text-muted-foreground text-xs">{tagline}</Text> : null}
                      <Button variant="secondary" size="sm" onPress={onClose} style={{ marginTop: 8 }}>
                        {dismissLabel}
                      </Button>
                    </MotiView>
                  )}
                </AnimatePresence>
              </View>
            </MotiView>
          </MotiView>
        ) : null}
      </AnimatePresence>
    </Modal>
  );
}
