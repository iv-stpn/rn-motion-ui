// credit to https://gist.github.com/ianmartorell/32bb7df95e5eff0a5ee2b2f55095e6a6
// adapted from https://gist.github.com/necolas/1c494e44e23eb7f8c5864a2fac66299a
// click listeners from https://gist.github.com/roryabraham/65cd1d2d5e8a48da78fec6a6e3105398
import React, { type ReactElement, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { HoveredContext } from './hoverable-context';
import { mergeRefs } from './merge-refs';

let isEnabled = false;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const HOVER_THRESHOLD_MS = 1000;
  let lastTouchTimestamp = 0;

  const enableHover = () => {
    if (isEnabled || Date.now() - lastTouchTimestamp < HOVER_THRESHOLD_MS) return;
    isEnabled = true;
  };
  const disableHover = () => {
    lastTouchTimestamp = Date.now();
    if (isEnabled) isEnabled = false;
  };

  document.addEventListener('touchstart', disableHover, true);
  document.addEventListener('touchmove', disableHover, true);
  document.addEventListener('mousemove', enableHover, true);
}

function isHoverEnabled(): boolean {
  return isEnabled;
}

export interface HoverableProps {
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  children: ReactElement;
  childRef?: React.Ref<unknown>;
}

export function Hoverable({ onHoverIn, onHoverOut, children, childRef }: HoverableProps) {
  const isHovered = useSharedValue(false);

  const hoverIn = useRef<(() => void) | undefined>(() => onHoverIn?.());
  const hoverOut = useRef<(() => void) | undefined>(() => onHoverOut?.());

  hoverIn.current = onHoverIn;
  hoverOut.current = onHoverOut;

  const localRef = useRef<HTMLDivElement>(null);

  useEffect(
    function disableHoverOnClickOutside() {
      const listener = (event: MouseEvent) => {
        if (localRef.current && event.target instanceof HTMLElement && !localRef.current.contains(event.target)) {
          isHovered.value = false;
        }
      };
      document.addEventListener('mousedown', listener);
      return () => document.removeEventListener('mousedown', listener);
    },
    [isHovered],
  );

  // RNR4: useAnimatedReaction no longer accepts a dependency array.
  useAnimatedReaction(
    () => isHovered.value,
    (hovered, previouslyHovered) => {
      if (hovered !== previouslyHovered) {
        if (hovered) {
          hoverIn.current?.();
        } else {
          hoverOut.current?.();
        }
      }
    },
  );

  const handleMouseEnter = useCallback(() => {
    if (isHoverEnabled() && !isHovered.value) isHovered.value = true;
  }, [isHovered]);

  const handleMouseLeave = useCallback(() => {
    if (isHovered.value) isHovered.value = false;
  }, [isHovered]);

  const child = React.Children.only(children);

  return (
    <HoveredContext.Provider value={isHovered}>
      {React.cloneElement(child, {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        ref: mergeRefs([localRef, childRef ?? null]),
      } as Record<string, unknown>)}
    </HoveredContext.Provider>
  );
}
