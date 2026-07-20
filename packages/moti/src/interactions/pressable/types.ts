import type { ComponentProps, Ref } from 'react';
import type { Insets, PressableProps, View, ViewStyle } from 'react-native';
import type { DerivedValue, SharedValue } from 'react-native-reanimated';

import type { MotiView } from '../../components/view';
import type { MotiAnimationProp, MotiTransition } from '../../core/types';

// biome-ignore lint/style/useExportsLast: MotiPressableInteractionState is a public type that the private Interactable<T> helper depends on — reversing the order would harm readability
export type MotiPressableInteractionState = { hovered: boolean; pressed: boolean };

type Interactable<T> = (interaction: MotiPressableInteractionState) => NonNullable<T>;
type InteractableProp<T> = Interactable<T> | T;

export type AnimateProp = MotiAnimationProp<ViewStyle>;
export type MotiPressableInteractionProp = Interactable<AnimateProp>;
export type MotiPressableTransitionProp = InteractableProp<MotiTransition>;
export type MotiPressableProp = InteractableProp<AnimateProp>;

export type MotiPressableProps = {
  ref?: Ref<View>;
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
  pressedValue?: SharedValue<boolean>;
  hoveredValue?: SharedValue<boolean>;
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
