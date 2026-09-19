// biome-ignore-all lint/style/useExportsLast: the public measure type heads the module so the registry helpers below read against it
import type { SpotlightRect } from './spotlight-layout';

/**
 * spotlight-registry — the module-level map a `SpotlightTarget` registers into
 * and a `Spotlight` step looks up by testID.
 *
 * A target is registered as a measure function (so the wrapper can re-bind to a
 * fresh ref on every render without the registry knowing about refs). It is
 * cleared on unmount, so a step pointing at a missing target simply measures
 * nothing.
 */

/** Measures a target and invokes `onRect` with its window-space rect. */
export type SpotlightMeasure = (onRect: (rect: SpotlightRect) => void) => void;

const targets = new Map<string, SpotlightMeasure>();

export function registerSpotlightTarget(id: string, measure: SpotlightMeasure): void {
  targets.set(id, measure);
}

export function unregisterSpotlightTarget(id: string): void {
  targets.delete(id);
}

export function getSpotlightTarget(id: string): SpotlightMeasure | undefined {
  return targets.get(id);
}
