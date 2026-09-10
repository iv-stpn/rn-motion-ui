import { Platform } from 'react-native';
import { SPRING_DOCK_SCALE, springLayout } from '../../../lib/ease';
import { TIMING_INSTANT } from '../../../theme/motion';

const IS_WEB = Platform.OS === 'web';

export const DOCK_SPRING = SPRING_DOCK_SCALE;
export const DOCK_LAYOUT = springLayout(DOCK_SPRING);

/** Fabric needs Yoga targets; web can animate the dimensions directly. */
export function dockSizeMotion(width: number, height: number, reduce: boolean) {
  return {
    animate: IS_WEB ? { width, height } : undefined,
    style: IS_WEB ? undefined : { width, height },
    layout: IS_WEB || reduce ? undefined : DOCK_LAYOUT,
    transition: reduce ? TIMING_INSTANT : DOCK_SPRING,
  };
}
