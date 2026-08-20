// biome-ignore-all lint/style/useExportsLast: the component closes the module
/**
 * Web backdrop blur for overlay scrims — a CSS `backdrop-filter` view.
 *
 * The scrims (HoldMenu's backdrop and the modal overlays) paint a translucent
 * dim over a blur so the page behind them reads as frosted glass rather than a
 * flat wash. This is the WEB twin of `./overlay-blur` (the `.native.tsx` file
 * carries the guarded `@sbaiahmed1/react-native-blur` require): web never
 * touches the optional peer, so the web bundle builds even when the package is
 * not installed. RNW 0.21 passes `backdropFilter` through (prefixing
 * `WebkitBackdropFilter`), so the frost is the same 30 px the native `BlurView`
 * applies.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';

/**
 * The web blur layer under an overlay scrim. Absolute-fills its parent and
 * never intercepts touches (it is purely decorative — the scrim above it is
 * the tap target).
 *
 * Internal to the package — not exported.
 */
export function OverlayBlur() {
  return (
    <View
      pointerEvents="none"
      // biome-ignore lint/plugin: RN's ViewStyle has no backdropFilter — RNW forwards the CSS property at runtime
      style={[StyleSheet.absoluteFill, { backdropFilter: 'blur(30px)' } as unknown as ViewStyle]}
    />
  );
}
