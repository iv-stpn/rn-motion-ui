import { Image as RImage } from 'react-native';
import motify from '../core/motify';

/**
 * Animated `<Image>` — animates image style properties (opacity, scale,
 * border-radius, etc.) via the Moti animation API.
 *
 * Accepts all `Image` props plus `animate`, `from`, `exit`, `transition`,
 * and the rest of the {@link motify} prop surface.
 */
export const Image = motify(RImage)();
export { Image as MotiImage };
