import { ScrollView as RScrollView } from 'react-native';
import motify from '../core/motify';

/**
 * Animated `<ScrollView>` — accepts all `ScrollView` props plus the full
 * Moti animation API (`animate`, `from`, `exit`, `transition`, etc.).
 *
 * Note: animating a `ScrollView` itself (rather than its children) is
 * unusual. Most use cases are better served by a `MotiView` wrapping the
 * scroll content.
 */
export const ScrollView = motify(RScrollView)();
export { ScrollView as MotiScrollView };
