import { hasKey } from '@rn-motion-ui/utils/typeguards';
import { type ReactNode, useMemo } from 'react';
import { Pressable } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { View as MotiView } from '../../components/view';
import { INTERACTION_CONTAINER_ID, MotiPressableContext, useMotiPressableContext } from './context';
import { Hoverable } from './hoverable';
import type { MotiPressableInteractionState, MotiPressableProps } from './types';

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
    if (callback) runOnJS(callback)();
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
