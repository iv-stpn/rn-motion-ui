import { useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { useMountEffect } from './use-mount-effect';

/**
 * Reads the web reduced-motion preference synchronously so the first paint
 * already respects it. `AccessibilityInfo.isReduceMotionEnabled()` is async and
 * resolves after the first frame, so a `false` initial state would animate one
 * frame at a reduced-motion user (the §1.6 gap). Native has no synchronous
 * getter, so it starts `false` and the async check corrects it — a single-frame
 * window, not an animation.
 *
 * The hooks package tsconfig omits the DOM lib, so reach the browser `matchMedia`
 * through `Reflect.get` like {@link useHoverCapable} does.
 */
function readInitialReducedMotion(): boolean {
  if (Platform.OS !== 'web') return false;
  const matchMedia = Reflect.get(globalThis, 'matchMedia');
  if (typeof matchMedia !== 'function') return false;
  const mql = matchMedia('(prefers-reduced-motion: reduce)');
  return Boolean(mql?.matches);
}

/**
 * React Native equivalent of framer-motion's useReducedMotion.
 * Returns true when the user has requested reduced motion / accessibility.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readInitialReducedMotion);

  useMountEffect(() => {
    if (typeof AccessibilityInfo !== 'undefined') {
      AccessibilityInfo.isReduceMotionEnabled()
        .then(setReduced)
        .catch(() => {
          /* ignore: reduce-motion query is best-effort */
        });

      const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => setReduced(enabled));
      return () => subscription.remove();
    }
  });

  return reduced;
}
