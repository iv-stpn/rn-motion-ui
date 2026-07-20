import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export const HoveredContext = createContext(
  // biome-ignore lint/plugin: no valid SharedValue literal exists for a default; the real value is always supplied by the provider
  { value: false } as SharedValue<boolean>,
);

export const useIsHovered = () => useContext(HoveredContext);
export { useIsHovered as useMotiHover };
