import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type { MotiPressableInteractionState } from './types';

/** Sentinel key for the nearest unnamed `<MotiPressable>` in the containers record. */
export const INTERACTION_CONTAINER_ID = '__INTERACTION_CONTAINER_ID' as const;

export type MotiPressableInteractionIds = { id: string };

/**
 * Context shape published by `<MotiPressable>`. Maps pressable `id` values (or
 * `__INTERACTION_CONTAINER_ID` for unnamed ancestors) to shared values carrying
 * `{ hovered, pressed }`.
 */
export type MotiPressableContext = {
  containers: Record<
    MotiPressableInteractionIds['id'] | typeof INTERACTION_CONTAINER_ID,
    SharedValue<MotiPressableInteractionState>
  >;
};

export const MotiPressableContext = createContext<MotiPressableContext>({
  containers: {},
});

/** Returns the nearest `<MotiPressable>`'s interaction context. */
export const useMotiPressableContext = () => useContext(MotiPressableContext);
