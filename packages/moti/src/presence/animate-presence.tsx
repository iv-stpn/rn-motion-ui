import React, { type ReactElement, type ReactNode, useRef, useState } from 'react';
import { PresenceContext } from './animate-presence-context';

function getChildKey(child: ReactElement): string {
  return child.key ?? '';
}

function getValidChildren(children: ReactNode): ReactElement[] {
  const valid: ReactElement[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) valid.push(child);
  });
  return valid;
}

function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

export type AnimatePresenceProps = {
  children?: ReactNode;
  /** Custom data passed to exit variant functions as the first argument. */
  custom?: unknown;
  /**
   * When `false`, children present on the first render will not animate in.
   * @default true
   */
  initial?: boolean;
  /** Called once all exiting children have completed their exit animations. */
  onExitComplete?: () => void;
  /**
   * When `true`, a new child will not animate in until all exiting children
   * have completed their exit animations.
   * @default false
   */
  exitBeforeEnter?: boolean;
  /**
   * Whether an exiting child's presence should continue to affect layout
   * while it exits. Accepted for API compatibility; not yet implemented.
   */
  presenceAffectsLayout?: boolean;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: AnimatePresence orchestrates the full animation lifecycle (animate/from/exit/state/presence) — the remaining complexity is setup and a single style-key loop; further splitting would require passing shared worklet references across function boundaries
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: AnimatePresence orchestrates the full animation lifecycle (animate/from/exit/state/presence) — the remaining lines are setup and a single style-key loop; further splitting would require passing shared worklet references across function boundaries
export function AnimatePresence({
  children,
  custom,
  initial = true,
  onExitComplete,
  exitBeforeEnter = false,
  presenceAffectsLayout: _presenceAffectsLayout,
}: AnimatePresenceProps) {
  const validChildren = getValidChildren(children);

  // Build a key → element map for the current render
  const currentMap = new Map<string, ReactElement>();
  for (const child of validChildren) currentMap.set(getChildKey(child), child);

  // Persistent store of every element we have ever rendered, so we can
  // re-render exiting children even after they leave the parent tree.
  const allElementsRef = useRef<Map<string, ReactElement>>(new Map());
  for (const [k, v] of currentMap) allElementsRef.current.set(k, v);

  // Keys of children that are in the middle of their exit animation.
  const [exitingKeys, setExitingKeys] = useState<ReadonlySet<string>>(new Set());

  // Previous set of "current" keys — used to detect removals during render
  // via React's getDerivedStateFromProps-equivalent hook pattern.
  const [prevCurrentKeys, setPrevCurrentKeys] = useState<ReadonlySet<string>>(new Set());

  // When exitBeforeEnter=true, keys that want to enter but must wait for
  // all exits to complete before becoming visible.
  const [heldKeys, setHeldKeys] = useState<ReadonlySet<string>>(new Set());

  const isFirstRender = useRef(true);

  const currentKeySet: ReadonlySet<string> = new Set(currentMap.keys());

  // Detect which keys just disappeared and aren't already exiting.
  const newExits: string[] = [];
  for (const key of prevCurrentKeys) {
    if (!(currentMap.has(key) || exitingKeys.has(key))) newExits.push(key);
  }

  // Detect which keys just appeared for the first time.
  const newEntries: string[] = [];
  for (const key of currentKeySet) {
    if (!prevCurrentKeys.has(key)) newEntries.push(key);
  }

  // Flush state updates synchronously inside render (React's safe pattern
  // for derived state — triggers an immediate additional render pass).
  // biome-ignore lint/plugin: intentional derived-state-in-render (React's getDerivedStateFromProps equivalent); guarded by setsEqual so it converges and cannot loop
  if (!setsEqual(prevCurrentKeys, currentKeySet)) setPrevCurrentKeys(currentKeySet);
  if (newExits.length > 0)
    // biome-ignore lint/plugin: intentional derived-state-in-render; only fires when keys actually leave, converging to a stable exiting set
    setExitingKeys((prev) => {
      const next = new Set(prev);
      for (const key of newExits) next.add(key);
      return next;
    });

  // When exitBeforeEnter, hold new entries if exits are still in progress.
  if (exitBeforeEnter && newEntries.length > 0 && exitingKeys.size > 0)
    // biome-ignore lint/plugin: intentional derived-state-in-render; guarded so it only fires when new keys arrive while exits are active, converges to stable held set
    setHeldKeys((prev) => {
      const next = new Set(prev);
      for (const key of newEntries) next.add(key);
      return next;
    });

  // Release held keys once all exits have completed.
  if (exitBeforeEnter && exitingKeys.size === 0 && heldKeys.size > 0)
    // biome-ignore lint/plugin: intentional derived-state-in-render; only fires when exits drain and held keys remain, converges immediately to empty set
    setHeldKeys(new Set());

  const hasActiveExits = exitingKeys.size > 0;

  // When exitBeforeEnter is active and exits are in progress, exclude held
  // keys from the render set so new children wait their turn.
  const keysToRender: string[] = [];
  const seen = new Set<string>();
  for (const key of currentKeySet) {
    if (!(exitBeforeEnter && hasActiveExits && heldKeys.has(key))) {
      keysToRender.push(key);
      seen.add(key);
    }
  }
  for (const key of exitingKeys) {
    if (!seen.has(key)) keysToRender.push(key);
  }

  const firstRender = isFirstRender.current;
  isFirstRender.current = false;

  const wrappedChildren = keysToRender.map((key) => {
    const element = currentMap.get(key) ?? allElementsRef.current.get(key);
    if (!element) return null;

    const isPresent = currentMap.has(key);

    const safeToUnmount = isPresent
      ? null
      : () => {
          setExitingKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            if (next.size === 0) onExitComplete?.();
            return next;
          });
        };

    return (
      <PresenceContext.Provider
        key={key}
        value={{
          isPresent,
          safeToUnmount,
          custom,
          // Pass initial=false when this is the first render and the caller
          // opted out of entry animations with initial={false}.
          initial: firstRender && !initial ? false : undefined,
        }}
      >
        {element}
      </PresenceContext.Provider>
    );
  });

  return <>{wrappedChildren}</>;
}
