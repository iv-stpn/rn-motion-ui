import { useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';

// Web-only globals absent from the react-native tsconfig but present at
// runtime on react-native-web. Declared locally — adding `"dom"` to the
// package tsconfig would conflict with react-native's own type definitions.
type IOEntry = { readonly isIntersecting: boolean };
type IOCallback = (entries: readonly IOEntry[]) => void;
type IOOptions = { readonly threshold?: number };
type IOInstance = { observe: (target: object) => void; disconnect: () => void };
declare const IntersectionObserver: { new (callback: IOCallback, options?: IOOptions): IOInstance } | undefined;

/** True when `value` is a DOM node — i.e. we are running on react-native-web. */
function isDomNode(value: unknown): value is object {
  return typeof value === 'object' && value !== null && Object.hasOwn(value, 'nodeType');
}

/**
 * React Native equivalent of framer-motion's useInView.
 * On web (react-native-web) IntersectionObserver is used when available,
 * so ScrollReveal and use-arm-on-view genuinely wait for the element to scroll
 * into view. On native, mounted content is treated as visible (no scroll
 * measurement yet — upgrade to scroll-position measurement later if needed).
 * Returns a ref to attach to the observed View and a boolean visibility flag.
 */
export type UseInViewOptions = {
  /** Trigger only once; stop observing after the element first enters view. */
  once?: boolean;
  /**
   * Fraction of the element that must be visible before `inView` flips to
   * `true` (maps to IO `threshold`). `0` means any pixel, `1` means fully
   * visible. Defaults to `0`.
   */
  amount?: number;
};

export function useInView(options: UseInViewOptions = {}): [React.RefObject<View | null>, boolean] {
  const ref = useRef<View | null>(null);
  const { once = false, amount = 0 } = options;
  const [inView, setInView] = useState(false);

  // biome-ignore lint/plugin: IntersectionObserver lifecycle cannot be expressed without useEffect — the observer must be set up and torn down as a side effect
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Web path: react-native-web renders View as an HTMLElement (a DOM node).
    // Use IntersectionObserver so scroll-triggered animations only fire after
    // the element actually enters the viewport.
    if (typeof IntersectionObserver !== 'undefined' && isDomNode(el)) {
      const onIntersect = (entries: ReadonlyArray<{ readonly isIntersecting: boolean }>) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) setInView(false);
      };
      const observer = new IntersectionObserver(onIntersect, { threshold: amount });
      observer.observe(el);
      return () => observer.disconnect();
    }

    // Native fallback: no IntersectionObserver — treat mounted as visible.
    setInView(true);
  }, [once, amount]);

  return [ref, inView];
}
