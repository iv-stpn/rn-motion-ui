import { useEffect, useRef, useState } from 'react';
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { EASE_IN_OUT } from '../../../lib/ease';

/** The outgoing rows' own exit: a short scale-out, staggered along the list. */
const ROW_EXIT_DURATION = 70;
const ROW_EXIT_STAGGER = 24;
/** The close opens with a beat, and it is a beat in time, not just a curve: the pane
 *  swells to its peak, **holds it** for {@link CLOSE_HOLD}, and only then starts
 *  down. The hold is what makes the swell read as a swell — without it the swell is
 *  over before the eye registers it and the close looks like the pane simply
 *  leaving. */
const CLOSE_SWELL = 70;
const CLOSE_HOLD = 50;
/** When the close actually starts moving: the swell and its hold are done, and the
 *  pane begins its descent while the content scales back down through it. Everything
 *  below is measured from here rather than from the click, so retiming the beat
 *  shifts the whole close instead of silently eating into the descent. */
const CLOSE_LEAD = CLOSE_SWELL + CLOSE_HOLD;
/** How long the descent runs, measured from {@link CLOSE_LEAD}. Settled against the
 *  shell's own morph spring, which is what actually carries the pane down: at 180
 *  the retention below expired while the pane was still a dozen pixels short and
 *  swapped in the closed control early enough to see. */
const COLLAPSE_DURATION = 200;
/** The last delay the stagger may hand out. The real constraint is the pane: a row
 *  that starts later than this would still be fading after the shell has landed and
 *  would be cut off by the swap. Deriving it means a list long enough to reach the
 *  cap degrades by tightening its cascade rather than by dropping its last rows.
 *  It also un-clumps a normal list — at a flat 96 the top rows of a six-item pane
 *  all shared one delay and left together, which read as one block, not a stagger. */
const ROW_EXIT_MAX_DELAY = COLLAPSE_DURATION - ROW_EXIT_DURATION;
/** How long before the descent has landed the press bottoms out. */
const CLOSE_DIP_LEAD = 45;
const PRESS_SPRING = { stiffness: 500, damping: 22, mass: 0.5 };
/** The close-end press. It bottoms out {@link CLOSE_DIP_LEAD} ms before the descent
 *  lands and springs back over the tail, so the shrink and the press stay one
 *  motion — retiming the descent without moving this is how the dip ends up
 *  happening to an already-settled pane. */
const CLOSE_DIP_SCALE = 0.965;
const CLOSE_DIP_DURATION = COLLAPSE_DURATION - CLOSE_DIP_LEAD;
const CLOSE_DIP_SPRING = { stiffness: 320, damping: 30, mass: 0.6 };
/** How long the outgoing rows stay mounted: long enough for the last staggered row
 *  to finish its exit, and long enough for the shell to have landed underneath
 *  them — the rows ride the collapsing pane out, and are only swapped for the
 *  closed control once it has settled, which keeps the swap from popping. */
const CLOSE_RETENTION = CLOSE_LEAD + Math.max(COLLAPSE_DURATION, ROW_EXIT_MAX_DELAY + ROW_EXIT_DURATION);
/** The content's own dissolve, for panes that thin their whole block out on the way
 *  down (see `MorphingDockSwitch`). It is delayed until {@link CLOSE_LEAD} so the
 *  swell and its hold play over untouched content, and it eases in rather than
 *  riding the shell's collapse spring — a spring runs fastest at the top, which put
 *  the block at half opacity while the shell was still swelling. */
const CONTENT_FADE = { type: 'timing' as const, duration: COLLAPSE_DURATION, delay: CLOSE_LEAD, easing: EASE_IN_OUT };

/** Keep the pane alive for its staggered exit, then compress the closed control.
 * Scale belongs to an outer host: it must never replace the shell's translateY. */
function useSwitcherMotion(open: boolean, reduce: boolean) {
  const [retained, setRetained] = useState(open);
  const previous = useRef(open);
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // biome-ignore lint/plugin: retain the outgoing pane for its animation; cancel the sequence and timer on reversal/unmount
  useEffect(() => {
    const changed = previous.current !== open;
    previous.current = open;
    cancelAnimation(scale);
    if (reduce || !changed) {
      setRetained(open);
      scale.value = 1;
      return;
    }
    if (open) {
      setRetained(true);
      scale.value = withSequence(withTiming(0.95, { duration: 70 }), withSpring(1, PRESS_SPRING));
      return () => cancelAnimation(scale);
    }
    scale.value = withSequence(
      // Scale up first, and finish doing it: the peak is reached and held for
      // CLOSE_HOLD before anything else moves.
      withTiming(1.02, { duration: CLOSE_SWELL }),
      withDelay(
        CLOSE_HOLD,
        // Then the second leg targets the dip, not 1: the shell leaves the peak
        // already scaling down, so the release and the press are one motion. Its
        // duration is what places the bottom of the press `CLOSE_DIP_LEAD` before
        // the descent lands, with the spring back running over the last stretch of
        // the collapse instead of after it.
        withTiming(CLOSE_DIP_SCALE, { duration: CLOSE_DIP_DURATION }),
      ),
      withSpring(1, CLOSE_DIP_SPRING),
    );
    const timer = setTimeout(() => setRetained(false), CLOSE_RETENTION);
    return () => {
      clearTimeout(timer);
      cancelAnimation(scale);
    };
  }, [open, reduce, scale]);

  const expanded = open || (!reduce && retained);
  return { expanded, closing: !open && expanded, scaleStyle };
}

export { CLOSE_LEAD, CONTENT_FADE, ROW_EXIT_DURATION, ROW_EXIT_MAX_DELAY, ROW_EXIT_STAGGER, useSwitcherMotion };
