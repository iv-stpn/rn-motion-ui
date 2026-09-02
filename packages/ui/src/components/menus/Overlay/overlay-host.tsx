import { Fragment, type ReactNode, useCallback, useEffect, useId, useSyncExternalStore } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { measure, runOnJS, runOnUI, useAnimatedRef } from 'react-native-reanimated';
import { overlayHostPageX, overlayHostPageY, setOverlayHostWindowPosition } from './overlay-host-position';

/**
 * A layered, single-host portal for the HoldMenu overlay content (its backdrop
 * + menu + twins) on Android.
 *
 * Android's target-based blur cannot render its `BlurView` inside the very
 * `BlurTarget` it frosts — the peer's `RenderNodeBlurController` records the
 * target's `RenderNode` into its own blur node, and a `BlurView` that is a
 * descendant of the target makes that graph cycle (HWUI
 * `RenderNode::prepareTreeImpl` stack-overflows). It ALSO cannot sit *behind*
 * the overlay while the overlay lives inside the target: the blur draws a
 * blurred copy of the whole target — overlay included — so it would frost the
 * menu it is meant to sit under.
 *
 * The fix is to move the overlay itself OUT of the target. `BlurProvider`
 * renders an `<OverlayHost />` as a SIBLING of its `BlurTarget`; HoldMenu
 * renders its backdrop/menu through `<OverlayPortal layer="menu">` and each
 * `HoldItem` renders its twin through `<OverlayPortal layer="twin">`. The blur
 * then captures only the page (the overlay is outside the target) and the
 * overlay paints after the blur, crisp on top.
 *
 * Layers order the host's children regardless of registration order (a twin is
 * registered by a `HoldItem` deep in the tree, before the provider's
 * backdrop/menu, yet must paint above the menu). The host setter is carried by
 * a module-level store (not React context) because the overlay pieces live deep
 * in the tree, often inside their own `Portal`/`Modal`, where a context-provided
 * host would be shadowed by a nearer provider.
 *
 * NOT the same as `./overlay-portal` — that file's `OverlayPortal` injects
 * arbitrary content into the nearest OPEN overlay's outlet; this one teleports
 * HoldMenu's own overlay out of the `BlurTarget`. Internal to the package — not
 * exported.
 */

/** Stacking layer. Lower renders first (bottom), higher renders last (top). */
type OverlayLayer = 'menu' | 'twin';

const LAYER_ORDER: Record<OverlayLayer, number> = { menu: 0, twin: 1 };

type OverlayEntry = { id: string; layer: OverlayLayer; node: ReactNode };

/** Kept sorted by `LAYER_ORDER` so `getEntries` returns a stable, ordered snapshot. */
let entries: OverlayEntry[] = [];
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getEntries(): OverlayEntry[] {
  return entries;
}

function emit() {
  for (const cb of listeners) cb();
}

type OverlayPortalProps = { layer: OverlayLayer; children: ReactNode };

/**
 * Rendered by `BlurProvider` OUTSIDE its `BlurTarget`. Fills its parent and
 * renders the overlay pieces in layer order. `pointerEvents="box-none"` so the
 * host itself never intercepts a touch — the backdrop and menu manage their own
 * hit-testing (the backdrop catches outside taps, the menu is interactive).
 */
export function OverlayHost() {
  const current = useSyncExternalStore(subscribe, getEntries);
  const hostRef = useAnimatedRef<Animated.View>();

  // Measure this host's own window offset so the teleported pieces (whose
  // containing block is this host, not the provider root) can convert their
  // root-space coords back into host space. `measure` runs on the UI thread in
  // the same coordinate system the activation worklet uses for the root/item,
  // so the offsets match exactly; `onLayout` re-fires on rotation so the stored
  // offset stays current. The same `measure` result is mirrored into the JS
  // store the Morphing* teleport reads — via `runOnJS`, because `useAnimatedRef`
  // has no JS-thread `.current` to call `measureInWindow` on.
  const measureOffset = useCallback(() => {
    runOnUI(() => {
      const m = measure(hostRef);
      if (m) {
        overlayHostPageX.value = m.pageX;
        overlayHostPageY.value = m.pageY;
        runOnJS(setOverlayHostWindowPosition)({ x: m.pageX, y: m.pageY });
      }
    })();
  }, [hostRef]);

  // Always mounted — even with no entries — so the window offset is measured at
  // app start and a teleported Morphing* overlay reads a correct host position
  // on its first open instead of one frame at {0, 0}. Empty, `box-none` and
  // touch-transparent, so it costs nothing when no overlay is open.
  return (
    <Animated.View ref={hostRef} onLayout={measureOffset} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {current.map((entry) => (
        <Fragment key={entry.id}>{entry.node}</Fragment>
      ))}
    </Animated.View>
  );
}

/** Teleports `children` into the `OverlayHost`, at `layer`'s stacking position. */
export function OverlayPortal({ layer, children }: OverlayPortalProps) {
  const id = useId();

  // biome-ignore lint/plugin: pushing ReactNode into an external store is the portal's job — no derived-state or event-handler form exists
  useEffect(() => {
    const order = LAYER_ORDER[layer];
    const insertAt = entries.findIndex((e) => LAYER_ORDER[e.layer] > order);
    const entry = { id, layer, node: children };
    entries = insertAt === -1 ? [...entries, entry] : [...entries.slice(0, insertAt), entry, ...entries.slice(insertAt)];
    emit();
    return () => {
      entries = entries.filter((e) => e.id !== id);
      emit();
    };
  }, [id, layer, children]);

  return null;
}
