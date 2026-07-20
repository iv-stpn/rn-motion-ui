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
import type { DerivedValue, SharedValue, WithDecayConfig, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

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

export type SequenceItemAnimateInfo<Value> = { attemptedSequenceArray: Value; attemptedSequenceItemValue: Value };

export type SequenceItemObject<Value> = {
  value: Value;
  onDidAnimate?: (finished: boolean, maybeValue: Value | undefined, info: SequenceItemAnimateInfo<Value>) => void;
} & TransitionConfigWithoutRepeats;

export type SequenceItem<Value> = Value | SequenceItemObject<Value>;

export type StyleValueWithSequenceArraysWithoutTransform<T> = {
  [key in Exclude<keyof T, 'transform' | keyof Transforms>]: T[key] | SequenceItem<T[ExcludeArrayType<ExcludeObject<key>>]>[];
} & {
  [key in Extract<keyof T, keyof Transforms>]?: T[key] | (string & {}) | SequenceItem<T[key] | (string & {})>[];
};

export type StyleValueWithSequenceArraysWithTransform = { transform: StyleValueWithSequenceArrays<Transforms>[] };

export type StyleValueWithSequenceArrays<T> = Partial<
  StyleValueWithSequenceArraysWithoutTransform<T> & StyleValueWithSequenceArraysWithTransform
>;

export type OnDidAnimateEvent<Animate, Key extends keyof Animate> = {
  attemptedValue: Animate[Key];
  attemptedSequenceItemValue?: Animate[Key];
};

export type OnDidAnimate<Animate = ImageStyle & TextStyle & ViewStyle, Key extends keyof Animate = keyof Animate> = (
  styleProp: Key,
  finished: boolean,
  value: Animate[Key] | undefined,
  event: OnDidAnimateEvent<Animate, Key>,
) => void;

export type StyleValueWithReplacedTransforms<StyleProp> = Omit<StyleProp, keyof Transforms> & MotiTranformProps;

export type MotiAnimationProp<Animate> = MotiProps<Animate>['animate'];
export type MotiFromProp<Animate> = MotiProps<Animate>['from'];
// biome-ignore lint/style/useExportsLast: helper private types follow that must stay adjacent to the exports they feed (OrDerivedValue, FallbackAnimateProp); restructuring the whole file to satisfy this rule would harm readability
export type MotiExitProp<Animate> = MotiProps<Animate>['exit'];

type OrDerivedValue<T> = T | DerivedValue<T>;

type FallbackAnimateProp = StyleValueWithReplacedTransforms<ImageStyle & TextStyle & ViewStyle>;

export type MotiTransition<Animate = FallbackAnimateProp> = TransitionConfig & Partial<Record<keyof Animate, TransitionConfig>>;

export type MotiTransitionProp<Animate = FallbackAnimateProp> = OrDerivedValue<MotiTransition<Animate>>;

export type InlineOnDidAnimateEvent<Value> = { attemptedValue: Value };

export type InlineOnDidAnimate<Value> = (
  finished: boolean,
  value: Value | undefined,
  event: InlineOnDidAnimateEvent<Value>,
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

export type MotiProps<
  AnimateType = ImageStyle & TextStyle & ViewStyle,
  AnimateWithTransforms = StyleValueWithReplacedTransforms<AnimateType>,
  AnimateWithSequences = StyleValueWithSequenceArrays<AnimateWithTransforms>,
  Animate = StyleValueWithCallbacks<AnimateWithSequences>,
> = {
  onDidAnimate?: OnDidAnimate<AnimateWithTransforms>;
  animate?: OrDerivedValue<Animate>;
  from?: Animate | boolean;
  exit?: AnimateWithTransforms | boolean | ((custom?: unknown) => AnimateWithTransforms);
  transition?: MotiTransitionProp<AnimateWithTransforms>;
  exitTransition?: MotiTransitionProp<AnimateWithTransforms> | ((custom?: unknown) => MotiTransition<AnimateWithTransforms>);
  delay?: number;
  // biome-ignore lint/suspicious/noExplicitAny: SharedValue/DerivedValue are invariant in T (modify is contravariant); `any` is required here so concrete SharedValue<V> satisfies this structural boundary
  state?: { __state: SharedValue<any> | DerivedValue<any> };

  stylePriority?: 'state' | 'animate';
  animateInitialState?: boolean;
};

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
  // biome-ignore lint/suspicious/noExplicitAny: SharedValue/DerivedValue are invariant in T (modify is contravariant); `any` is required so concrete SharedValue<V> satisfies this boundary
  __state: SharedValue<any> | DerivedValue<any>;
  transitionTo: (key: keyof V | ((currentState: keyof V) => keyof V)) => void;
};

export type UseAnimationStateConfig<V, FromKey extends keyof V = keyof V, ToKey extends keyof V = keyof V> = {
  from?: FromKey;
  to?: ToKey;
};

export type WithTransition = { transition?: MotiTransition };

export type DynamicStyleProp<
  AnimateType = ImageStyle & ViewStyle & TextStyle,
  AnimateWithTransforms = StyleValueWithReplacedTransforms<AnimateType>,
> = NonNullable<StyleValueWithSequenceArrays<AnimateWithTransforms>> & WithTransition;

export type UseDynamicAnimationState<Animate = FallbackAnimateProp> = {
  // biome-ignore lint/suspicious/noExplicitAny: same invariance constraint as UseAnimationState.__state
  __state: SharedValue<any>;
  current: null | DynamicStyleProp;
  animateTo: (key: DynamicStyleProp<Animate> | ((currentState: DynamicStyleProp<Animate>) => DynamicStyleProp<Animate>)) => void;
};

export type ExcludeFunctionKeys<T> = {
  // biome-ignore lint/suspicious/noExplicitAny: standard TS idiom for function detection in mapped types — unknown[] breaks due to parameter contravariance
  [K in keyof T as T[K] extends (...a: any[]) => any ? never : K]?: T[K];
};
