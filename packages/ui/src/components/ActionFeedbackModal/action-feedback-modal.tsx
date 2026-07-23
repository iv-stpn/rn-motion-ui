import { useCallback, useEffect } from 'react';
import { TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { EASE_OUT } from '../../lib/ease';
import { elevatedShadow, type SurfaceLevel, surfaceBackground } from '../../lib/elevated';
import { Check, X } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { TIMING_BASE } from '../../theme/motion';
import { useThemeColors } from '../../theme/use-theme-color';
import { Button } from '../Button/button';
import { Loader } from '../Loader/loader';
import { OverlayShell, type OverlayShellContext } from '../Overlay/overlay-shell';
import { Text } from '../Text/text';

// --- Morph icon --------------------------------------------------------------
// A single circular vessel that morphs its size + fill colour as `state`
// changes, while the glyph inside cross-fades (spinner ↔ check ↔ close). The
// icon persists across state transitions so the morph reads as one continuous
// shape-change rather than three static icons swapping in/out. Ported from
// offkeep's web ActionFeedbackModal MorphIcon (framer-motion → moti).

const MORPH_SIZE: Record<ActionFeedbackState, number> = { loading: 40, success: 44, error: 38 };

const MORPH_CONTAINER_TRANSITION = { type: 'timing', duration: 300, easing: EASE_OUT } as const;
const MORPH_GLYPH_TRANSITION = { type: 'timing', duration: 240, easing: EASE_OUT } as const;
const MORPH_SPINNER_TRANSITION = { type: 'timing', duration: 180, easing: EASE_OUT } as const;
const MORPH_CONTENT_TRANSITION = { type: 'timing', duration: 180, easing: EASE_OUT } as const;
/** Fallback for every morph transition under reduced-motion — short and linear. */
const RM_TRANSITION = { type: 'timing', duration: 160 } as const;

const morphGlyphStyle: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  alignItems: 'center',
  justifyContent: 'center',
};

type MorphIconProps = { state: ActionFeedbackState; reduced: boolean };

function MorphIcon({ state, reduced }: MorphIconProps) {
  const colors = useThemeColors();
  const morphBackground: Record<ActionFeedbackState, string> = {
    loading: 'transparent',
    success: colors.success,
    error: colors.danger,
  };
  const size = MORPH_SIZE[state];
  const backgroundColor = morphBackground[state];

  return (
    <MotiView
      animate={{ width: size, height: size, backgroundColor }}
      transition={reduced ? RM_TRANSITION : MORPH_CONTAINER_TRANSITION}
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
            transition={reduced ? RM_TRANSITION : MORPH_SPINNER_TRANSITION}
            style={morphGlyphStyle}
          >
            <Loader variant="dots" size={28} color={colors['muted-foreground']} />
          </MotiView>
        )}
        {state === 'success' && (
          <MotiView
            key="check"
            from={{ opacity: 0, scale: 0.3, rotate: '-25deg' }}
            animate={{ opacity: 1, scale: 1, rotate: '0deg' }}
            exit={{ opacity: 0, scale: 0.3, rotate: '25deg' }}
            transition={reduced ? RM_TRANSITION : MORPH_GLYPH_TRANSITION}
            style={morphGlyphStyle}
          >
            <Check size={26} color={colors['success-foreground']} />
          </MotiView>
        )}
        {state === 'error' && (
          <MotiView
            key="close"
            from={{ opacity: 0, scale: 0.3, rotate: '25deg' }}
            animate={{ opacity: 1, scale: 1, rotate: '0deg' }}
            exit={{ opacity: 0, scale: 0.3, rotate: '-25deg' }}
            transition={reduced ? RM_TRANSITION : MORPH_GLYPH_TRANSITION}
            style={morphGlyphStyle}
          >
            <X size={20} color={colors['danger-foreground']} />
          </MotiView>
        )}
      </AnimatePresence>
    </MotiView>
  );
}

const SUCCESS_AUTO_CLOSE_MS = 2500;

export type ActionFeedbackState = 'loading' | 'success' | 'error';

export type ActionFeedbackModalProps = {
  // New preferred API
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** @deprecated Use `open` instead. */
  visible?: boolean;
  /** @deprecated Use `onOpenChange` instead. */
  onClose?: () => void;
  state: ActionFeedbackState;
  loadingMessage?: string;
  successLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  errorTitle?: string;
  dismissLabel?: string;
  tagline?: string;
  /** Surface elevation (1–8) — drives the drop shadow + dark-mode rim. Defaults to 6. */
  elevation?: SurfaceLevel;
};

export function ActionFeedbackModal({
  open: openProp,
  onOpenChange,
  visible,
  onClose,
  state,
  loadingMessage,
  successLabel,
  successMessage,
  errorMessage,
  errorTitle = 'Error',
  dismissLabel = 'Dismiss',
  tagline,
  elevation = 6,
}: ActionFeedbackModalProps) {
  const isOpen = openProp ?? visible ?? false;
  const isDismissible = state === 'error';
  const reduced = useReducedMotion();

  const handleClose = useCallback(() => {
    onClose?.();
    onOpenChange?.(false);
  }, [onClose, onOpenChange]);

  // Auto-close after success — mirrors offkeep's useTimeout behaviour.
  // biome-ignore lint/plugin: timer side-effect cannot be expressed as derived state — fires once when success lands, cleans up on unmount
  useEffect(() => {
    if (isOpen && state === 'success') {
      const timer = setTimeout(handleClose, SUCCESS_AUTO_CLOSE_MS);
      return () => clearTimeout(timer);
    }
  }, [isOpen, state, handleClose]);

  const handleBackdropPress = useCallback(() => {
    if (isDismissible) handleClose();
  }, [isDismissible, handleClose]);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: three state branches (loading/success/error) share one backdrop + morph vessel — splitting would scatter tightly-coupled animation state
  const renderContent = ({ open: isAnimOpen, onExitComplete }: OverlayShellContext) => (
    <AnimatePresence onExitComplete={onExitComplete}>
      {isAnimOpen ? (
        <MotiView
          key="action-feedback-backdrop"
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' /* scrim — theme-independent */ }}
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduced ? RM_TRANSITION : TIMING_BASE}
          exitTransition={{ type: 'timing', duration: reduced ? 100 : 180 }}
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
            transition={reduced ? RM_TRANSITION : { type: 'spring', damping: 24, stiffness: 280, mass: 0.9 }}
            exitTransition={{ type: 'timing', duration: reduced ? 100 : 150 }}
            className={`w-full max-w-sm rounded-2xl border border-border ${surfaceBackground(elevation)} p-6 ${elevatedShadow(elevation)}`}
          >
            <View className="w-full items-center gap-4 py-2">
              <MorphIcon state={state} reduced={reduced} />
              <AnimatePresence exitBeforeEnter={true} initial={false}>
                {state === 'loading' && (
                  <MotiView
                    key="loading-content"
                    from={{ opacity: 0, translateY: 4 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    exit={{ opacity: 0, translateY: -4 }}
                    transition={reduced ? RM_TRANSITION : MORPH_CONTENT_TRANSITION}
                    className="w-full items-center gap-1.5"
                  >
                    {loadingMessage ? <Text className="text-center text-muted-foreground text-sm">{loadingMessage}</Text> : null}
                    {tagline ? <Text className="text-center text-muted-foreground text-xs">{tagline}</Text> : null}
                  </MotiView>
                )}
                {state === 'success' && (
                  <MotiView
                    key="success-content"
                    from={{ opacity: 0, translateY: 4 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    exit={{ opacity: 0, translateY: -4 }}
                    transition={reduced ? RM_TRANSITION : MORPH_CONTENT_TRANSITION}
                    className="w-full items-center gap-1.5"
                  >
                    {successLabel ? (
                      <Text className="text-center font-semibold text-base text-foreground">{successLabel}</Text>
                    ) : null}
                    {successMessage ? <Text className="text-center text-muted-foreground text-sm">{successMessage}</Text> : null}
                    {tagline ? <Text className="text-center text-muted-foreground text-xs">{tagline}</Text> : null}
                  </MotiView>
                )}
                {state === 'error' && (
                  <MotiView
                    key="error-content"
                    from={{ opacity: 0, translateY: 4 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    exit={{ opacity: 0, translateY: -4 }}
                    transition={reduced ? RM_TRANSITION : MORPH_CONTENT_TRANSITION}
                    className="w-full items-center gap-1.5"
                  >
                    <Text className="text-center font-semibold text-base text-foreground">{errorTitle}</Text>
                    {errorMessage ? (
                      <Text className="text-center text-muted-foreground text-sm leading-relaxed">{errorMessage}</Text>
                    ) : null}
                    {tagline ? <Text className="text-center text-muted-foreground text-xs">{tagline}</Text> : null}
                    <Button variant="secondary" size="sm" onPress={handleClose} style={{ marginTop: 8 }}>
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
  );

  return (
    <OverlayShell open={isOpen} onClose={handleClose} dismissable={isDismissible}>
      {renderContent}
    </OverlayShell>
  );
}
