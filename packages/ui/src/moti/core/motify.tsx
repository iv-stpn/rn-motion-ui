import { type ComponentType, forwardRef, type ReactNode, useContext } from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  type BaseAnimationBuilder,
  type EntryExitAnimationFunction,
  type Keyframe,
  type LayoutAnimationFunction,
} from 'react-native-reanimated';

import { PresenceContext, usePresenceContext } from '../presence/animate-presence-context';
import type { MotiProps } from './types';
import { useMotify } from './use-motify';

type AnimatedProps<Props> = {
  animatedProps?: Partial<Props>;
  layout?: BaseAnimationBuilder | LayoutAnimationFunction | typeof BaseAnimationBuilder;
  entering?: BaseAnimationBuilder | typeof BaseAnimationBuilder | EntryExitAnimationFunction | typeof Keyframe;
  exiting?: BaseAnimationBuilder | typeof BaseAnimationBuilder | EntryExitAnimationFunction | typeof Keyframe;
};

/**
 * Wraps any React Native component with declarative Reanimated animation support.
 *
 * `motify` is the engine behind every `Moti*` component (`MotiView`, `MotiText`,
 * `MotiImage`, etc.). It returns a **thunk** so each consumer can hold its own
 * `Animated.createAnimatedComponent` reference — call it once and store the
 * result, or call it inline (the pattern used by the built-in wrappers).
 *
 * ## Props added by the wrapper
 *
 * The returned component accepts the original component's props plus:
 *
 * | Prop | Description |
 * |---|---|
 * | `animate` | Target style values. Changes trigger an animation. |
 * | `from` | Initial style values applied before the first mount (or `false` to skip). |
 * | `exit` | Style values applied when the component leaves an `<AnimatePresence>`. |
 * | `transition` | Per-style-key animation config (spring, timing, decay, delay, repeat). |
 * | `exitTransition` | Transition override used only during the exit phase. |
 * | `state` | External `useAnimationState` or `useDynamicAnimation` driving the component. |
 * | `onDidAnimate` | Callback fired per-style-key when an animation completes. |
 * | `delay` | Global delay (ms) applied to every animatable property. |
 * | `stylePriority` | `"animate"` (default) or `"state"` — which source wins when both define the same key. |
 * | `animateInitialState` | When `true`, the `from` → `animate` transition fires on first mount even inside `AnimatePresence initial={false}`. |
 *
 * Also passes through Reanimated's `layout`, `entering`, `exiting`, and
 * `animatedProps` for layout-animation support.
 *
 * ## Basic usage
 *
 * ```tsx
 * import { View } from 'react-native'
 * import motify from 'rn-motion-ui/moti/motify'
 *
 * const MotiView = motify(View)()
 *
 * <MotiView
 *   from={{ opacity: 0, scale: 0.9 }}
 *   animate={{ opacity: 1, scale: 1 }}
 *   transition={{ type: 'spring', damping: 15 }}
 * />
 * ```
 *
 * @typeParam Props - The wrapped component's prop type.
 * @typeParam Ref - The ref type the component forwards.
 * @typeParam Animate - The style shape accepted by `animate`/`from`/`exit`
 *   (defaults to `ViewStyle | ImageStyle | TextStyle`).
 * @param ComponentWithoutAnimation - Any React Native component (View, Text, Image, etc.).
 * @returns A zero-argument function that, when called, returns the memoised animated
 *   `forwardRef` component with `displayName` set to `Moti.<OriginalName>`.
 */
export default function motify<Props extends object, Ref, Animate = ViewStyle | ImageStyle | TextStyle>(
  ComponentWithoutAnimation: ComponentType<Props>,
) {
  const Component = Animated.createAnimatedComponent(ComponentWithoutAnimation);

  const withAnimations = () => {
    // biome-ignore lint/suspicious/noReactForwardRef: package targets React >=18 where forwardRef is required; ref-as-prop is React 19+ only
    const Motified = forwardRef<
      Ref,
      Props & AnimatedProps<Props> & MotiProps<Animate> & { children?: ReactNode; style?: unknown }
    >(function Moti(props, ref) {
      const animated = useMotify({
        ...props,
        usePresenceValue: usePresenceContext(),
        presenceContext: useContext(PresenceContext),
      });

      const style = props.style;

      return (
        // biome-ignore lint/suspicious/noExplicitAny: animated component props and ref don't unify cleanly across RN/Reanimated generic types
        // biome-ignore lint/plugin: props/ref can't unify across RN/Reanimated generic types; the any cast above is the only bridge
        <Component {...(props as any)} style={style ? [style, animated.style] : animated.style} ref={ref as any} />
      );
    });

    Motified.displayName = `Moti.${ComponentWithoutAnimation.displayName || ComponentWithoutAnimation.name || 'NoName'}`;

    return Motified;
  };

  return withAnimations;
}
