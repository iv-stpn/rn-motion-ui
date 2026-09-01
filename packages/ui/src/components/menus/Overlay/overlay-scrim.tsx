import { type StyleProp, View, type ViewStyle } from 'react-native';
import { cn } from '../../../lib/cn';
import { MotiView } from '../../../moti/components/view';
import { OverlayBlur } from './overlay-blur';
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
 * `overlay === 'blur' ? <OverlayBlur/> : null` + `overlay === 'none' ? null : <dim/>`
 * pair into one reference, so the overlay branch stops counting toward each
 * component's cognitive-complexity budget.
 *
 * The wrapper (animated opacity, `pointerEvents`, positioning) stays at the call
 * site — the dim itself is always touch-transparent, and the dismiss target is a
 * sibling layered above it.
 *
 * Internal to the package — not exported.
 */
export function OverlayScrim({ type, dimClassName, dimStyle, dimOnBlur = true, animateDim = false }: OverlayScrimProps) {
  if (type === 'none') return null;

  const showDim = type === 'opacity' || dimOnBlur;

  return (
    <>
      {type === 'blur' ? <OverlayBlur /> : null}
      {showDim ? <DimLayer animate={animateDim} dimClassName={dimClassName} dimStyle={dimStyle} /> : null}
    </>
  );
}
