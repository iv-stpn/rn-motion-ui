import { Text as RText } from 'react-native';
import motify from '../core/motify';

/**
 * Animated `<Text>` — animates text style properties (color, fontSize,
 * fontWeight, letterSpacing, etc.) via the Moti animation API.
 *
 * Accepts all `Text` props plus `animate`, `from`, `exit`, `transition`,
 * and the rest of the {@link motify} prop surface.
 */
export const Text = motify(RText)();
export { Text as MotiText };
