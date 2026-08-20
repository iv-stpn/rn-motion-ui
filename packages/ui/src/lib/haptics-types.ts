// The haptic-feedback vocabulary shared by the hold primitives, HoldMenu and the
// file-system's drag-to-select scrub.
//
// Kept in its own module so both the web and native halves of the haptics module
// (which resolve to different files per platform) can import it without a
// self-referential platform import.

/** The haptic styles a hold or selection can fire. `'None'` (or omitting the prop) disables it. */
export type HapticFeedbackVariant = 'None' | 'Selection' | 'Light' | 'Medium' | 'Heavy' | 'Success' | 'Warning' | 'Error';
