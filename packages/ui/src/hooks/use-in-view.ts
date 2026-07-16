import { useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';

/**
 * React Native equivalent of framer-motion's useInView.
 * RN has no IntersectionObserver; content is treated as visible once mounted.
 * Returns a ref to attach to the observed View and a boolean visibility flag.
 */
export function useInView(options: { once?: boolean; amount?: number } = {}): [React.RefObject<View | null>, boolean] {
  const ref = useRef<View | null>(null);
  const { once = false } = options;
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // RN doesn't have IntersectionObserver; mounted content is considered visible.
    setInView(true);

    if (once) return () => {};
    return () => {};
  }, [once]);

  return [ref, inView];
}
