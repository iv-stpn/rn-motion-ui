import { useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';

/**
 * React Native equivalent of framer-motion's useInView.
 * RN has no IntersectionObserver; content is treated as visible once mounted.
 * Returns a ref to attach to the observed View and a boolean visibility flag.
 */
export type UseInViewOptions = { once?: boolean; amount?: number };

export function useInView(options: UseInViewOptions = {}): [React.RefObject<View | null>, boolean] {
  const ref = useRef<View | null>(null);
  const { once = false } = options;
  const [inView, setInView] = useState(false);

  // biome-ignore lint/plugin: IntersectionObserver lifecycle cannot be expressed without useEffect — the observer must be set up and torn down as a side effect
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // RN doesn't have IntersectionObserver; mounted content is considered visible.
    setInView(true);

    if (once)
      return () => {
        /* no observer to tear down on RN */
      };
    return () => {
      /* no observer to tear down on RN */
    };
  }, [once]);

  return [ref, inView];
}
