import type {
  ImageStyle,
  PerspectiveTransform,
  RotateTransform,
  RotateXTransform,
  RotateYTransform,
  RotateZTransform,
  ScaleTransform,
  ScaleXTransform,
  ScaleYTransform,
  SkewXTransform,
  SkewYTransform,
  TextStyle,
  TranslateXTransform,
  TranslateYTransform,
  ViewStyle,
} from 'react-native';
import type {
  DerivedValue,
  SharedValue,
  WithDecayConfig,
  WithSpringConfig,
  WithTimingConfig,
} from 'react-native-reanimated';

export type Transforms = PerspectiveTransform &
  RotateTransform &
  RotateXTransform &
  RotateYTransform &
  RotateZTransform &
  ScaleTransform &
  ScaleXTransform &
  ScaleYTransform &
  TranslateXTransform &
  TranslateYTransform &
  SkewXTransform &
  SkewYTransform;

export type MotiTranformProps = Partial<Transforms> & Pick<ViewStyle, 'transform'>;

export type TransitionConfigWithoutRepeats = (
  | ({ type?: 'spring' } & WithSpringConfig)
  | ({ type: 'timing' } & WithTimingConfig)
  | ({ type: 'decay' } & WithDecayConfig)
  | { type: 'no-animation' }
) & {
  delay?: number;
};

export type TransitionConfig = TransitionConfigWithoutRepeats & {
  /**
   * Number of times this animation should repeat. To make it infinite, use the `loop` boolean.
   *
   * Default: `0`
   */
  repeat?: number;
  /**
   * Setting this to `true` is the same as `repeat: Infinity`
   *
   * Default: `false`
   */
  loop?: boolean;
  /**
   * Whether or not the animation repetition should alternate in direction.
   *
   * By default, this is `true`.
   */
  repeatReverse?: boolean;
};

export type SequenceItemObject<Value> = {
  value: Value;
  onDidAnimate?: (
    finished: boolean,
    maybeValue: Value | undefined,
    info: {
      attemptedSequenceArray: Value;
      attemptedSequenceItemValue: Value;
    },
  ) => void;
} & TransitionConfigWithoutRepeats;

export type SequenceItem<Value> = Value | SequenceItemObject<Value>;

export type StyleValueWithSequenceArraysWithoutTransform<T> = {
  [key in Exclude<keyof T, 'transform' | keyof Transforms>]:
    | T[key]
    | SequenceItem<T[ExcludeArrayType<ExcludeObject<key>>]>[];
} & {
  [key in Extract<keyof T, keyof Transforms>]?: T[key] | (string & {}) | SequenceItem<T[key] | (string & {})>[];
};

export type StyleValueWithSequenceArraysWithTransform = {
  transform: StyleValueWithSequenceArrays<Transforms>[];
};

export type StyleValueWithSequenceArrays<T> = Partial<
  StyleValueWithSequenceArraysWithoutTransform<T> & StyleValueWithSequenceArraysWithTransform
>;

export type OnDidAnimate<Animate = ImageStyle & TextStyle & ViewStyle, Key extends keyof Animate = keyof Animate> = (
  styleProp: Key,
  finished: boolean,
  value: Animate[Key] | undefined,
  event: {
    attemptedValue: Animate[Key];
    attemptedSequenceItemValue?: Animate[Key];
  },
) => void;

export type StyleValueWithReplacedTransforms<StyleProp> = Omit<StyleProp, keyof Transforms> & MotiTranformProps;

export type MotiAnimationProp<Animate> = MotiProps<Animate>['animate'];
export type MotiFromProp<Animate> = MotiProps<Animate>['from'];
export type MotiExitProp<Animate> = MotiProps<Animate>['exit'];

type OrDerivedValue<T> = T | DerivedValue<T>;

type FallbackAnimateProp = StyleValueWithReplacedTransforms<ImageStyle & TextStyle & ViewStyle>;

export type MotiTransition<Animate = FallbackAnimateProp> = TransitionConfig &
  Partial<Record<keyof Animate, TransitionConfig>>;

export type MotiTransitionProp<Animate = FallbackAnimateProp> = OrDerivedValue<MotiTransition<Animate>>;

export type InlineOnDidAnimate<Value> = (
  finished: boolean,
  value: Value | undefined,
  event: {
    attemptedValue: Value;
  },
) => void;

type ExcludeArrayType<T> = T extends unknown[] ? never : T;
type ExcludeObject<T> = T extends object ? never : T;

type StyleValueWithCallbacks<Animate> = {
  [Key in keyof Animate]?:
    | Animate[Key]
    | {
        value: ExcludeObject<ExcludeArrayType<Animate[Key]>>;
        onDidAnimate: InlineOnDidAnimate<Animate[Key]>;
      };
};

export interface MotiProps<
  AnimateType = ImageStyle & TextStyle & ViewStyle,
  AnimateWithTransforms = StyleValueWithReplacedTransforms<AnimateType>,
  AnimateWithSequences = StyleValueWithSequenceArrays<AnimateWithTransforms>,
  Animate = StyleValueWithCallbacks<AnimateWithSequences>,
> {
  onDidAnimate?: OnDidAnimate<AnimateWithTransforms>;
  animate?: OrDerivedValue<Animate>;
  from?: Animate | boolean;
  exit?: AnimateWithTransforms | boolean | ((custom?: unknown) => AnimateWithTransforms);
  transition?: MotiTransitionProp<AnimateWithTransforms>;
  exitTransition?:
    | MotiTransitionProp<AnimateWithTransforms>
    | ((custom?: unknown) => MotiTransition<AnimateWithTransforms>);
  delay?: number;
  state?: { __state: SharedValue<unknown> | DerivedValue<unknown> };
  stylePriority?: 'state' | 'animate';
  animateInitialState?: boolean;
}

export type InternalControllerState<V> = number | V[keyof V];

export type Variants<
  V,
  AnimateType = ImageStyle & TextStyle & ViewStyle,
  AnimateWithTransformsAndTransition = StyleValueWithReplacedTransforms<AnimateType> & WithTransition,
  Animate = StyleValueWithSequenceArrays<AnimateWithTransformsAndTransition>,
> = {
  [key in keyof V]?: Animate;
} & {
  to?: Animate;
  from?: AnimateWithTransformsAndTransition;
};

export type UseAnimationState<V> = {
  current: null | keyof V;
  __state: SharedValue<unknown> | DerivedValue<unknown>;
  transitionTo: (key: keyof V | ((currentState: keyof V) => keyof V)) => void;
};

export type UseAnimationStateConfig<
  Variants,
  FromKey extends keyof Variants = keyof Variants,
  ToKey extends keyof Variants = keyof Variants,
> = {
  from?: FromKey;
  to?: ToKey;
};

export type WithTransition = {
  transition?: MotiTransition;
};

export type DynamicStyleProp<
  AnimateType = ImageStyle & ViewStyle & TextStyle,
  AnimateWithTransforms = StyleValueWithReplacedTransforms<AnimateType>,
> = NonNullable<StyleValueWithSequenceArrays<AnimateWithTransforms>> & WithTransition;

export type UseDynamicAnimationState<Animate = FallbackAnimateProp> = {
  __state: SharedValue<unknown>;
  current: null | DynamicStyleProp;
  animateTo: (
    key: DynamicStyleProp<Animate> | ((currentState: DynamicStyleProp<Animate>) => DynamicStyleProp<Animate>),
  ) => void;
};

export type ExcludeFunctionKeys<T> = {
  // biome-ignore lint/suspicious/noExplicitAny: standard TS idiom for function detection in mapped types — unknown[] breaks due to parameter contravariance
  [K in keyof T as T[K] extends (...a: any[]) => any ? never : K]?: T[K];
};
