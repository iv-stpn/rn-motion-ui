import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export const HoveredContext = createContext({
  value: false,
} as SharedValue<boolean>);

export const useIsHovered = () => useContext(HoveredContext);
