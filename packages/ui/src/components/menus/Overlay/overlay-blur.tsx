// biome-ignore-all lint/style/useExportsLast: the component closes the module
/**
 * Web backdrop blur for overlay scrims — a CSS `backdrop-filter` view.
 *
 * The scrims (HoldMenu's backdrop and the modal overlays) paint a translucent
 * dim over a blur so the page behind them reads as frosted glass rather than a
 * flat wash. This is the WEB twin of `./overlay-blur` (the `.native.tsx` file
 * carries the guarded `@danielsaraldi/react-native-blur-view` require): web
 * never touches the optional peer, so the web bundle builds even when the
 * package is not installed. RNW 0.21 passes `backdropFilter` through (prefixing
 * `WebkitBackdropFilter`), so the frost is the same 12 px the native `BlurView`
 * applies.
 *
 * The layer fades its OWN `opacity` from 0→1 on mount (and back out on exit) so
 * the frost appears in step with the menu instead of popping in. The fade must
 * be on the blur element itself: an ancestor with `opacity < 1` becomes a CSS
 * "backdrop root" that clips the backdrop, so a *parent* fading in would leave
 * this child's backdrop-filter sampling an empty page and the blur would never
 * render.
 */
import { StyleSheet, type ViewStyle } from 'react-native';
import { MotiView } from '../../../moti/components/view';

/**
 * The web blur layer under an overlay scrim. Absolute-fills its parent, never
 * intercepts touches (it is purely decorative — the scrim above it is the tap
 * target), and fades its own opacity in sync with the menu's enter.
 *
 * Internal to the package — not exported.
 */
export function OverlayBlur() {
  return (
    <MotiView
      pointerEvents="none"
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'timing', duration: 200 }}
      // biome-ignore lint/plugin: RN's ViewStyle has no backdropFilter — RNW forwards the CSS property at runtime
      style={[StyleSheet.absoluteFill, { backdropFilter: 'blur(12px)' } as unknown as ViewStyle]}
    />
  );
}
