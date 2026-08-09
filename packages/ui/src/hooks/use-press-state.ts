import { useCallback, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';

export type PressHandlers = {
  onPressIn: (event: GestureResponderEvent) => void;
  onPressOut: (event: GestureResponderEvent) => void;
};

export type UsePressStateOptions = {
  /** Forwarded after internal state is updated. */
  onPressIn?: ((event: GestureResponderEvent) => void) | null;
  /** Forwarded after internal state is updated. */
  onPressOut?: ((event: GestureResponderEvent) => void) | null;
};

export type UsePressStateReturn = { pressed: boolean; pressHandlers: PressHandlers };

/**
 * Pressed-state bookkeeping for interactive surfaces that animate on press
 * (scale, opacity, or colour shift on press-down / press-up).
 *
 * Returns `pressed` for the animation and `pressHandlers` to spread onto the
 * `Pressable` (or any component that accepts `onPressIn` / `onPressOut`).
 *
 * Pass `onPressIn` / `onPressOut` callbacks to forward the events after the
 * internal state is updated — the pattern used by `MenuItem` and `ActionRow`
 * when their own caller also needs the event.
 *
 * @example
 * // Simple — just the press state for a scale spring.
 * const { pressed, pressHandlers } = usePressState();
 * <Pressable {...pressHandlers} onPress={handlePress}>
 *   <MotiView animate={{ scale: pressed ? 0.92 : 1 }} />
 * </Pressable>
 *
 * @example
 * // With forwarding — the caller also needs the events.
 * const { pressed, pressHandlers } = usePressState({ onPressIn: props.onPressIn, onPressOut: props.onPressOut });
 */
export function usePressState(options?: UsePressStateOptions): UsePressStateReturn {
  const [pressed, setPressed] = useState(false);

  const onPressIn = useCallback(
    (event: GestureResponderEvent) => {
      setPressed(true);
      options?.onPressIn?.(event);
    },
    [options?.onPressIn],
  );

  const onPressOut = useCallback(
    (event: GestureResponderEvent) => {
      setPressed(false);
      options?.onPressOut?.(event);
    },
    [options?.onPressOut],
  );

  return { pressed, pressHandlers: { onPressIn, onPressOut } };
}
