import { Platform, type StyleProp, View, type ViewStyle } from 'react-native';
import { cn } from '../../../lib/cn';
import { MotiView } from '../../../moti/components/view';
import { ModalBlur } from './blur-host';
import { useBlurHostMounted } from './blur-registry';
import type { OverlayType } from './overlay-type';

type OverlayScrimProps = {
  /** The scrim kind: `"blur"` (frost + dim), `"opacity"` (dim only), or `"none"` (no scrim). */
  type: OverlayType;
  /** Class applied to the dim layer (e.g. `"bg-black/40"`). Omit to use `dimStyle` instead. */
  dimClassName?: string;
  /** Style applied to the dim layer (e.g. an inline theme-exempt rgba). */
  dimStyle?: StyleProp<ViewStyle>;
  /** Render the dim under `"blur"` too (default). Set false when the frost alone darkens. */
  dimOnBlur?: boolean;
  /** Fade the dim in on mount rather than painting it statically. */
  animateDim?: boolean;
};

type DimLayerProps = { animate: boolean; dimClassName?: string; dimStyle?: StyleProp<ViewStyle> };

function DimLayer({ animate, dimClassName, dimStyle }: DimLayerProps) {
  return animate ? (
    <MotiView
      pointerEvents="none"
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 200 }}
      className={cn('absolute inset-0', dimClassName)}
      style={dimStyle}
    />
  ) : (
    <View pointerEvents="none" className={cn('absolute inset-0', dimClassName)} style={dimStyle} />
  );
}

/**
 * The blur + dim scrim shared by the menu overlays. Collapses the per-file
 * `overlay === 'blur' ? <ModalBlur/> : null` + `overlay === 'none' ? null : <dim/>`
 * pair into one reference, so the overlay branch stops counting toward each
 * component's cognitive-complexity budget.
 *
 * The blur layer is `ModalBlur`: inline `OverlayBlur` on iOS/web, and on
 * Android a pane hosted in the app window's `OverlayBlurHost` (an RN Modal is a
 * separate window there, so an in-modal blur cannot reach the page — see
 * `./blur-host`). When Android cannot render the requested blur (no host
 * mounted, no peer, or API < 31) the dim is ALWAYS shown, even for callers
 * that pass `dimOnBlur={false}` — a requested blur must never degrade to
 * nothing behind the panel.
 *
 * The wrapper (animated opacity, `pointerEvents`, positioning) stays at the call
 * site — the dim itself is always touch-transparent, and the dismiss target is a
 * sibling layered above it.
 *
 * Internal to the package — not exported.
 */
export function OverlayScrim({ type, dimClassName, dimStyle, dimOnBlur = true, animateDim = false }: OverlayScrimProps) {
  const hostMounted = useBlurHostMounted();
  if (type === 'none') return null;

  // Android only: is the requested blur actually going to render? (iOS/web
  // always render the inline pane; Android needs the app-window host.)
  const blurUnavailable = type === 'blur' && Platform.OS === 'android' && !hostMounted;

  const showDim = type === 'opacity' || dimOnBlur || blurUnavailable;

  return (
    <>
      {type === 'blur' ? <ModalBlur /> : null}
      {showDim ? <DimLayer animate={animateDim} dimClassName={dimClassName} dimStyle={dimStyle} /> : null}
    </>
  );
}
