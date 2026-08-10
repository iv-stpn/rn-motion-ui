import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

/** Context that exposes the nearest `<Hoverable>`'s hover shared value. */
export const HoveredContext = createContext(
  // biome-ignore lint/plugin: no valid SharedValue literal exists for a default; the real value is always supplied by the provider
  { value: false } as SharedValue<boolean>,
);

/**
 * Returns the nearest `<Hoverable>`'s hover shared value.
 *
 * `useMotiHover` is the preferred alias — both names resolve to the same function.
 */
export const useIsHovered = () => useContext(HoveredContext);
export { useIsHovered as useMotiHover };
