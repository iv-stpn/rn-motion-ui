/** biome-ignore-all lint/style/useComponentExportOnlyModules: the leaf's node and its driver are one unit — the animated values are useless apart */
/** biome-ignore-all lint/style/useExportsLast: props types sit with their component */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the leaf's state, effects and node are one render layer — splitting would scatter the refs they all read */
// The drop indicator: the info outline that marks where a release would land.
//
// One absolutely-positioned element for the whole file area, painted at the over
// zone's measured rect. Before this, every folder row, tile and drag-only overlay
// drew its own `border-info` outline from a render-prop `isOver`, so each zone
// crossing mounted one indicator and unmounted another inside the row it had just
// left — and the views that built their row body inside that function re-rendered
// the whole row subtree with it. A drag sweeping a large folder churned hundreds
// of those per second.
//
// The leaf inverts that. It subscribes to the drag snapshot alone — a re-render
// that happens on drag start/end and zone crossings, which is one small component
// either way — and its geometry lives in Animated values written in an effect,
// so gliding between targets costs no render at all. The rows it outlines never
// re-render for a crossing: they have no indicator left to paint.
//
// The rect it reads is the store's own (`getZoneRect`), the same box the hit test
// resolves the winner from, so the outline can never disagree with the store
// about where a release would land.

import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { Animated, type View } from 'react-native';
import type { DragRect } from '../../../gestures/drag.types';
import { useDragScope } from '../../../gestures/drag-scope';
import { getZoneManagerPath, getZoneRect } from '../../../gestures/drag-store';
import { useDragSnapshot } from '../../../gestures/use-drag-store';
import { FS_DROP_INDICATOR_TEST_ID, FS_OVERLAY_DROPZONE_TEST_ID } from '../logic/file-system-test-id';
import { isBackgroundZone, isPortalZone } from './file-system-dropzone';

/** How the outline settles on a new target: snappy enough to track a fast sweep, soft enough to read as a glide rather than a jump. */
const SPRING_CONFIG = { damping: 30, mass: 0.6, stiffness: 400 };
/** The fade-in when the outline first appears — a spring would overshoot past opaque. */
const APPEAR_DURATION_MS = 120;

/** Whether `path` sits under `prefix` in the manager tree — the zone-owns check. */
function pathIsUnder(path: readonly string[], prefix: readonly string[]): boolean {
  if (path.length < prefix.length) return false;
  for (let index = 0; index < prefix.length; index += 1) {
    if (path[index] !== prefix[index]) return false;
  }
  return true;
}

export type FileSystemDropIndicatorProps = { containerRef: RefObject<View | null> };

/**
 * The shared drop outline, painted over the file area at the current over zone's
 * rect. A leaf on purpose: mounted once by `<FileSystemDragScope>`, it is the
 * only component that re-renders when a drag crosses a zone.
 *
 * Zone rects are window coordinates; the element is positioned in the container's
 * frame, so the container's window rect is measured once per drag (the same
 * conversion the drop hint uses) and the difference is what the values hold.
 */
export function FileSystemDropIndicator({ containerRef }: FileSystemDropIndicatorProps) {
  const { drag, overZoneId } = useDragSnapshot();
  // This component's place in the manager tree: only zones under the same
  // manager are this instance's. The store is tree-wide, so a drag hovering a
  // second FileSystem on the same page would otherwise ghost an outline into
  // this one.
  const { managerPath } = useDragScope();
  const pos = useRef({
    height: new Animated.Value(0),
    opacity: new Animated.Value(0),
    width: new Animated.Value(0),
    x: new Animated.Value(0),
    y: new Animated.Value(0),
  }).current;

  /** The container's window frame for this drag. */
  const frameRef = useRef<DragRect | null>(null);
  /** The over zone's window rect — re-read on each crossing, applied by {@link settle}. */
  const rectRef = useRef<DragRect | null>(null);

  const settle = useCallback(() => {
    const frame = frameRef.current;
    const rect = rectRef.current;
    if (frame === null || rect === null) return;
    Animated.parallel([
      Animated.spring(pos.x, { ...SPRING_CONFIG, toValue: rect.x - frame.x, useNativeDriver: false }),
      Animated.spring(pos.y, { ...SPRING_CONFIG, toValue: rect.y - frame.y, useNativeDriver: false }),
      Animated.spring(pos.width, { ...SPRING_CONFIG, toValue: rect.width, useNativeDriver: false }),
      Animated.spring(pos.height, { ...SPRING_CONFIG, toValue: rect.height, useNativeDriver: false }),
      Animated.timing(pos.opacity, { duration: APPEAR_DURATION_MS, toValue: 1, useNativeDriver: false }),
    ]).start();
  }, [pos]);

  const hide = useCallback(() => {
    rectRef.current = null;
    pos.opacity.setValue(0);
  }, [pos]);

  // Measure the container's frame once per drag and tear the refs down at the end.
  // The frame landing after the first crossing is the reason settle reads refs:
  // whichever arrives last re-applies.
  // biome-ignore lint/plugin: measuring the container for an animated overlay is a layout side-effect, not derived render state
  useEffect(() => {
    if (drag === null) {
      frameRef.current = null;
      hide();
      return;
    }
    const node = containerRef.current;
    if (node === null) return;
    node.measureInWindow((x, y, width, height) => {
      frameRef.current = { height, width, x, y };
      settle();
    });
  }, [containerRef, drag, hide, settle]);

  // On a crossing, re-read the winner's rect and glide the outline onto it.
  // Background fallbacks (the file area's own zone, a column pane) paint their own
  // surface — delay and external-drop handling a shared outline cannot express —
  // and a zone from another FileSystem on the page is not this instance's to mark.
  // biome-ignore lint/plugin: positioning an animated overlay is a layout side-effect, not derived render state
  useEffect(() => {
    if (drag === null || overZoneId === null || isBackgroundZone(overZoneId)) {
      hide();
      return;
    }
    const zonePath = getZoneManagerPath(overZoneId);
    if (zonePath === null || !pathIsUnder(zonePath, managerPath)) {
      hide();
      return;
    }
    const rect = getZoneRect(overZoneId);
    if (rect === null) {
      // Not measured yet — a zone mid-registration. Its measure lands through the
      // store's own settle (`refreshDragzones` re-resolves and re-publishes), so
      // this effect re-runs with a rect in hand; until then, nothing to paint.
      hide();
      return;
    }
    rectRef.current = rect;
    settle();
  }, [drag, hide, managerPath, overZoneId, settle]);

  if (drag === null || overZoneId === null || isBackgroundZone(overZoneId)) return null;

  return (
    <Animated.View
      className="pointer-events-none absolute rounded-md border-2 border-info"
      pointerEvents="none"
      style={{ height: pos.height, left: pos.x, opacity: pos.opacity, top: pos.y, width: pos.width, zIndex: 40 }}
      testID={isPortalZone(overZoneId) ? FS_OVERLAY_DROPZONE_TEST_ID : FS_DROP_INDICATOR_TEST_ID}
    />
  );
}
