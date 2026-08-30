import { useCallback, useId, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { cn } from '../../../lib/cn';
import { hsvToHex } from './hsv';
import { PickerThumb } from './picker-thumb';

// The rainbow wraps back to red at both ends, so the loop closes seamlessly.
// theme-exempt: the hue wheel's rainbow stops are fixed spectrum data, not theme tokens.
const RAINBOW_STOPS: readonly (readonly [number, string])[] = [
  [0, '#ff0000'] /* theme-exempt */,
  [0.1667, '#ffff00'] /* theme-exempt */,
  [0.3333, '#00ff00'] /* theme-exempt */,
  [0.5, '#00ffff'] /* theme-exempt */,
  [0.6667, '#0000ff'] /* theme-exempt */,
  [0.8333, '#ff00ff'] /* theme-exempt */,
  [1, '#ff0000'] /* theme-exempt */,
];

/** Track height; the hit area is taller for a comfortable touch target. */
const TRACK_HEIGHT = 16;
const HIT_HEIGHT = 28;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export type HueSliderProps = {
  /** Current hue in degrees [0, 360). */
  hue: number;
  onChange: (hue: number) => void;
  onComplete?: (hue: number) => void;
  className?: string;
  testID?: string;
  accessibilityLabel?: string;
};

/**
 * The horizontal rainbow bar of an HSV picker. Dragging maps the pointer's x
 * directly to a hue in [0, 360) with no spring, for the same 1:1 precision the
 * saturation panel argues for.
 */
export function HueSlider({ hue, onChange, onComplete, className, testID, accessibilityLabel }: HueSliderProps) {
  const gradientId = useId().replace(/:/g, '');

  const [trackWidth, setTrackWidth] = useState(0);
  const widthRef = useRef(0);

  const hueFromX = (x: number) => {
    const w = widthRef.current;
    if (!w) return hue;
    return clamp01(x / w) * 360;
  };

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e: GestureResponderEvent) => onChange(hueFromX(e.nativeEvent.locationX)),
    onPanResponderMove: (e: GestureResponderEvent) => onChange(hueFromX(e.nativeEvent.locationX)),
    onPanResponderRelease: (e: GestureResponderEvent) => onComplete?.(hueFromX(e.nativeEvent.locationX)),
  });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const onAccessibilityAction = useCallback(
    (e: AccessibilityActionEvent) => {
      if (e.nativeEvent.actionName === 'increment') onChange(Math.min(360, hue + 5));
      else if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(0, hue - 5));
    },
    [hue, onChange],
  );

  return (
    <View
      {...responder.panHandlers}
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      // Both spellings on purpose, mirroring RangeSlider: react-native-web does
      // not read RN's nested `accessibilityValue`, only the flat `aria-value*`.
      accessibilityValue={{ min: 0, max: 360, now: Math.round(hue) }}
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hue)}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      testID={testID}
      className={cn('relative w-full justify-center', className)}
      style={{ height: HIT_HEIGHT }}
    >
      {/* Track — the gradient sits at the vertical centre of the taller hit area. */}
      <View pointerEvents="none" className="w-full overflow-hidden rounded-full" style={{ height: TRACK_HEIGHT }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`${gradientId}-hue`} x1="0" y1="0" x2="1" y2="0">
              {RAINBOW_STOPS.map(([offset, color]) => (
                <Stop key={offset} offset={offset} stopColor={color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId}-hue)`} />
        </Svg>
      </View>

      {trackWidth > 0 ? <PickerThumb color={hsvToHex(hue, 1, 1)} x={(hue / 360) * trackWidth} y={HIT_HEIGHT / 2} /> : null}
    </View>
  );
}
