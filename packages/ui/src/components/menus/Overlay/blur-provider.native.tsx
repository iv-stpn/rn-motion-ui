import { type ForwardRefExoticComponent, type ReactNode, type RefAttributes, useRef } from 'react';
import { Platform, requireNativeComponent, type View } from 'react-native';
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
 * True on the new architecture (Fabric). Prefer `RN$Bridgeless`, which the
 * native runtime installs eagerly before the bundle's module scope runs; the
 * Fabric binding `nativeFabricUIManager` is defined lazily and can still be
 * `undefined` when this module loads in embedded-JS release builds (see RN's
 * `FabricUIManager.js:140`). The binding is kept as a fallback for RN 0.76–0.79,
 * where bridged+Fabric was possible and the binding is installed eagerly with
 * the bridge. `Reflect.get` keeps the off-type globals off the type system,
 * matching `web-document.ts`.
 */
function isNewArchitecture(): boolean {
  return Reflect.get(globalThis, 'RN$Bridgeless') === true || Boolean(Reflect.get(globalThis, 'nativeFabricUIManager'));
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
  if (isNewArchitecture()) return null;
  try {
    // Optional peer dep — Android backdrop blur; consumers without it get the dim scrim.
    // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
    // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
    const mod = require('@danielsaraldi/react-native-blur-view') as { BlurTarget?: BlurTargetComponent };
    if (!mod.BlurTarget) return null;
    // Same installed-but-unlinked gap as `overlay-blur`: the peer auto-installs
    // under Bun/pnpm/yarn-berry while autolinking never registers its native
    // view. The peer exposes `BlurTarget` as a native `TargetView`.
    requireNativeComponent('TargetView');
    return mod.BlurTarget;
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
