import { useState } from 'react';
import { AppState } from 'react-native';

import { useMountEffect } from './use-mount-effect';

/**
 * Whether the page/app is currently in the foreground. On web,
 * react-native-web's AppState mirrors document visibility; on native it tracks
 * the app's foreground/background state.
 *
 * Animated content swaps consult this so changes that arrive while the page is
 * hidden apply instantly: rAF is paused in background tabs, so animations
 * queued there never advance and would all replay from their initial state the
 * moment the page becomes visible again.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(AppState.currentState !== 'background');

  useMountEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setVisible(state === 'active'));
    return () => subscription.remove();
  });

  return visible;
}
