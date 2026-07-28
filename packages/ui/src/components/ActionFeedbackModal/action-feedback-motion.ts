import { EASE_OUT } from '../../lib/ease';

// The morph timings live together because they are calibrated against each
// other: the vessel resizes over 300ms while the glyph inside cross-fades over
// 240ms and the text under it over 180ms, so each layer settles before the one
// above it. Split across files they would drift apart.

export const MORPH_CONTAINER_TRANSITION = { type: 'timing', duration: 300, easing: EASE_OUT } as const;
export const MORPH_GLYPH_TRANSITION = { type: 'timing', duration: 240, easing: EASE_OUT } as const;
export const MORPH_SPINNER_TRANSITION = { type: 'timing', duration: 180, easing: EASE_OUT } as const;
export const MORPH_CONTENT_TRANSITION = { type: 'timing', duration: 180, easing: EASE_OUT } as const;

/** Fallback for every morph transition under reduced-motion — short and linear. */
export const RM_TRANSITION = { type: 'timing', duration: 160 } as const;
