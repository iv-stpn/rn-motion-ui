import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowDimensions, type View } from 'react-native';

export type ActionFABFrame = { x: number; y: number; width: number; height: number };

/** Measure the containing stage for bounds and Android's blur-host placement. */
export function useActionFABFrame(open: boolean) {
  const rootRef = useRef<View>(null);
  const [frame, setFrame] = useState<ActionFABFrame | null>(null);
  const sequence = useRef(0);
  const window = useWindowDimensions();
  const measureFrame = useCallback(() => {
    sequence.current += 1;
    const current = sequence.current;
    rootRef.current?.measureInWindow((x, y, width, height) => {
      if (current === sequence.current && width > 0 && height > 0) setFrame({ x, y, width, height });
    });
  }, []);
  // biome-ignore lint/plugin: native/window measurement follows layout, viewport and open changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: opening and viewport resizing intentionally refresh ancestor window offsets.
  useEffect(() => {
    measureFrame();
    return () => {
      sequence.current += 1;
    };
  }, [measureFrame, open, window.width, window.height]);
  return { rootRef, frame, measureFrame, window };
}
