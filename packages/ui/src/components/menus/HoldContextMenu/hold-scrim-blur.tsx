/**
 * Web twin of the hold-menu scrim blur.
 *
 * Web is a dropdown (see `HOLD_MENU_LIFTS`): nothing lifts and the scrim stays
 * invisible, with `backdrop-blur-xs` supplying the blur half of upstream's
 * `BlurView` when the dim does paint. There is nothing for this component to
 * render, and keeping it a no-op here — rather than letting web resolve the
 * native module — is what keeps `expo-blur` out of web bundles entirely.
 *
 * Native consumers get the real thing from `hold-scrim-blur.native.tsx`;
 * Metro picks the platform file, so this twin never runs on iOS/Android.
 */
export function HoldScrimBlur() {
  return null;
}
