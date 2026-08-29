import { memo, type ReactNode, useCallback } from 'react';
import { type LayoutChangeEvent, Text, View, type ViewStyle } from 'react-native';
import { useHoldMenuInternal } from './context';
import type { MenuItemProps } from './hold-menu-types';

type MeasureMenuWidthProps = {
  items: MenuItemProps[];
  /** Reports the measured widest-row width, in px, once layout lands. */
  onWidth: (width: number) => void;
};

/** Off-screen and inert — never painted, never read by assistive tech, never interactive. */
const OFFSCREEN_STYLE: ViewStyle = { left: 0, opacity: 0, pointerEvents: 'none', position: 'absolute', top: 0 };

/**
 * Hidden measuring copy of the menu rows, mounted once per `HoldItem` so the
 * panel's content-fit width is known before the first hold (measuring on the
 * frame the menu opens would lag the pop-in by a frame).
 *
 * Each row is laid out exactly as `MenuItem` does — icon leads the label, `gap-2`
 * between them, `px-4` around — but shrink-wrapped (no `w-full`), so the
 * container's `onLayout` width is the widest row's natural width. The icon is
 * `size={18}`, mirroring `MenuItem`.
 */
function MeasureMenuWidthComponent({ items, onWidth }: MeasureMenuWidthProps) {
  const { AnimatedIcon } = useHoldMenuInternal();

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (width > 0) onWidth(width);
    },
    [onWidth],
  );

  return (
    <View
      aria-hidden={true}
      importantForAccessibility="no-hide-descendants"
      style={OFFSCREEN_STYLE}
      className="flex-col items-start"
      onLayout={handleLayout}
    >
      {items.map((item) => {
        let iconElement: ReactNode = null;
        if (!item.isTitle && item.icon) {
          if (typeof item.icon === 'string' && AnimatedIcon) iconElement = <AnimatedIcon name={item.icon} size={18} />;
          else if (typeof item.icon === 'function') iconElement = item.icon();
        }
        return (
          <View key={item.text} className="flex-row items-center gap-2 px-4">
            {iconElement}
            <Text className={item.isTitle ? 'text-sm' : 'text-base'}>{item.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

export const MeasureMenuWidth = memo(MeasureMenuWidthComponent);
