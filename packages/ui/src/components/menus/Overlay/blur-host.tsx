import { useEffect, useId } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import {
  registerBlurHost,
  registerBlurPane,
  unregisterBlurHost,
  unregisterBlurPane,
  useActiveBlurPanes,
  useBlurHostMounted,
} from './blur-registry';
import { OverlayBlur, overlayBlurSupported } from './overlay-blur';

/**
 * Android-only machinery that puts a REAL backdrop blur behind MODAL menus.
 *
 * Why this exists: the blur peer (`react-native-liquid-glassmorphism`) blurs
 * the window it lives in — it captures its own `rootView` into a bitmap. An RN
 * `Modal` on Android is a separate Dialog WINDOW, so a blur pane rendered
 * inside the modal captures the modal's own (mostly transparent) content and
 * shows nothing of the page behind. iOS is immune (its `Modal` presents in the
 * same window layer, so the in-modal blur samples the page) and web blurs via
 * CSS in place.
 *
 * The fix is a small app-window blur host: `<OverlayBlurHost />`, mounted once
 * by the consumer at the root of their app (a full-bleed, touch-transparent
 * sibling). A modal menu in `overlay="blur"` renders `<ModalBlur />` instead of
 * an in-modal blur pane; on Android `ModalBlur` registers its presence with the
 * host instead of rendering, and the host paints one plain-blur pane
 * (`OverlayBlur`, the peer's BlurView-style recipe — NOT the liquid-glass
 * surface) per open menu in the APP window, where the capture reaches the page.
 * The modal window above stays transparent, so the frosted page shows through
 * around the panel exactly as on iOS/web.
 *
 * Degradation ladder (Android): peer present + API 31+ + host mounted → real
 * blur. Host not mounted (consumer never opted in) → `useBlurHostMounted()`
 * returns false and scrims render their dim instead (`OverlayScrim` forces the
 * dim when a requested blur cannot render). Below API 31 / peer absent →
 * `overlayBlurSupported` is false and the host renders nothing; scrims dim.
 *
 * All of this is a no-op on iOS and web: the `Platform` guards return before
 * any registry work, `ModalBlur` renders the ordinary inline `OverlayBlur`
 * there, and `OverlayBlurHost` renders `null` — consumers may mount the host
 * unconditionally.
 *
 * `OverlayBlurHost` is exported from `rn-motion-ui/overlay/blur-host`.
 * `ModalBlur` is internal to the package.
 */

/**
 * The blur layer a MODAL menu in `overlay="blur"` should render.
 *
 * - iOS / web: the ordinary inline `OverlayBlur` — the modal presents in the
 *   same window layer there (iOS) or in place (web), so the inline pane
 *   already blurs the page behind it. Render as before.
 * - Android: render nothing inline; instead register this menu instance with
 *   the app-window `OverlayBlurHost` (when one is mounted), which paints the
 *   blur where it can actually capture the page. Without a host, render
 *   nothing — the caller's dim (or `OverlayScrim`'s forced degrade dim) is the
 *   fallback.
 *
 * Mount/unmount mirrors the menu's open/close (scrims only exist while the
 * overlay is open, exit animation included), so the registry entry's lifecycle
 * IS the menu's visibility.
 */
export function ModalBlur() {
  const id = useId();
  const hostMounted = useBlurHostMounted();

  // biome-ignore lint/plugin: registering with the blur host is an external-store side effect keyed on mount/unmount — not derived state
  useEffect(() => {
    if (Platform.OS !== 'android' || !hostMounted) return;
    registerBlurPane(id);
    return () => unregisterBlurPane(id);
  }, [id, hostMounted]);

  if (Platform.OS !== 'android') return <OverlayBlur />;
  return null;
}

/**
 * App-window blur host for Android modal menus. Mount ONCE at the root of the
 * app (a full-bleed sibling of the app content, e.g. the last child of the
 * root View) to give modal menus in `overlay="blur"` a real blurred backdrop.
 *
 * Renders nothing on iOS/web, nothing on Android below API 31 or without the
 * blur peer, and nothing while no menu requests a blur — idle it is invisible
 * and touch-transparent. While a modal menu is open it paints one plain-blur
 * pane per requesting menu (absolute-fill, `pointerEvents="none"`), which the
 * transparent modal window above lets show through around the panel.
 */
export function OverlayBlurHost() {
  const panes = useActiveBlurPanes();

  // biome-ignore lint/plugin: host presence is an external-store side effect keyed on mount/unmount — not derived state
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    registerBlurHost();
    return () => unregisterBlurHost();
  }, []);

  if (Platform.OS !== 'android') return null;
  if (!overlayBlurSupported) return null;
  if (panes.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* The plain-blur recipe (rim/specular/thickness off) — a BlurView-style
          backdrop, not a liquid-glass surface. Each pane fades its own opacity
          in/out in step with its menu. */}
      <AnimatePresence>
        {panes.map((id) => (
          <OverlayBlur key={id} />
        ))}
      </AnimatePresence>
    </View>
  );
}
