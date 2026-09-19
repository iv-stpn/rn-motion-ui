import { type ReactNode, useRef } from 'react';
import { View } from 'react-native';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { registerSpotlightTarget, unregisterSpotlightTarget } from './spotlight-registry';

export type SpotlightTargetProps = {
  /** Registers this element so a `<Spotlight>` step can target it by this id. */
  testID: string;
  children: ReactNode;
};

/**
 * Registers a target so a `Spotlight` step can address it by `testID`.
 *
 * Wraps its children in a plain host `View` (the thing that gets measured), so
 * the wrapper should sit where the child does. For a pixel-exact hole around an
 * element the wrapper can't cleanly wrap, prefer targeting a ref directly — a
 * `Spotlight` step accepts either.
 */
export function SpotlightTarget({ testID, children }: SpotlightTargetProps) {
  const ref = useRef<View>(null);

  // Registration is mount-only — `testID` is the stable id a `<Spotlight>` step
  // addresses, and the measure closure reads `ref.current` lazily on every call.
  useMountEffect(() => {
    registerSpotlightTarget(testID, (onRect) => {
      const node = ref.current;
      if (!node) return;
      node.measureInWindow((x, y, width, height) => onRect({ x, y, width, height }));
    });
    return () => unregisterSpotlightTarget(testID);
  });

  return (
    <View ref={ref} collapsable={false} testID={testID}>
      {children}
    </View>
  );
}
