import type { ComponentProps } from 'react';
import type { Insets, PressableProps, ViewStyle } from 'react-native';
import type Animated from 'react-native-reanimated';
import type { DerivedValue } from 'react-native-reanimated';

import type { MotiView } from '../../components';
import type { MotiAnimationProp, MotiTransition } from '../../core';

export type MotiPressableInteractionState = {
  hovered: boolean;
  pressed: boolean;
};

export type AnimateProp = MotiAnimationProp<ViewStyle>;

type Interactable<T> = (interaction: MotiPressableInteractionState) => NonNullable<T>;
type InteractableProp<T> = Interactable<T> | T;

export type MotiPressableInteractionProp = Interactable<AnimateProp>;
export type MotiPressableTransitionProp = InteractableProp<MotiTransition>;
export type MotiPressableProp = InteractableProp<AnimateProp>;

export type MotiPressableProps = {
  onFocus?: () => void;
  onBlur?: () => void;
  transition?: MotiPressableTransitionProp;
  animate?: MotiPressableProp;
  /** @deprecated The `state` prop is not available with this component. */
  state?: never;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
  onLongPress?: () => void;
  hitSlop?: Insets;
  /** Optional unique ID to identify this interaction container. */
  id?: string;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  dangerouslySilenceDuplicateIdsWarning?: boolean;
  pressedValue?: Animated.SharedValue<boolean>;
  hoveredValue?: Animated.SharedValue<boolean>;
  onContainerLayout?: PressableProps['onLayout'];
  href?: string;
  testID?: PressableProps['testID'];
  children?: React.ReactNode | ((interaction: DerivedValue<MotiPressableInteractionState>) => React.ReactNode);
} & Pick<ComponentProps<typeof MotiView>, 'exit' | 'from' | 'exitTransition' | 'style' | 'onLayout'> &
  Pick<
    PressableProps,
    | 'accessibilityActions'
    | 'accessibilityElementsHidden'
    | 'accessibilityHint'
    | 'accessibilityIgnoresInvertColors'
    | 'accessibilityLabel'
    | 'accessibilityLiveRegion'
    | 'accessibilityRole'
    | 'accessibilityState'
    | 'accessibilityValue'
    | 'accessibilityViewIsModal'
    | 'accessible'
    | 'onAccessibilityTap'
    | 'onAccessibilityAction'
    | 'onAccessibilityEscape'
    | 'importantForAccessibility'
  >;
