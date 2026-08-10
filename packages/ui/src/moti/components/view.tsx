import { View as RView } from 'react-native';
import motify from '../core/motify';

/**
 * An animated `<View>` — the most common Moti primitive.
 *
 * Accepts all `View` props plus the full Moti animation API: `animate`, `from`,
 * `exit`, `transition`, `exitTransition`, `state`, `onDidAnimate`, `delay`,
 * `stylePriority`, and `animateInitialState`. Also forwards Reanimated layout
 * props (`layout`, `entering`, `exiting`, `animatedProps`).
 *
 * ```tsx
 * <MotiView
 *   from={{ opacity: 0, translateY: 20 }}
 *   animate={{ opacity: 1, translateY: 0 }}
 *   transition={{ type: 'spring', damping: 15 }}
 * />
 * ```
 */
export const View = motify(RView)();
export { View as MotiView };
