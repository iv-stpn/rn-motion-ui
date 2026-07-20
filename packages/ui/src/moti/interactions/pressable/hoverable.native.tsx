import React from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { HoveredContext } from './hoverable-context';

export type HoverableProps = {
  children: React.ReactElement;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  childRef?: React.Ref<unknown>;
};

// On native, hovering is not supported — provide a no-op context value.
export function Hoverable({ children }: HoverableProps) {
  return <HoveredContext.Provider value={useSharedValue(false)}>{React.Children.only(children)}</HoveredContext.Provider>;
}

// biome-ignore lint/style/useComponentExportOnlyModules: MotiHover is a component alias for Hoverable
export { Hoverable as MotiHover };
