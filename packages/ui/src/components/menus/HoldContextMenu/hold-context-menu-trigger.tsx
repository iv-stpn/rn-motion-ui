// biome-ignore-all lint/style/useExportsLast: the props type belongs next to the component it describes
/**
 * The in-place half of `HoldContextMenu`: what the user actually holds.
 *
 * Two jobs, and they pull in opposite directions — which is why this is its own
 * component. It has to squeeze under the finger (a transform), and it has to
 * report the rect the panel anchors to (`measureInWindow`, which returns
 * post-transform bounds). So the measured wrapper stays untransformed and the
 * squeeze lives on a child. Collapse those two into one node and the lifted copy
 * anchors to a rect 5% smaller than the item, visibly jumping on close.
 *
 * On web the squeeze never runs — the hook hands over no press handlers for
 * `'hold'` there, so `pressed` stays false and the only job left is the measured
 * wrapper. See `HOLD_MENU_LIFTS`.
 */

import type { ReactNode, RefObject } from 'react';
import { type AccessibilityActionEvent, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { EASE_OUT, SPRING_PRESS } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { HOLD_ITEM_SCALE } from './hold-context-menu-layout';
import type { HoldContextMenuActivation } from './use-hold-activation';

/** Squeeze duration for tap activations, which have no hold for it to fill. */
const TAP_SQUEEZE_DURATION = 150;

/**
 * Undoes the `cursor: pointer` RNW puts on every enabled `Pressable`.
 *
 * Applied when no press handler reached this trigger — web's `'hold'`, where the
 * menu is a right-click. A hand cursor there promises a left-click does
 * something, and it does not.
 */
const NO_POINTER_STYLE = { cursor: 'auto' } as const satisfies ViewStyle;

/**
 * How long the in-place item stays visible after its copy appears.
 *
 * On native the `Modal`'s first frame lands after the commit that opens it, so
 * hiding the original in that commit leaves a hole where the item was. Both
 * visible for a beat is invisible — same pixels, same place, same scale.
 */
const HANDOVER_DELAY = 80;

const ACTIVATION_HINT: Record<HoldContextMenuActivation, string> = {
  hold: 'Hold to open the actions menu',
  tap: 'Opens the actions menu',
  'double-tap': 'Double tap to open the actions menu',
};

/**
 * Gives assistive tech a way in. A hold has no screen-reader gesture, so
 * VoiceOver and TalkBack activate the menu through this action instead.
 */
const LONG_PRESS_ACTIONS = [{ name: 'longpress', label: 'Open actions menu' }] as const;

type ScaleInput = { reduce: boolean; squeezed: boolean; activateOn: HoldContextMenuActivation; holdDuration: number };

/**
 * Transition for the squeeze.
 *
 * Going down it is timed to land exactly as the long press fires, so the squeeze
 * reads as the gesture's own progress rather than as a separate animation.
 * Coming back up it springs, because nothing is waiting on it.
 */
function scaleTransition({ reduce, squeezed, activateOn, holdDuration }: ScaleInput) {
  if (reduce) return { type: 'timing' as const, duration: 0 };
  if (!squeezed) return SPRING_PRESS;
  return { type: 'timing' as const, duration: activateOn === 'hold' ? holdDuration : TAP_SQUEEZE_DURATION, easing: EASE_OUT };
}

export type HoldContextMenuTriggerProps = {
  children: ReactNode;
  /** Attached to the untransformed wrapper — the rect the panel anchors to. */
  wrapperRef: RefObject<View | null>;
  activateOn: HoldContextMenuActivation;
  holdDuration: number;
  disabled: boolean;
  /** True while the copy is on screen: the original hides so it is not painted twice. */
  lifted: boolean;
  /** Held, but not yet activated. Never true on web, which has no squeeze. */
  pressed: boolean;
  open: boolean;
  reduce: boolean;
  accessibilityLabel?: string;
  /** Overrides the per-activation default. Native only — RNW drops the hint. */
  accessibilityHint?: string;
  /**
   * Each press handler is `undefined` when its gesture is not this platform's.
   * All four undefined — web's `'hold'`, where the menu is a right-click — means
   * the trigger is a measured wrapper and nothing more, and the cursor says so.
   */
  onPressIn: (() => void) | undefined;
  onPressOut: (() => void) | undefined;
  onLongPress: (() => void) | undefined;
  onPress: (() => void) | undefined;
  onAccessibilityAction: (event: AccessibilityActionEvent) => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function HoldContextMenuTrigger({
  children,
  wrapperRef,
  activateOn,
  holdDuration,
  disabled,
  lifted,
  pressed,
  open,
  reduce,
  accessibilityLabel,
  accessibilityHint,
  onPressIn,
  onPressOut,
  onLongPress,
  onPress,
  onAccessibilityAction,
  className,
  style,
  testID,
}: HoldContextMenuTriggerProps) {
  // Squeezing stops the moment the copy takes over, so the original is back at
  // rest by the time it is revealed again.
  const squeezed = pressed && !lifted;

  // Both are `undefined` on web under `'hold'`, where the hook activates from a
  // `contextmenu` listener instead. Reading the handlers rather than the platform
  // keeps this true for a trigger that is inert for any other reason.
  const pressActivates = Boolean(onLongPress ?? onPress);

  return (
    <View className={className} collapsable={false} ref={wrapperRef} style={style} testID={testID}>
      <MotiView
        animate={{ opacity: lifted ? 0 : 1, scale: squeezed ? HOLD_ITEM_SCALE : 1 }}
        transition={{
          ...scaleTransition({ activateOn, holdDuration, reduce, squeezed }),
          // Snaps rather than fades: cross-fading two identical copies of the
          // same item is a flicker, not a transition. The delay only applies on
          // the way out (see HANDOVER_DELAY) — coming back it is immediate,
          // landing in the same commit that unmounts the Modal.
          opacity: { type: 'timing' as const, duration: 0, delay: lifted ? HANDOVER_DELAY : 0 },
        }}
      >
        <Pressable
          accessibilityActions={LONG_PRESS_ACTIONS}
          accessibilityHint={accessibilityHint ?? ACTIVATION_HINT[activateOn]}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          aria-expanded={open}
          delayLongPress={holdDuration}
          disabled={disabled}
          onAccessibilityAction={onAccessibilityAction}
          onLongPress={onLongPress}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={pressActivates ? undefined : NO_POINTER_STYLE}
        >
          {children}
        </Pressable>
      </MotiView>
    </View>
  );
}
