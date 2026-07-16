import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * React Native equivalent of framer-motion's useReducedMotion.
 * Returns true when the user has requested reduced motion / accessibility.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof AccessibilityInfo !== 'undefined') {
      AccessibilityInfo.isReduceMotionEnabled?.()
        .then(setReduced)
        .catch(() => {});

      const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled: boolean) =>
        setReduced(enabled),
      );
      return () => subscription?.remove();
    }
    return undefined;
  }, []);

  return reduced;
}
