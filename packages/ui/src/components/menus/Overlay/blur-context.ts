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

/** The context value: a `BlurTarget` ref and a marker for content inside it. */
export type BlurTargetContextValue = {
  /** The Android `BlurTarget` ref, or null where none is needed. */
  blurTargetRef: BlurTargetRef | null;
  /**
   * True only for the subtree *inside* the `BlurTarget` — the content the peer
   * blurs. A `BlurView` descendant of the target it references cycles the
   * Android RenderNode graph (SIGSEGV), so frosted components read this to
   * degrade instead. False outside the target (scrims) and on iOS/web (no
   * target exists).
   */
  insideBlurTarget: boolean;
};

/**
 * Carries the Android `BlurTarget` ref from the provider at the app root to the
 * portal-mounted `OverlayBlur` scrims, which cannot reach it through the tree
 * (the scrim lives in a `Portal` / `Modal`, the target wraps the app).
 */
export const BlurTargetContext = createContext<BlurTargetContextValue>({
  blurTargetRef: null,
  insideBlurTarget: false,
});

/**
 * Reads the `BlurTarget` ref provided by an enclosing `<BlurProvider>`, or
 * `null` when there is none (or none is needed). Internal to the package.
 */
export function useBlurTargetRef(): BlurTargetRef | null {
  return useContext(BlurTargetContext).blurTargetRef;
}

/**
 * Whether the caller renders inside the `BlurTarget` (see `insideBlurTarget`).
 * Internal to the package.
 */
export function useInsideBlurTarget(): boolean {
  return useContext(BlurTargetContext).insideBlurTarget;
}
