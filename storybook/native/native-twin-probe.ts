/**
 * Resolution probe for the release guard.
 *
 * A platform twin is only reachable through the package's `exports` map when the
 * consumer imports its **subpath by name** — `rn-motion-ui/toaster`, not
 * `./toaster`. Metro applies its `.native` platform substitution to the latter
 * (an extensionless relative specifier) but *not* to the former: the map has
 * already resolved to a concrete filename by the time Metro sees it, so a
 * subpath missing its `react-native` condition silently bundles the web twin.
 * That is exactly how 7.10.1–7.11.1 shipped `./toaster` broken.
 *
 * Every story in this app imports its twin relatively, so the storybook's own
 * bundle never exercises the map and a guard over it would pass on a broken
 * release. This module closes that hole by importing each twin-bearing subpath
 * by name, which puts the *resolution decision* — and therefore the resolved
 * twin's path — into the bundle and its source map.
 *
 * `scripts/check-native-bundle.mjs` reads those paths back and asserts each one
 * is the native twin. It derives the subpath list from `packages/ui`'s exports
 * map, so a new twin with no entry here fails the guard rather than slipping
 * through unprobed.
 *
 * Nothing here renders; the app only needs the imports to be resolved.
 */

import { Hoverable } from 'rn-motion-ui/moti/hover';
import { BlurProvider } from 'rn-motion-ui/overlay/blur-provider';
import { Surface } from 'rn-motion-ui/surface';
import { Toaster, toast } from 'rn-motion-ui/toaster';

const PROBED = { BlurProvider, Hoverable, Surface, Toaster, toast };

if (Object.values(PROBED).some((value) => value === undefined))
  throw new Error('native-twin-probe: a platform-twin subpath resolved to nothing');

/** Every probed subpath, so the imports above cannot be dropped as unused. */
export const NATIVE_TWIN_PROBE = PROBED;
