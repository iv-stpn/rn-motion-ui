// biome-ignore-all lint/style/useExportsLast: the props type belongs next to the component it describes
// biome-ignore-all lint/style/noExcessiveLinesPerFile: TriggerPressable and DragOnlyBody live here to keep HoldContextMenuTrigger under the function-line and complexity limits — a micro-module per helper would be worse
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
 * On web `'hold'` is a right-click for a mouse — but a *touch* press still
 * holds, and squeezes with it: mobile web has no right button, so the gesture is
 * the only way in there. Nothing lifts on web either way (`HOLD_MENU_LIFTS`),
 * so the squeeze releases the moment the hold fires rather than waiting for a
 * lifted copy to take over — see the latch in `HoldContent`.
 *
 * For `'hold'` on native, the gesture widget is a `<Holdable>` (or a
 * `<HoldDraggable>` when `dragOptions` are given) rather than a `<Pressable>`.
 * The four-phase timeline means the squeeze starts at `armDelay` (the
 * render-prop's `isPressed` flips true) and the hold fires at `holdDelay` —
 * both on the same timer, so the animation lands exactly as the menu opens.
 *
 * `'passive'` mode drops the gesture widget entirely: see
 * {@link HoldContextMenuTriggerMode}. What is left is the measured wrapper and
 * the hide-while-lifted opacity — the two things the overlay needs from this
 * side regardless of who owns the gesture.
 */

import { type ReactNode, type RefObject, useMemo, useRef } from 'react';
import type { AccessibilityActionEvent, StyleProp, ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';
import { EASE_OUT, SPRING_PRESS } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import type { DragEffectAllowed, DragEndEvent, DragGroups, DragStartEvent } from '../../gestures/drag.types';
import type { DragBehavior } from '../../gestures/drag-behavior';
import { HoldDraggable } from '../../gestures/Holdable/hold-draggable';
import type { HoldableState } from '../../gestures/Holdable/holdable';
import { Holdable } from '../../gestures/Holdable/holdable';
import { HOLD_ITEM_SCALE } from './hold-context-menu-layout';
import type { HoldContextMenuActivation } from './use-hold-activation';
import { HOLD_MENU_LIFTS } from './use-hold-activation';

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

/**
 * The drag options that wire a drag gesture into the hold trigger.
 *
 * When provided, `<HoldContextMenuTrigger>` uses `<HoldDraggable>` instead of
 * `<Holdable>` — hold still opens the menu, but a move past `escapeSlop` lifts
 * a drag. The hold fires `onHold` (which opens the menu) and an escape fires
 * `onHoldEscape` (which closes it again) before the drag starts.
 *
 * Only active on native (`HOLD_MENU_LIFTS`); on web the menu is a right-click
 * and there is no gesture widget to upgrade.
 */
export type HoldContextMenuDragOptions = {
  data: Record<string, string>;
  effectAllowed?: DragEffectAllowed;
  groups?: DragGroups;
  /**
   * Override the drag ghost. Forwarded to `<HoldDraggable preview>`.
   *
   * Useful when the source belongs to a group drag whose ghost describes the
   * group rather than the individual item — pass `renderPreview(ids)` from
   * `useMultiDragScope` here to get the same ghost `<MultiDraggable>` would.
   */
  preview?: ReactNode;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
};

/**
 * Who owns the press.
 *
 * `'pressable'` is the component: for `'hold'` on native it wraps children in a
 * `<Holdable>` (or `<HoldDraggable>` when `dragOptions` are given), and for
 * `'tap'` / `'double-tap'` it wraps them in a `<Pressable>`. Either way it
 * squeezes under the finger and announces itself as the button that opens the
 * menu.
 *
 * `'passive'` is the host. No gesture widget is rendered, so no second button
 * nests inside a child that is already one, no extra tab stop per item, and on
 * native no inner press responder for the host's own to fight. The host opens
 * the menu by driving the controlled `open` prop, and owns the accessibility
 * path to it as well. Web's right-click still works: the `contextmenu` listener
 * sits on the wrapper, and the event bubbles to it from whatever the children
 * render.
 *
 * There is no squeeze in `'passive'` — the press it previewed belongs to someone
 * else — so the lifted copy springs from rest instead of from
 * {@link HOLD_ITEM_SCALE}.
 */
export type HoldContextMenuTriggerMode = 'pressable' | 'passive';

type ScaleInput = { reduce: boolean; squeezed: boolean; activateOn: HoldContextMenuActivation; holdDuration: number };

/**
 * Transition for the squeeze.
 *
 * Going down it is timed to land exactly as the hold fires, so the squeeze
 * reads as the gesture's own progress rather than as a separate animation.
 * Coming back up it springs, because nothing is waiting on it.
 */
function scaleTransition({ reduce, squeezed, activateOn, holdDuration }: ScaleInput) {
  if (reduce) return { type: 'timing' as const, duration: 0 };
  if (!squeezed) return SPRING_PRESS;
  return { type: 'timing' as const, duration: activateOn === 'hold' ? holdDuration : TAP_SQUEEZE_DURATION, easing: EASE_OUT };
}

type HoldContentProps = {
  activateOn: HoldContextMenuActivation;
  children: ReactNode;
  holdDuration: number;
  isHeld: boolean;
  isPressed: boolean;
  lifted: boolean;
  reduce: boolean;
};

/**
 * The squeeze animation for the Holdable / HoldDraggable render-prop path.
 *
 * Extracted to module level so its internal branches are counted separately
 * from `HoldContextMenuTrigger` and do not inflate that function's cyclomatic
 * complexity.
 */
function HoldContent({ activateOn, children, holdDuration, isHeld, isPressed, lifted, reduce }: HoldContentProps) {
  const spent = useRef(false);

  // Latch: once the squeeze has done its job, don't hold it. On native the job
  // ends when the lifted copy takes over (`lifted`); on web nothing lifts, so it
  // ends when the hold fires and the menu arrives (`isHeld`). Without the web
  // half the item sat pinched at 95% for as long as the menu stayed open, and
  // the release spring fired exactly when the press ended — which is the moment
  // the menu closes or the drag escapes — reading as a flicker on the trigger.
  // Not re-squeezing when the lift ends matters for the same reason: at that
  // point the menu just closed, and dropping to 95% would read the same way.
  if (lifted || (isHeld && !HOLD_MENU_LIFTS)) spent.current = true;
  // Reset the latch once the gesture fully ends, so the next press squeezes normally.
  if (!isPressed) spent.current = false;

  const squeezed = isPressed && !lifted && !spent.current;
  const scale = squeezed ? HOLD_ITEM_SCALE : 1;

  // Scale animates so the squeeze reads as the gesture's own progress; opacity
  // rides on `style` so it applies synchronously — an instant 0↔1 through the
  // animation system still costs a frame, which is the flicker on exit.
  const animate = useMemo(() => ({ scale }), [scale]);
  const transition = useMemo(
    () => scaleTransition({ activateOn, holdDuration, reduce, squeezed }),
    [activateOn, holdDuration, reduce, squeezed],
  );

  return (
    <MotiView animate={animate} className={lifted ? 'opacity-0' : 'opacity-100'} transition={transition}>
      {children}
    </MotiView>
  );
}

type TriggerPressableProps = {
  children?: ReactNode;
  activateOn: HoldContextMenuActivation;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled: boolean;
  open: boolean;
  pressActivates: boolean;
  onAccessibilityAction: (event: AccessibilityActionEvent) => void;
  onPress: (() => void) | undefined;
  onPressIn: (() => void) | undefined;
  onPressOut: (() => void) | undefined;
};

/**
 * The shared `Pressable` used in the drag-only and tap/double-tap branches.
 *
 * Extracted so it can be spread into both branches without duplicating the
 * twelve accessibility props or inflating `HoldContextMenuTrigger`'s line and
 * complexity counts.
 */
function TriggerPressable({
  activateOn,
  accessibilityHint,
  accessibilityLabel,
  children,
  disabled,
  open,
  pressActivates,
  onAccessibilityAction,
  onPress,
  onPressIn,
  onPressOut,
}: TriggerPressableProps) {
  return (
    <Pressable
      accessibilityActions={LONG_PRESS_ACTIONS}
      accessibilityHint={accessibilityHint ?? ACTIVATION_HINT[activateOn]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      aria-expanded={open}
      disabled={disabled}
      onAccessibilityAction={onAccessibilityAction}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={pressActivates ? undefined : NO_POINTER_STYLE}
    >
      {children}
    </Pressable>
  );
}

type DragOnlyBodyProps = TriggerPressableProps & {
  behavior?: DragBehavior;
  dragOptions: HoldContextMenuDragOptions;
  lifted: boolean;
};

/**
 * The drag-source wrapper used when no hold gesture is active but drag is.
 *
 * On web, `HOLD_MENU_LIFTS` is false, so `onHold` is never passed to the
 * trigger — but the HTML5 drag transport still needs a mounted `<HoldDraggable>`
 * bound to the node. This component renders that source with a plain
 * `<TriggerPressable>` inside so the tap/accessibility path still works.
 */
function DragOnlyBody({ behavior, children, dragOptions, lifted, ...pressableProps }: DragOnlyBodyProps) {
  return (
    <HoldDraggable
      behavior={behavior}
      data={dragOptions.data}
      disabled={pressableProps.disabled}
      effectAllowed={dragOptions.effectAllowed}
      groups={dragOptions.groups}
      onDragEnd={dragOptions.onDragEnd}
      onDragStart={dragOptions.onDragStart}
      preview={dragOptions.preview}
    >
      <MotiView
        animate={{ opacity: lifted ? 0 : 1, scale: 1 }}
        transition={{ opacity: { type: 'timing' as const, duration: 0, delay: lifted ? HANDOVER_DELAY : 0 } }}
      >
        <TriggerPressable {...pressableProps}>{children}</TriggerPressable>
      </MotiView>
    </HoldDraggable>
  );
}

export type HoldContextMenuTriggerProps = {
  children?: ReactNode;
  /** Attached to the untransformed wrapper — the rect the panel anchors to. */
  wrapperRef: RefObject<View | null>;
  /** Whether this component wraps the children in a gesture widget at all. */
  mode: HoldContextMenuTriggerMode;
  activateOn: HoldContextMenuActivation;
  /**
   * Squeeze animation duration for hold activations, in ms.
   *
   * Equal to `holdDelay − armDelay` from the resolved tuning so the animation
   * starts the moment `armDelay` passes and lands exactly when the hold fires.
   * For `'tap'` / `'double-tap'` the value is ignored — a fixed
   * `TAP_SQUEEZE_DURATION` is used instead.
   */
  holdDuration: number;
  disabled: boolean;
  /** True while the copy is on screen: the original hides so it is not painted twice. */
  lifted: boolean;
  /**
   * Held down but not yet activated — drives the `'tap'` / `'double-tap'`
   * Pressable squeeze. For `'hold'` on native this is always `false`; the
   * `<Holdable>` render-prop delivers `isPressed` directly to the MotiView.
   */
  pressed: boolean;
  open: boolean;
  reduce: boolean;
  accessibilityLabel?: string;
  /** Overrides the per-activation default. Native only — RNW drops the hint. */
  accessibilityHint?: string;
  /**
   * Fed to `<Holdable onHold>` / `<HoldDraggable onHold>` on native for
   * `'hold'` activations. `undefined` for `'tap'` / `'double-tap'` and on web
   * (where `'hold'` is a right-click via the `contextmenu` listener).
   */
  onHold: (() => void) | undefined;
  /**
   * Forwarded to `<HoldDraggable onHoldEscape>` when `dragOptions` is set — so
   * the parent can close the menu when a drag escapes the hold.
   */
  onHoldEscape?: () => void;
  /**
   * Timing and slop overrides for `<Holdable>` / `<HoldDraggable>`. The parent
   * already resolved this from `useHoldBehavior`; it is passed through so both
   * the gesture widget and the squeeze animation use the same numbers.
   */
  behavior?: DragBehavior;
  /** When set, the gesture widget is a `<HoldDraggable>` instead of `<Holdable>`. */
  dragOptions?: HoldContextMenuDragOptions;
  /**
   * `'tap'` / `'double-tap'` Pressable handlers — `undefined` for `'hold'` and
   * on web, where the Pressable (if rendered at all) is accessibility-only.
   */
  onPressIn: (() => void) | undefined;
  onPressOut: (() => void) | undefined;
  /** `undefined` in `'hold'`, where the hold callback already handled it. */
  onPress: (() => void) | undefined;
  onAccessibilityAction: (event: AccessibilityActionEvent) => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function HoldContextMenuTrigger({
  children,
  wrapperRef,
  mode,
  activateOn,
  holdDuration,
  disabled,
  lifted,
  pressed,
  open,
  reduce,
  accessibilityLabel,
  accessibilityHint,
  behavior,
  dragOptions,
  onHold,
  onHoldEscape,
  onPress,
  onPressIn,
  onPressOut,
  onAccessibilityAction,
  className,
  style,
  testID,
}: HoldContextMenuTriggerProps) {
  // `onHold` is defined only for `'hold'` — the hook returns it only when
  // `<Holdable>` / `<HoldDraggable>` should own the gesture.
  const useHoldable = onHold !== undefined;

  // Pre-computed so the accessibility props on the wrapper View do not repeat
  // the same condition five times and inflate the cyclomatic count. The label
  // is part of the condition: the wrapper announces itself as the button that
  // opens the menu only when the host named it. Unnamed, the children are
  // assumed to carry their own semantics — a FileSystem tile is already a
  // button named after its entry, and decorating the wrapper too would put two
  // buttons with one name in the tree (the wrapper's name computes from its
  // content when no label is given).
  const isHoldPressable = useHoldable && mode === 'pressable' && accessibilityLabel !== undefined;

  // Cursor is `auto` when no left-click action is wired — web's `'hold'`.
  const pressActivates = Boolean(onHold ?? onPress);

  // Squeeze state for `'tap'` / `'double-tap'` — driven by Pressable's callbacks.
  const tapSqueezed = pressed && !lifted;

  // Thin adapter: maps the Holdable render-prop signature onto `<HoldContent>`,
  // passing the outer closed-over props without a closure branching inside it.
  const holdContent = ({ isHeld, isPressed }: HoldableState) => (
    <HoldContent
      activateOn={activateOn}
      holdDuration={holdDuration}
      isHeld={isHeld}
      isPressed={isPressed}
      lifted={lifted}
      reduce={reduce}
    >
      {children}
    </HoldContent>
  );

  // Gesture widget for `'hold'` on native — resolved before the return so the
  // JSX does not nest a ternary inside the outer passive/holdable/tap ternary.
  // The raw children without the squeeze/lift wrapper — used as the drag ghost
  // preview so the ghost never inherits the `opacity: 0` / `scale: 0.95` that
  // `HoldContent` applies while the menu is open. Without this a drag that
  // escapes a hold renders an invisible ghost.
  const holdWidget = dragOptions ? (
    <HoldDraggable
      behavior={behavior}
      data={dragOptions.data}
      disabled={disabled}
      effectAllowed={dragOptions.effectAllowed}
      groups={dragOptions.groups}
      onDragEnd={dragOptions.onDragEnd}
      onDragStart={dragOptions.onDragStart}
      onHold={onHold}
      onHoldEscape={onHoldEscape}
      preview={dragOptions.preview ?? children}
    >
      {holdContent}
    </HoldDraggable>
  ) : (
    <Holdable behavior={behavior} disabled={disabled} onHold={onHold}>
      {holdContent}
    </Holdable>
  );

  // Accessibility props for the wrapper when Holdable owns the gesture.
  // Computed once so the JSX does not repeat `isHoldPressable ?` five times.
  const wrapperA11y = isHoldPressable
    ? {
        accessibilityActions: LONG_PRESS_ACTIONS,
        accessibilityHint: accessibilityHint ?? ACTIVATION_HINT[activateOn],
        accessibilityLabel,
        accessibilityRole: 'button' as const,
        'aria-expanded': open,
        onAccessibilityAction,
      }
    : undefined;

  // Resolved before the return to avoid nesting ternaries inside ternaries.
  const pressableCommonProps: TriggerPressableProps = {
    activateOn,
    accessibilityHint,
    accessibilityLabel,
    disabled,
    open,
    pressActivates,
    onAccessibilityAction,
    onPress,
    onPressIn,
    onPressOut,
  };

  let body: ReactNode;
  if (mode === 'passive') {
    // Passive: no gesture widget, no squeeze — just the opacity handover.
    body = (
      <MotiView
        animate={{ opacity: lifted ? 0 : 1, scale: 1 }}
        transition={{ opacity: { type: 'timing' as const, duration: 0, delay: lifted ? HANDOVER_DELAY : 0 } }}
      >
        {children}
      </MotiView>
    );
  } else if (useHoldable) {
    // Hold on native: Holdable / HoldDraggable owns the press timeline.
    body = holdWidget;
  } else if (dragOptions) {
    // On web for 'hold' (and on native for tap/double-tap, though that
    // combination is uncommon), no hold gesture runs — but the drag transport
    // still needs a mounted source. See DragOnlyBody.
    body = (
      <DragOnlyBody behavior={behavior} dragOptions={dragOptions} lifted={lifted} {...pressableCommonProps}>
        {children}
      </DragOnlyBody>
    );
  } else {
    // Tap / double-tap, or web hold without drag (Pressable with no press
    // handlers — accessibility only; the contextmenu listener handles activation).
    body = (
      <MotiView
        animate={{ opacity: lifted ? 0 : 1, scale: tapSqueezed ? HOLD_ITEM_SCALE : 1 }}
        transition={{
          ...scaleTransition({ activateOn, holdDuration, reduce, squeezed: tapSqueezed }),
          opacity: { type: 'timing' as const, duration: 0, delay: lifted ? HANDOVER_DELAY : 0 },
        }}
      >
        <TriggerPressable {...pressableCommonProps}>{children}</TriggerPressable>
      </MotiView>
    );
  }

  return (
    <View {...wrapperA11y} className={className} collapsable={false} ref={wrapperRef} style={style} testID={testID}>
      {body}
    </View>
  );
}
