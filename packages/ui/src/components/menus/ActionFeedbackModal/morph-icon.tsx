import { LinearTransition } from 'react-native-reanimated';
import { CheckLine as Check } from 'rn-motion-ui-icons/icons/check-line';
import { InformationLine as AlertCircle } from 'rn-motion-ui-icons/icons/information-line';
import { EASE_OUT } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { useThemeColors } from '../../../theme/use-theme-color';
import { Loader } from '../../display/Loader/loader';
import { ThemedIcon } from '../../icon/themed-icon';
import type { ActionFeedbackState } from './action-feedback-modal';
import {
  MORPH_CONTAINER_TRANSITION,
  MORPH_GLYPH_TRANSITION,
  MORPH_SPINNER_TRANSITION,
  RM_TRANSITION,
} from './action-feedback-motion';

// A single circular vessel that morphs its size + fill colour as `state`
// changes, while the glyph inside cross-fades (spinner ↔ check ↔ close). The
// icon persists across state transitions so the morph reads as one continuous
// shape-change rather than three static icons swapping in/out. Ported from a
// web MorphIcon (framer-motion → moti).
//
// Purely decorative: the outcome is carried by the text beside it, which sits
// in a live region, so the vessel and its glyphs stay out of the a11y tree
// rather than announcing "image" between the announcements that matter.

const MORPH_SIZE: Record<ActionFeedbackState, number> = { loading: 40, success: 44, error: 44 };
/** Vessel resize rides a Fabric-safe layout transition instead of animating
 *  `width`/`height` through `useAnimatedStyle` (layout props don't round-trip
 *  Yoga on Fabric). Timing mirrors `MORPH_CONTAINER_TRANSITION`. */
const MORPH_LAYOUT = LinearTransition.duration(300).easing(EASE_OUT);

export type MorphIconProps = { state: ActionFeedbackState; reduced: boolean };

export function MorphIcon({ state, reduced }: MorphIconProps) {
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
      animate={{ backgroundColor }}
      transition={reduced ? RM_TRANSITION : MORPH_CONTAINER_TRANSITION}
      layout={reduced ? undefined : MORPH_LAYOUT}
      // Static size paints the correct dimensions on the first frame and is the
      // target the layout transition springs toward; `backgroundColor` still
      // morphs through Moti (a style prop, safe on Fabric).
      style={{ width: size, height: size }}
      className="items-center justify-center rounded-full"
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
      aria-hidden={true}
    >
      <AnimatePresence initial={false}>
        {state === 'loading' && (
          <MotiView
            key="spinner"
            from={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={reduced ? RM_TRANSITION : MORPH_SPINNER_TRANSITION}
            className="absolute inset-0 items-center justify-center"
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
            className="absolute inset-0 items-center justify-center"
          >
            <ThemedIcon icon={Check} token="success-foreground" size={26} />
          </MotiView>
        )}
        {state === 'error' && (
          <MotiView
            key="close"
            from={{ opacity: 0, scale: 0.3, rotate: '25deg' }}
            animate={{ opacity: 1, scale: 1, rotate: '0deg' }}
            exit={{ opacity: 0, scale: 0.3, rotate: '-25deg' }}
            transition={reduced ? RM_TRANSITION : MORPH_GLYPH_TRANSITION}
            className="absolute inset-0 items-center justify-center"
          >
            <ThemedIcon icon={AlertCircle} token="danger-foreground" size={26} />
          </MotiView>
        )}
      </AnimatePresence>
    </MotiView>
  );
}
