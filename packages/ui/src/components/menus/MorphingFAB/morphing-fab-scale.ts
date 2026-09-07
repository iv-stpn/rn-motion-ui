// The MorphingFAB's collapsed trigger geometry — the only part of the FAB that
// must track a button size. The collapsed trigger is an `lg` IconButton, so the
// shell's resting footprint is `ICON_BUTTON_LG_SIZE` — the shared interactive
// ramp's `lg` height — and its radius is half that box (a pill). Kept here as
// pure data so the parity tests can pin the FAB to the button family, and so the
// shell's animation can read the same numbers the box classes resolve to.
//
// Data only, no React.

import { ICON_BUTTON_LG_SIZE } from '../../buttons/IconButton/icon-button-scale';

export const TRIGGER_SIZE = ICON_BUTTON_LG_SIZE;
/** The collapsed trigger is a circle, so its radius is half the box — whatever
 *  the shared interactive ramp puts an `lg` IconButton at. */
export const TRIGGER_RADIUS = TRIGGER_SIZE / 2;
