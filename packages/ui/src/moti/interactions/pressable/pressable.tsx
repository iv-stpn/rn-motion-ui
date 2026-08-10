import { type ReactNode, useMemo } from 'react';
import { Pressable } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { hasKey } from '../../../lib/typeguards';
import { View as MotiView } from '../../components/view';
import { INTERACTION_CONTAINER_ID, MotiPressableContext, useMotiPressableContext } from './context';
import { Hoverable } from './hoverable';
import type { MotiPressableInteractionState, MotiPressableProps } from './types';

/**
 * A `<Pressable>` whose children animate in response to hover and press state.
 *
 * `MotiPressable` tracks `hovered` and `pressed` as Reanimated shared values
 * and exposes them to its `animate` prop (and the child render function) via a
 * derived `interaction` value. This lets you declaratively define per-state
 * animation styles without manual gesture tracking.
 *
 * ## How it works
 *
 * 1. Wraps a `MotiView` inside a RN `<Pressable>` + `<Hoverable>`.
 * 2. The `animate` prop receives `{ hovered, pressed }` and returns the target
 *    style. When the interaction changes, the Moti engine animates to the new
 *    style using the `transition` config.
 * 3. Every `MotiPressable` creates an interaction context. Descendant components
 *    can read this context via `useMotiPressable`, `useMotiPressables`, etc.
 *
 * ```tsx
 * <MotiPressable
 *   animate={({ hovered, pressed }) => ({
 *     opacity: pressed ? 0.6 : hovered ? 0.9 : 1,
 *     scale: pressed ? 0.97 : 1,
 *   })}
 *   transition={{ type: 'spring', damping: 15 }}
 *   onPress={() => console.log('pressed')}
 * >
 *   <MotiText>Press me</MotiText>
 * </MotiPressable>
 * ```
 *
 * ## Interaction context
 *
 * `MotiPressable` publishes its interaction shared value to a React context.
 * Descendant Moti components can subscribe with:
 *
 * - `useMotiPressable(factory)` — derive one `animate` style from the nearest
 *   pressable.
 * - `useMotiPressables(factory)` — derive a style from **all** ancestor
 *   pressables at once.
 * - `useMotiPressableAnimatedProps(factory)` — derive arbitrary animated props
 *   (not just styles).
 * - `useMotiPressableInterpolate(factory)` — like `useDerivedValue` but with
 *   interaction state as input.
 * - `useMotiPressableTransition(factory)` — derive the transition config from
 *   interaction state.
 *
 * Pass an `id` to make a pressable discoverable by name; hooks can target a
 * specific ancestor by passing its `id` as the first argument.
 */
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: MotiPressable wires hover/press shared values, accessibility, and child rendering in one component — factoring out sub-helpers would require prop-drilling the shared values
export function MotiPressable(props: MotiPressableProps) {
  const { ref } = props;
  const {
    animate,
    from,
    exit,
    children,
    exitTransition,
    transition: transitionProp,
    style,
    onPressOut,
    onPressIn,
    onHoverIn,
    onHoverOut,
    onKeyDown,
    onKeyUp,
    onPress,
    onLongPress,
    hitSlop,
    disabled,
    containerStyle,
    dangerouslySilenceDuplicateIdsWarning = false,
    id,
    hoveredValue,
    pressedValue,
    onLayout,
    onContainerLayout,
    accessibilityActions,
    accessibilityElementsHidden,
    accessibilityHint,
    accessibilityIgnoresInvertColors,
    accessibilityLabel,
    accessibilityLiveRegion,
    accessibilityRole,
    accessibilityState,
    accessibilityValue,
    accessibilityViewIsModal,
    accessible,
    onAccessibilityTap,
    onAccessibilityAction,
    onAccessibilityEscape,
    importantForAccessibility,
    onFocus,
    onBlur,
    href,
    testID,
  } = props;

  const _hovered = useSharedValue(false);
  const _pressed = useSharedValue(false);

  const hovered = hoveredValue ?? _hovered;
  const pressed = pressedValue ?? _pressed;

  // RNR4: useDerivedValue no longer accepts a dependency array.
  const interaction = useDerivedValue<MotiPressableInteractionState>(() => ({
    hovered: hovered.value,
    pressed: pressed.value,
  }));

  const transition = useDerivedValue(() => {
    if (typeof transitionProp === 'function') return transitionProp(interaction.value);
    return transitionProp ?? {};
  });

  const __state = useDerivedValue(() => {
    if (typeof animate === 'function') return animate(interaction.value);
    return animate;
  });

  const state = useMemo(() => ({ __state }), [__state]);

  const updateInteraction = (event: keyof MotiPressableInteractionState, enabled: boolean, callback?: () => void) => () => {
    'worklet';
    if (event === 'hovered') hovered.value = enabled;
    else if (event === 'pressed') pressed.value = enabled;
    if (callback) scheduleOnRN(callback);
  };

  const child = (
    <MotiView
      from={from}
      exit={exit}
      transition={transition}
      exitTransition={exitTransition}
      state={state}
      style={style}
      onLayout={onLayout}
    >
      {/* biome-ignore lint/suspicious/noLeakedRender: children is ReactNode — safe alternate branch */}
      {typeof children === 'function' ? children(interaction) : children}
    </MotiView>
  );

  const context = useMotiPressableContext();

  if (!dangerouslySilenceDuplicateIdsWarning && id && context?.containers && hasKey(id, context.containers))
    console.error(
      `[MotiPressable] Duplicate id "${id}" used. A <MotiPressable id="${id}" /> is already a parent of this component.`,
    );

  const node: ReactNode = (
    <Hoverable
      onHoverIn={updateInteraction('hovered', true, onHoverIn)}
      onHoverOut={updateInteraction('hovered', false, onHoverOut)}
      childRef={ref}
    >
      <Pressable
        onLongPress={onLongPress}
        hitSlop={hitSlop}
        disabled={disabled}
        style={containerStyle}
        onPress={onPress}
        onPressIn={updateInteraction('pressed', true, onPressIn)}
        onPressOut={updateInteraction('pressed', false, onPressOut)}
        ref={ref}
        testID={testID}
        onLayout={onContainerLayout}
        accessibilityActions={accessibilityActions}
        accessibilityElementsHidden={accessibilityElementsHidden}
        accessibilityHint={accessibilityHint}
        accessibilityIgnoresInvertColors={accessibilityIgnoresInvertColors}
        accessibilityLabel={accessibilityLabel}
        accessibilityLiveRegion={accessibilityLiveRegion}
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState}
        accessibilityValue={accessibilityValue}
        accessibilityViewIsModal={accessibilityViewIsModal}
        accessible={accessible}
        onAccessibilityTap={onAccessibilityTap}
        onAccessibilityAction={onAccessibilityAction}
        onAccessibilityEscape={onAccessibilityEscape}
        importantForAccessibility={importantForAccessibility}
        // @ts-expect-error RNW extended props
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onFocus={onFocus}
        onBlur={onBlur}
        href={href}
      >
        {child}
      </Pressable>
    </Hoverable>
  );

  return (
    <MotiPressableContext.Provider
      value={useMemo(() => {
        const interactions: MotiPressableContext = {
          containers: {
            ...context?.containers,
            [INTERACTION_CONTAINER_ID]: interaction,
          },
        };
        if (id) interactions.containers[id] = interaction;
        return interactions;
      }, [context?.containers, id, interaction])}
    >
      {node}
    </MotiPressableContext.Provider>
  );
}
