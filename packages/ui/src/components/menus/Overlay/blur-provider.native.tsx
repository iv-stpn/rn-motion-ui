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
 * Resolves the peer's `BlurTarget` on Android, `null` elsewhere or when the
 * peer is absent/not autolinked. Mounted on every architecture (Fabric
 * included): the peer (v3.0.2) ships codegen specs (`codegenConfig`) with
 * ViewManager delegates and resolves its `blurTarget` through the FABRIC
 * UIManager, so `TargetView`/`BlurView` mount and blur on Fabric as well as
 * Paper. The 2026-09-03 gate that skipped `BlurTarget` on Fabric
 * (61a606be/19f9d72b) was removed 2026-09-05 — modal/teleported blur was
 * on-device-verified on Fabric BEFORE that gate shipped (08-31/09-02 APKs)
 * and the white screens that motivated it were root-caused to storybook
 * `layout` + CSS-only dimensions instead. NO `requireNativeComponent` probe:
 * the peer is CODEGEN (its JS registers `TargetView` on import), so a second
 * registration throws "Tried to register two views with the same name" —
 * exactly when the peer is present (2026-09-05, see 9a414b4c for the same
 * trap on the glass peer). The guarded `require()` is the presence check;
 * an installed-but-unlinked peer surfaces at first render, not here. Scrims
 * that render INSIDE the target they blur (`inline`) remain degraded to the
 * dim — that crash (7eab4fe9) was tombstone-confirmed.
 */
function resolveBlurTarget(): BlurTargetComponent | null {
  if (Platform.OS !== 'android') return null;
  try {
    // Optional peer dep — Android backdrop blur; consumers without it get the dim scrim.
    // biome-ignore lint/style/noCommonJs: intentional dynamic require for optional peer dep
    // biome-ignore lint/plugin: ts/no-as-cast — dynamic require has no static type
    const mod = require('@danielsaraldi/react-native-blur-view') as { BlurTarget?: BlurTargetComponent };
    if (!mod.BlurTarget) return null;
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
