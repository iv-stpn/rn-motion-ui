import { View } from 'react-native';

/** Diameter of the circular handle both the panel and the slider drag around. */
const THUMB_SIZE = 18;

type PickerThumbProps = {
  /** Fill colour — the value currently under the handle. */
  color: string;
  /** Centre point, in the parent panel's coordinate space. */
  x: number;
  y: number;
};

/**
 * The picker's handle: a circle filled with the current colour, ringed in white
 * so it stays legible on any gradient — including the very colour it holds.
 * The handle never claims the pointer (the parent's PanResponder does), so it is
 * rendered `pointerEvents="none"`.
 */
export function PickerThumb({ color, x, y }: PickerThumbProps) {
  return (
    <View
      pointerEvents="none"
      className="absolute rounded-full"
      style={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        left: x - THUMB_SIZE / 2,
        top: y - THUMB_SIZE / 2,
        backgroundColor: color,
        borderWidth: 2,
        borderColor: '#fff' /* theme-exempt: white ring stays legible on any colour */,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
      }}
    />
  );
}
