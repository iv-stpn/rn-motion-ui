import type { ReactNode } from 'react';
import { EASE_OUT } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { TIMING_INSTANT } from '../../../theme/motion';
import { CLOSE_LEAD, ROW_EXIT_DURATION, ROW_EXIT_MAX_DELAY, ROW_EXIT_STAGGER } from './use-switcher-motion';

type SwitcherMotionRowProps = {
  children: ReactNode;
  index: number;
  count: number;
  closing: boolean;
  openAbove: boolean;
  /**
   * Which end of the list peels away first — the end the pane's shrinking edge
   * reaches first. Defaults to the top when the pane opens upward, where the
   * descending edge sweeps over a list packed against the bottom; a pane whose
   * content rides its top edge (see `MorphingDockSwitch`) passes `"bottom"`,
   * because there the bottom rows leave through the pane's fixed edge.
   */
  exitOrder?: 'top' | 'bottom';
  reduce: boolean;
  testID?: string;
};

/** Rows peel away toward the anchor, with a bounded stagger even in long lists. */
function SwitcherMotionRow({ children, index, count, closing, openAbove, exitOrder, reduce, testID }: SwitcherMotionRowProps) {
  const bottomFirst = exitOrder ? exitOrder === 'bottom' : !openAbove;
  const order = bottomFirst ? count - index - 1 : index;
  const delay = Math.min(Math.max(order, 0) * ROW_EXIT_STAGGER, ROW_EXIT_MAX_DELAY);
  const exitY = openAbove ? 4 : -4;
  return (
    <MotiView
      testID={testID}
      from={reduce ? { opacity: 1, scale: 1, translateY: 0 } : { opacity: 0, scale: 0.98, translateY: 4 }}
      animate={{ opacity: closing ? 0 : 1, scale: closing ? 0.97 : 1, translateY: closing ? exitY : 0 }}
      transition={
        reduce
          ? TIMING_INSTANT
          : {
              type: 'timing',
              duration: closing ? ROW_EXIT_DURATION : 180,
              // The exit waits out the close's opening beat: the rows stay put while
              // the pane swells and holds, and only start peeling once it is moving.
              delay: closing ? CLOSE_LEAD + delay : 40,
              easing: EASE_OUT,
            }
      }
      style={{ flexShrink: 0 }}
    >
      {children}
    </MotiView>
  );
}

export { SwitcherMotionRow };
