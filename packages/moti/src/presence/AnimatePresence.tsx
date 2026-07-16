import React, { createContext, type ReactElement, type ReactNode, useContext, useRef, useState } from 'react';

export type PresenceContextValue = {
  isPresent: boolean;
  safeToUnmount: (() => void) | null;
  /** Arbitrary user data forwarded to exit variant functions. */
  custom?: unknown;
  initial?: boolean;
};

export const PresenceContext = createContext<PresenceContextValue | null>(null);

export function usePresence(): [boolean, (() => void) | null] {
  const context = useContext(PresenceContext);
  if (!context) return [true, null];
  return [context.isPresent, context.safeToUnmount];
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
};

function getChildKey(child: ReactElement): string {
  return String(child.key ?? '');
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

export function AnimatePresence({ children, custom, initial = true, onExitComplete }: AnimatePresenceProps) {
  const validChildren = getValidChildren(children);

  // Build a key → element map for the current render
  const currentMap = new Map<string, ReactElement>();
  for (const child of validChildren) {
    currentMap.set(getChildKey(child), child);
  }

  // Persistent store of every element we have ever rendered, so we can
  // re-render exiting children even after they leave the parent tree.
  const allElementsRef = useRef<Map<string, ReactElement>>(new Map());
  for (const [k, v] of currentMap) allElementsRef.current.set(k, v);

  // Keys of children that are in the middle of their exit animation.
  const [exitingKeys, setExitingKeys] = useState<ReadonlySet<string>>(new Set());

  // Previous set of "current" keys — used to detect removals during render
  // via React's getDerivedStateFromProps-equivalent hook pattern.
  const [prevCurrentKeys, setPrevCurrentKeys] = useState<ReadonlySet<string>>(new Set());

  const isFirstRender = useRef(true);

  const currentKeySet: ReadonlySet<string> = new Set(currentMap.keys());

  // Detect which keys just disappeared and aren't already exiting.
  const newExits: string[] = [];
  for (const key of prevCurrentKeys) {
    if (!currentMap.has(key) && !exitingKeys.has(key)) {
      newExits.push(key);
    }
  }

  // Flush state updates synchronously inside render (React's safe pattern
  // for derived state — triggers an immediate additional render pass).
  if (!setsEqual(prevCurrentKeys, currentKeySet)) {
    setPrevCurrentKeys(currentKeySet);
  }
  if (newExits.length > 0) {
    setExitingKeys((prev) => {
      const next = new Set(prev);
      for (const key of newExits) next.add(key);
      return next;
    });
  }

  // Render current children first, then any still-exiting children.
  const keysToRender = [...currentKeySet, ...exitingKeys].filter(
    (key, i, arr) => arr.indexOf(key) === i, // deduplicate
  );

  const firstRender = isFirstRender.current;
  isFirstRender.current = false;

  const wrappedChildren = keysToRender.map((key) => {
    const element = currentMap.get(key) ?? allElementsRef.current.get(key);
    if (!element) return null;

    const isPresent = currentMap.has(key);

    const safeToUnmount = !isPresent
      ? () => {
          setExitingKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            if (next.size === 0) onExitComplete?.();
            return next;
          });
        }
      : null;

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
