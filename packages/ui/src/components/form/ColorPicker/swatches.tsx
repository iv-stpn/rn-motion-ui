import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '../../../lib/cn';

const SWATCH_SIZE = 24;

type SwatchProps = { hex: string; selected: boolean; onSelect: (hex: string) => void; testID?: string };

function Swatch({ hex, selected, onSelect, testID }: SwatchProps) {
  const handlePress = useCallback(() => onSelect(hex), [onSelect, hex]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Swatch ${hex}`}
      accessibilityState={{ selected }}
      onPress={handlePress}
      testID={testID}
      className={cn('rounded-[6px] border-[1.5px]', selected ? 'border-foreground' : 'border-border')}
      style={{ width: SWATCH_SIZE, height: SWATCH_SIZE, backgroundColor: hex }}
    />
  );
}

export type SwatchesProps = {
  colors: readonly string[];
  /** Current hex — the matching swatch gets a stronger ring. */
  value: string;
  onSelect: (hex: string) => void;
  testID?: string;
};

/**
 * A wrap of preset colour squares. Tapping one commits it outright — a discrete
 * pick, unlike the continuous drag of the panel and slider.
 */
export function Swatches({ colors, value, onSelect, testID }: SwatchesProps) {
  const current = value.toLowerCase();
  return (
    <View className="flex-row flex-wrap gap-2" testID={testID ? `${testID}-swatches` : undefined}>
      {colors.map((hex, index) => (
        <Swatch
          key={hex}
          hex={hex}
          selected={hex.toLowerCase() === current}
          onSelect={onSelect}
          testID={testID ? `${testID}-swatch-${index}` : undefined}
        />
      ))}
    </View>
  );
}
