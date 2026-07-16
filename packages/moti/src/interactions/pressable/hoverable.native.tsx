import React from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { HoveredContext } from './hoverable-context';

// On native, hovering is not supported — provide a no-op context value.
export function Hoverable({
  children,
}: {
  children: React.ReactElement;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  childRef?: React.Ref<unknown>;
}) {
  return (
    <HoveredContext.Provider value={useSharedValue(false)}>{React.Children.only(children)}</HoveredContext.Provider>
  );
}
