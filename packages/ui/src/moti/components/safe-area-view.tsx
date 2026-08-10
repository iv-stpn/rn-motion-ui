import { SafeAreaView as RSafeAreaView } from 'react-native';
import motify from '../core/motify';

/**
 * Animated `<SafeAreaView>` — respects safe-area insets and accepts the
 * full Moti animation API (`animate`, `from`, `exit`, `transition`, etc.).
 */
export const SafeAreaView = motify(RSafeAreaView)();
export { SafeAreaView as MotiSafeAreaView };
