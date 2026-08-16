import type { FlatListProps as RNFlatListProps } from 'react-native';
import { FlatList as RNFlatList } from 'react-native';
import Animated from 'react-native-reanimated';

// biome-ignore lint/plugin: createAnimatedComponent's inferred props lose the FlatList generic — the plain FlatList type is the honest public surface
const AnimatedFlatList = Animated.createAnimatedComponent(RNFlatList) as unknown as typeof RNFlatList;

/** `FlatList` props minus the throttle, which this component pins to 16. */
export type HoldMenuFlatListProps<T> = Omit<RNFlatListProps<T>, 'scrollEventThrottle'>;

/**
 * `HoldMenuFlatList` — a `FlatList` wrapped in `createAnimatedComponent`
 * with `scrollEventThrottle` pinned to 16, upstream's pattern. Items of a
 * scrollable menu list are `HoldItem`s, which measure themselves on
 * activation.
 */
export function HoldMenuFlatList<T>(props: HoldMenuFlatListProps<T>) {
  return <AnimatedFlatList {...props} scrollEventThrottle={16} />;
}
