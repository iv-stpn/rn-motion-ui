import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useMountEffect } from './use-mount-effect';

/**
 * React Native equivalent of framer-motion's useReducedMotion.
 * Returns true when the user has requested reduced motion / accessibility.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

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
