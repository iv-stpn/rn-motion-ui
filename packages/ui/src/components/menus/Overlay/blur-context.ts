import { createContext, type RefObject, useContext } from 'react';
import type { View } from 'react-native';

/**
 * The ref `BlurProvider` hands to `OverlayBlur` on Android — a native
 * `BlurTarget` (from `@danielsaraldi/react-native-blur-view`) that wraps the app
 * content the scrim blurs. `null` on iOS (the `UIVisualEffectView` blurs
 * whatever sits behind it, so no target exists) and on web (CSS
 * `backdrop-filter`), so callers must tolerate the absence.
 */
export type BlurTargetRef = RefObject<View | null>;

/** The context value: a `BlurTarget` ref, or null where none is needed. */
export type BlurTargetContextValue = { blurTargetRef: BlurTargetRef | null };

/**
 * Carries the Android `BlurTarget` ref from the provider at the app root to the
 * portal-mounted `OverlayBlur` scrims, which cannot reach it through the tree
 * (the scrim lives in a `Portal` / `Modal`, the target wraps the app).
 */
export const BlurTargetContext = createContext<BlurTargetContextValue>({ blurTargetRef: null });

/**
 * Reads the `BlurTarget` ref provided by an enclosing `<BlurProvider>`, or
 * `null` when there is none (or none is needed). Internal to the package.
 */
export function useBlurTargetRef(): BlurTargetRef | null {
  return useContext(BlurTargetContext).blurTargetRef;
}
