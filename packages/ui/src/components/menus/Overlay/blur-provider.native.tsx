import { type ForwardRefExoticComponent, type ReactNode, type RefAttributes, useRef } from 'react';
import { Platform, type View } from 'react-native';
import { BlurTargetContext, type BlurTargetRef } from './blur-context';
import { OverlayHost } from './overlay-host';

/**
 * NATIVE twin of `./blur-provider`. See that module's doc for the public
 * contract; this file carries the Android implementation.
 *
 * On Android it wraps `children` in the optional peer's `BlurTarget` (a native
 * view the `BlurView` scrims reference to frost the content) and publishes a ref
 * to it through `BlurTargetContext`. On iOS there is no target — the peer's
 * `BlurView` is a `UIVisualEffectView` that blurs what sits behind it — so the
 * provider is a passthrough with a null ref.
 *
 * The peer is resolved with a guarded dynamic `require` (like `overlay-blur`
 * resolves `BlurView`), so a consumer that never installed the optional peer
 * still renders — the provider degrades to the passthrough and Android scrims
 * fall back to the plain translucent dim.
 */

/** The minimal `BlurTarget` surface this module touches. */
type BlurTargetProps = { children?: ReactNode; style?: unknown };
type BlurTargetComponent = ForwardRefExoticComponent<BlurTargetProps & RefAttributes<View>>;

/**
 * True on the new architecture (Fabric). RN installs `nativeFabricUIManager` on
 * the global object under Fabric and never under the legacy arch (see RN's
 * `FabricUIManager.js`); `Reflect.get` keeps the off-type global off the type
 * system, matching `web-document.ts`.
 */
function isFabric(): boolean {
  return Boolean(Reflect.get(globalThis, 'nativeFabricUIManager'));
}

/**
 * Resolves the peer's `BlurTarget` on Android, `null` elsewhere, on Fabric, or
 * when the peer is absent.
 */
function resolveBlurTarget(): BlurTargetComponent | null {
  if (Platform.OS !== 'android') return null;
  // On Fabric the peer's `TargetView` redirects every child into an inner view
  // whose `onLayout`/`requestLayout` are old-arch no-ops, so the children are
  // never measured/positioned and the whole app collapses to a white screen.
  // Skip the target there — Android scrims degrade to the plain translucent dim.
  if (isFabric()) return null;
  try {
    // Optional peer dep — Android backdrop blur; consumers without it get the dim scrim.
    // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
    // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
    const mod = require('@danielsaraldi/react-native-blur-view') as { BlurTarget?: BlurTargetComponent };
    return mod.BlurTarget ?? null;
  } catch {
    return null;
  }
}

const BlurTarget = resolveBlurTarget();

export type BlurProviderProps = { children: ReactNode };

export function BlurProvider({ children }: BlurProviderProps) {
  // The ref must outlive every scrim open/close, so it lives on the provider —
  // the one component mounted for the app's whole lifetime.
  const blurTargetRef = useRef<View | null>(null);

  if (!BlurTarget) return <BlurTargetContext.Provider value={{ blurTargetRef: null }}>{children}</BlurTargetContext.Provider>;

  const value: { blurTargetRef: BlurTargetRef } = { blurTargetRef };

  return (
    <BlurTargetContext.Provider value={value}>
      {/* The overlay host is a SIBLING of the BlurTarget, never a child of it:
          inline overlay content (HoldMenu's backdrop/menu/twins, the Morphing*
          scrims) renders here (see `overlay-host`), outside the target it
          blurs — so the Android RenderNode graph stays acyclic AND the overlay
          paints after the blur, crisp instead of frosted. */}
      <BlurTarget ref={blurTargetRef}>{children}</BlurTarget>
      <OverlayHost />
    </BlurTargetContext.Provider>
  );
}
