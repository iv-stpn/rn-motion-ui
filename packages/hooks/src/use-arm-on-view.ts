import { useEffect, useState } from 'react';

/**
 * Returns `true` once `inView` becomes true (when `startOnView` is enabled),
 * and stays `true` permanently afterward so live updates animate immediately.
 *
 * When `startOnView` is false the hook starts already armed.
 */
export function useArmOnView(startOnView: boolean, inView: boolean): boolean {
  const [armed, setArmed] = useState(!startOnView);

  // biome-ignore lint/plugin: arming on viewport entry is a genuine side-effect — the state update must happen in response to `inView` changing, not during render
  useEffect(() => {
    if (startOnView && inView) setArmed(true);
  }, [startOnView, inView]);

  return armed;
}
