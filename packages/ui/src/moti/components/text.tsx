import { Text as ThemedText } from '../../components/typography/Text/text';
import motify from '../core/motify';

/**
 * Animated `<Text>` — animates text style properties (color, fontSize,
 * fontWeight, letterSpacing, etc.) via the Moti animation API.
 *
 * Accepts all `Text` props plus `animate`, `from`, `exit`, `transition`,
 * and the rest of the {@link motify} prop surface.
 */
export const Text = motify(ThemedText)();
export { Text as MotiText };
