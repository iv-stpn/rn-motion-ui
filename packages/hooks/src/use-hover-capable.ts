import { useState } from 'react';
import { Platform } from 'react-native';

import { useMountEffect } from './use-mount-effect';

// Minimal web-only media-query types — the hooks package tsconfig omits the DOM
// lib, so matchMedia / MediaQueryListEvent aren't declared here.
type MediaQueryChange = { matches: boolean };
type WebMediaQueryList = {
  matches: boolean;
  addEventListener: (type: 'change', listener: (event: MediaQueryChange) => void) => void;
  removeEventListener: (type: 'change', listener: (event: MediaQueryChange) => void) => void;
};

// Reach the browser matchMedia without a cast: Reflect.get returns the property
// as an untyped value, then a typeof guard narrows it to a callable (mirrors the
// WebNode guards in WheelPicker/SwipeableList).
function getHoverMediaQueryList(): WebMediaQueryList | undefined {
  if (Platform.OS !== 'web') return;
  const matchMedia = Reflect.get(globalThis, 'matchMedia');
  if (typeof matchMedia !== 'function') return;
  return matchMedia('(hover: hover) and (pointer: fine)');
}

/**
 * True only when the environment can actually hover — a fine-pointer desktop
 * browser on web. False on native and on touch-only web (phones/tablets), where
 * controls fall back to press. Used to opt into hover open/close behavior and to
 * pick an outside-dismiss strategy (transparent overlay on touch, a document
 * listener on hover so the trigger isn't covered mid-interaction).
 */
export function useHoverCapable(): boolean {
  const [canHover, setCanHover] = useState(false);

  useMountEffect(() => {
    const mql = getHoverMediaQueryList();
    if (!mql) return;
    setCanHover(mql.matches);
    const onChange = (event: MediaQueryChange) => setCanHover(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  });

  return canHover;
}
