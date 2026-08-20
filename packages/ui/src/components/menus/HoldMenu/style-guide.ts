/**
 * Local style guide for `HoldMenu` — upstream react-native-hold-menu's
 * `styleGuide.ts`, minus the module-level `dimensionWidth` / `dimensionHeight`
 * and `palette` (none of those are read by the library itself; only `spacing`
 * and `typography` drive the menu's geometry and text).
 */

/** Base spacing unit, in px — every gap and inset is a multiple of it. */
export const SPACING = 8;

/** Menu row typography, mirroring upstream's `styleGuide.typography`. */
export const TYPOGRAPHY = {
  body: {
    fontSize: 17,
    lineHeight: 20,
  },
  callout: {
    fontSize: 16,
    lineHeight: 20,
  },
  callout2: {
    fontSize: 14,
    lineHeight: 18,
  },
} as const;
