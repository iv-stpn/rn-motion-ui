import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { getOutletDepth, getTopOutletSetter, pushOutlet, subscribeOutletStack } from './overlay-portal-store';

const IS_ANDROID = Platform.OS === 'android';

const FILL = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    // The outlet must draw above every overlay panel it portals into. BottomSheet's
    // panel carries Android `elevation: 24` — the only hard elevation in the overlay
    // set — so the outlet clears it to keep injected content (e.g. a portaled
    // button) from slipping below the sheet. No-op on iOS, where `zIndex`/document
    // order already puts the last sibling on top.
    ...(IS_ANDROID ? { elevation: 25 } : null),
  },
});

// Prop type lives above all exports so `useExportsLast` is not triggered.
type OverlayPortalProps = { children: ReactNode };

// ─── Outlet ───────────────────────────────────────────────────────────────────

/**
 * The touch-transparent layer placed inside every overlay's `Modal` window.
 *
 * Overlays mount this automatically as their last child — app code should not
 * render it directly. The layer sits above the overlay panel (it is the last
 * sibling inside the window) and outside the overlay's `role="dialog"` /
 * `accessibilityViewIsModal` node so it does not interfere with the focus trap.
 *
 * Accessibility note: content injected here is outside the modal's a11y
 * containment, so it will not be announced as part of the dialog. For
 * announcement-critical UI additionally call
 * `AccessibilityInfo.announceForAccessibility` from the injecting component.
 */
export function OverlayOutlet() {
  const [content, setContent] = useState<ReactNode>(null);

  // Register the setter while this View is mounted; the cleanup returned by
  // pushOutlet clears content and pops the entry so a transitioning
  // OverlayPortal never leaves a stale node in a closing window.
  useMountEffect(() => pushOutlet(setContent));

  if (content === null) return null;

  return (
    <View
      style={FILL.layer}
      pointerEvents="box-none"
      // Not a focusable container — each injected node carries its own role.
      importantForAccessibility="no"
    >
      {content}
    </View>
  );
}

// ─── Portal ───────────────────────────────────────────────────────────────────

/**
 * Renders `children` into the nearest open overlay's outlet, or **in place**
 * when no overlay is open.
 *
 * Mount it once at the root and forget about it — it re-targets automatically
 * as overlays open and close, including nested overlays (topmost outlet wins).
 *
 * ```tsx
 * // At app root — works on both platforms, no branching needed on Android.
 * function ToasterWrapper({ children }: { children: ReactNode }) {
 *   return Platform.OS === 'ios'
 *     ? <FullWindowOverlay>{children}</FullWindowOverlay>
 *     : <OverlayPortal>{children}</OverlayPortal>;
 * }
 * ```
 *
 * **State preservation:** moving between outlets causes React to remount the
 * subject (the outlet Views live at different positions in the tree). For a
 * toaster whose state lives in an external store this is harmless. Components
 * with internal state (a `<Video>`, a controlled `<Input>`) will lose that
 * state on each re-target; keep such state in a parent or an external store.
 *
 * **Transition gap:** there is one render between "the top outlet changes" and
 * "the effect pushes children into the new outlet". During that render the
 * children are in neither place — at 60 fps this is imperceptible for a toast.
 *
 * **Exit animations:** injected content unmounts with its outlet when the
 * overlay fully closes (after its own exit animation). If the injected content
 * has its own exit animation it may be cut short; keep exit durations shorter
 * than the overlay's, or drive them from an external signal.
 */
export function OverlayPortal({ children }: OverlayPortalProps): ReactNode {
  const topSetter = useSyncExternalStore(subscribeOutletStack, getTopOutletSetter);

  // Sync children into the current top outlet whenever it or the children
  // change. The cleanup clears content so a newly-topmost outlet doesn't
  // briefly show the previous entry's residue.
  // biome-ignore lint/plugin: syncing ReactNode children into an external-store setter is an intentional imperative side-effect — no derived-state or event-handler form exists
  useEffect(() => {
    if (!topSetter) return;
    topSetter(children);
    return () => {
      // The outlet may already be unmounted (overlay closed between cleanup and
      // the next effect), but calling its setState is harmless — React silently
      // discards state updates on unmounted components.
      topSetter(null);
    };
  }, [topSetter, children]);

  // No outlet → render in place so the content is always visible regardless of
  // whether any overlay happens to be open.
  if (!topSetter) return children;

  // Outlet is open → nothing at this render site; the effect above populates
  // the outlet View that lives inside the overlay's window.
  return null;
}

// ─── Outlet presence hook ─────────────────────────────────────────────────────

/**
 * `true` when at least one overlay outlet is currently mounted (i.e. an
 * overlay is open). Use this to suppress a duplicate app-window rendering of
 * content that is also injected via `OverlayPortal` — on wide screens where
 * the overlay doesn't cover the whole window both copies would be visible.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: hook co-located with its outlet components — OverlayOutlet, OverlayPortal, and useHasOverlayOutlet form a single cohesive API
export function useHasOverlayOutlet(): boolean {
  return useSyncExternalStore(subscribeOutletStack, getOutletDepth) > 0;
}
