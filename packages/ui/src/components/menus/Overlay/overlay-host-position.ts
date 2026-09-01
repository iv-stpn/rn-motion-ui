import { makeMutable } from 'react-native-reanimated';

/**
 * The `OverlayHost`'s own window offset, measured once it lays out and
 * re-measured on every layout (rotation, a header appearing above the
 * provider). Written by `overlay-host.tsx`, read by the teleported HoldMenu
 * menu and twins.
 *
 * The teleported pieces compute their `top`/`left` in the provider root's
 * coordinate space (item page coords minus the root's page offset). Their
 * containing block is the `OverlayHost` — a sibling of the `BlurTarget`, whose
 * origin is the `BlurProvider`'s parent rather than the window whenever that
 * parent is inset (storybook's chrome, a nested screen). Converting root space
 * back into host space is therefore `rootPageY - overlayHostPageY`, not
 * `rootPageY` alone: adding the root's window offset lands the pieces `hostPageY`
 * too low. Module-level so the overlay content — rendered outside the provider's
 * React tree — can reach it without a context.
 */
export const overlayHostPageX = makeMutable(0);
export const overlayHostPageY = makeMutable(0);
