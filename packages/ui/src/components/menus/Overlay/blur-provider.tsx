import type { ReactNode } from 'react';
import { BlurTargetContext } from './blur-context';

/**
 * `BlurProvider` — wrap the app root so the overlay scrims' backdrop blur can
 * reach the content behind them.
 *
 * On **Android**, `@danielsaraldi/react-native-blur-view` does not blur whatever
 * sits *behind* a `BlurView` the way a `UIVisualEffectView` (iOS) or a CSS
 * `backdrop-filter` (web) does — it blurs a `<BlurTarget>` that wraps the
 * content you point it at. `BlurProvider` renders that `BlurTarget` around its
 * children and publishes a ref to it, which the `OverlayBlur` scrims read to
 * frost the page behind them.
 *
 * On **iOS** and **web** the blur is a true backdrop (no target needed), so this
 * twin is a passthrough that supplies a null ref. It exists only so a consumer
 * can write the same `<BlurProvider>` on every platform.
 *
 * ```tsx
 * import { BlurProvider } from 'rn-motion-ui/blur-provider';
 *
 * export default function App() {
 *   return (
 *     <BlurProvider>
 *       <AppContent />
 *     </BlurProvider>
 *   );
 * }
 * ```
 *
 * When the optional peer `@danielsaraldi/react-native-blur-view` is not
 * installed, Android scrims degrade to the plain translucent dim (the pre-blur
 * rendering) exactly as they did before.
 */
export type BlurProviderProps = { children: ReactNode };

export function BlurProvider({ children }: BlurProviderProps) {
  return <BlurTargetContext.Provider value={{ blurTargetRef: null }}>{children}</BlurTargetContext.Provider>;
}
