import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type { MotiPressableInteractionState } from './types';

export const INTERACTION_CONTAINER_ID = '__INTERACTION_CONTAINER_ID' as const;

export interface MotiPressableInteractionIds {
  id: string;
}

export type MotiPressableContext = {
  containers: Record<
    MotiPressableInteractionIds['id'] | typeof INTERACTION_CONTAINER_ID,
    SharedValue<MotiPressableInteractionState>
  >;
};

export const MotiPressableContext = createContext<MotiPressableContext>({
  containers: {},
});

export const useMotiPressableContext = () => useContext(MotiPressableContext);
