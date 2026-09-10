import { memo, type ReactNode } from 'react';
import type { LayoutRectangle, StyleProp, ViewStyle } from 'react-native';
import { MotiView } from '../../../moti/components/view';
import { TIMING_INSTANT } from '../../../theme/motion';
import { Text } from '../../typography/Text/text';
import { DOCK_CAPTION_HEIGHT, DOCK_ICON_SCALE, DOCK_INACTIVE_OPACITY, dockMetrics } from './dock-metrics';
import { DOCK_SPRING, dockSizeMotion } from './dock-transition';

type DockFrameProps = {
  rect: LayoutRectangle;
  reduce: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type DockContentProps = {
  itemPx: number;
  labelled: boolean;
  active?: boolean;
  reduce: boolean;
  label?: string;
  children: ReactNode;
};

export function DockFrame({ rect, reduce, children, style, testID }: DockFrameProps) {
  const motion = dockSizeMotion(rect.width, rect.height, reduce);
  return (
    <MotiView
      {...motion}
      animate={{ ...motion.animate, translateX: rect.x, translateY: rect.y }}
      style={[{ position: 'absolute', left: 0, top: 0 }, motion.style, style]}
      testID={testID}
    >
      {children}
    </MotiView>
  );
}

// Other slots report layout independently; unchanged pill targets must not restart its spring.
export const DockHighlight = memo(function Highlight({
  rect,
  reduce,
  testID,
}: Omit<DockFrameProps, 'rect'> & { rect?: LayoutRectangle }) {
  if (!rect) return null;
  const motion = dockSizeMotion(rect.width, rect.height, reduce);
  return (
    <MotiView
      {...motion}
      animate={{ ...motion.animate, translateX: rect.x, translateY: rect.y }}
      style={[{ position: 'absolute', left: 0, top: 0 }, motion.style]}
      className="pointer-events-none rounded-full bg-surface-selected"
      testID={testID}
      aria-hidden={true}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
    />
  );
});

export function DockContent({ itemPx, labelled, active, reduce, label, children }: DockContentProps) {
  const metrics = dockMetrics(itemPx, labelled);
  const transition = reduce ? TIMING_INSTANT : DOCK_SPRING;
  const opacity = active ? 1 : DOCK_INACTIVE_OPACITY;
  return (
    <>
      <MotiView
        animate={{ translateY: metrics.iconY, opacity }}
        transition={transition}
        className="absolute top-0 right-0 left-0 items-center justify-center"
        style={{ height: metrics.iconSize }}
      >
        <MotiView animate={{ scale: labelled ? DOCK_ICON_SCALE : 1 }} transition={transition}>
          {children}
        </MotiView>
      </MotiView>
      {label ? (
        <MotiView
          animate={{ translateY: metrics.captionY + (labelled ? 0 : 3), opacity: labelled ? opacity : 0 }}
          transition={transition}
          className="pointer-events-none absolute top-0 right-0 left-0 items-center justify-center"
          style={{ height: DOCK_CAPTION_HEIGHT }}
          aria-hidden={true}
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
        >
          <Text className="text-[10px]" style={{ lineHeight: DOCK_CAPTION_HEIGHT }} numberOfLines={1}>
            {label}
          </Text>
        </MotiView>
      ) : null}
    </>
  );
}
