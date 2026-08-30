import { useCallback, useId, useRef, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, PanResponder, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { cn } from '../../../lib/cn';
import { hsvToHex } from './hsv';
import { PickerThumb } from './picker-thumb';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export type SaturationPanelProps = {
  /** Hue the plane is drawn at — the third channel the panel cannot set. */
  hue: number;
  saturation: number;
  value: number;
  onChange: (saturation: number, value: number) => void;
  onComplete?: (saturation: number, value: number) => void;
  className?: string;
  testID?: string;
  accessibilityLabel?: string;
};

/**
 * The two-dimensional saturation/value plane of an HSV picker (Adobe-style).
 * The horizontal axis is saturation (white → the pure hue), the vertical axis
 * is value (full → black), with the hue fixed by the slider beside it.
 *
 * Rendering the plane as two stacked linear gradients — a horizontal
 * white→hue ramp under a vertical transparent→black ramp — is exact: overlaying
 * black at alpha `1 − v` on the top row scales every channel by `v`, which is
 * precisely `hsv(h, s, v)`.
 *
 * Interaction is PanResponder over the plane, mapping `locationX/Y` straight to
 * `s`/`v` with no spring. A slider can glide because one axis only ever moves
 * toward a single target; here the handle must track the finger 1:1 across a
 * colour field, so any interpolation would land on the wrong colour.
 */
export function SaturationPanel({
  hue,
  saturation,
  value,
  onChange,
  onComplete,
  className,
  testID,
  accessibilityLabel,
}: SaturationPanelProps) {
  // SVG gradient ids must be unique per instance (they land in one shared defs
  // space on the page), so derive them from React's instance-unique id.
  const gradientId = useId().replace(/:/g, '');

  const [size, setSize] = useState({ width: 0, height: 0 });
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const applyPoint = (x: number, y: number) => {
    const { width, height } = sizeRef.current;
    if (!(width && height)) return;
    onChange(clamp01(x / width), 1 - clamp01(y / height));
  };

  // Created per render so the handlers always close over the freshest `onChange`
  // and `onComplete`; the size is read through `sizeRef`, which never stales.
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e: GestureResponderEvent) => applyPoint(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onPanResponderMove: (e: GestureResponderEvent) => applyPoint(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onPanResponderRelease: (e: GestureResponderEvent) => {
      const { width, height } = sizeRef.current;
      if (width && height) onComplete?.(clamp01(e.nativeEvent.locationX / width), 1 - clamp01(e.nativeEvent.locationY / height));
    },
  });

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }),
    [],
  );

  return (
    <View
      {...responder.panHandlers}
      onLayout={onLayout}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Drag to choose saturation and brightness"
      testID={testID}
      className={cn('relative h-44 w-full', className)}
    >
      {/* Gradient plane, clipped to its own rounded corners so the handle can
          ride the edges without being cut off by the container. */}
      <View pointerEvents="none" className="absolute inset-0 overflow-hidden rounded-lg">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`${gradientId}-sat`} x1="0" y1="0" x2="1" y2="0">
              <Stop /* theme-exempt: the plane's achromatic corner is pure white */ offset="0" stopColor="#fff" />
              <Stop offset="1" stopColor={hsvToHex(hue, 1, 1)} />
            </LinearGradient>
            <LinearGradient id={`${gradientId}-val`} x1="0" y1="0" x2="0" y2="1">
              <Stop /* theme-exempt: black value ramp */ offset="0" stopColor="#000" stopOpacity={0} />
              <Stop /* theme-exempt: black value ramp */ offset="1" stopColor="#000" stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId}-sat)`} />
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId}-val)`} />
        </Svg>
      </View>

      {/* Handle — hidden until the plane has a measured size, so it never flashes
          at the origin on first mount. */}
      {size.width > 0 ? (
        <PickerThumb color={hsvToHex(hue, saturation, value)} x={saturation * size.width} y={(1 - value) * size.height} />
      ) : null}
    </View>
  );
}
