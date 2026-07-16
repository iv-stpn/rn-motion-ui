import { useState } from 'react';

/**
 * On touch-only devices (phones, tablets) there is no hover. On RN this is
 * always false; on react-native-web a pointer-capable environment could flip
 * it, but we default to touch semantics so hover is purely an enhancement.
 */
export function useHoverCapable(): boolean {
  const [canHover] = useState(false);
  return canHover;
}
