import React, { type ReactElement, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
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

type KeyCallbacks = {
  register: (childId: string) => () => void;
  safeToUnmount: (childId: string) => void;
};

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

  // Store of elements we may need to re-render while they exit. Pruned in the
  // cleanup effect once a key is neither current nor exiting.
  const allElementsRef = useRef<Map<string, ReactElement>>(new Map());
  for (const [k, v] of currentMap) allElementsRef.current.set(k, v);

  // Keys of children that are in the middle of their exit animation.
  const [exitingKeys, setExitingKeys] = useState<ReadonlySet<string>>(new Set());

  // Previous set of "current" keys — used to detect removals during render.
  const [prevCurrentKeys, setPrevCurrentKeys] = useState<ReadonlySet<string>>(new Set());

  // When exitBeforeEnter=true, keys that want to enter but must wait for all
  // exits to complete before becoming visible.
  const [heldKeys, setHeldKeys] = useState<ReadonlySet<string>>(new Set());

  const isFirstRender = useRef(true);

  // key → (childId → exit-complete). Every Moti descendant of a key registers
  // here via PresenceContext.register; the key unmounts only when every
  // registered child has reported completion.
  const registryRef = useRef(new Map<string, Map<string, boolean>>());

  // Stable per-key register/safeToUnmount closures. Identity MUST NOT change
  // across renders: children re-register when `register` changes identity, and
  // the transient deregister could complete an in-flight exit prematurely.
  const keyCallbacksRef = useRef(new Map<string, KeyCallbacks>());

  // Removes `key` from the exiting set once every registered child has reported
  // completion (or none are registered). Never called during render.
  const finishExitIfDone = useCallback((key: string) => {
    const registered = registryRef.current.get(key);
    if (registered) for (const done of registered.values()) if (!done) return;
    setExitingKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const getKeyCallbacks = (key: string): KeyCallbacks => {
    let callbacks = keyCallbacksRef.current.get(key);
    if (!callbacks) {
      callbacks = {
        register: (childId) => {
          let registered = registryRef.current.get(key);
          if (!registered) {
            registered = new Map();
            registryRef.current.set(key, registered);
          }
          registered.set(childId, false);
          return () => {
            registered.delete(childId);
            // A child unmounting mid-exit must not block the key forever.
            finishExitIfDone(key);
          };
        },
        safeToUnmount: (childId) => {
          registryRef.current.get(key)?.set(childId, true);
          finishExitIfDone(key);
        },
      };
      keyCallbacksRef.current.set(key, callbacks);
    }
    return callbacks;
  };

  const currentKeySet: ReadonlySet<string> = new Set(currentMap.keys());

  // Classify keys that left the tree since the last render. A held key was
  // never rendered, so it is dropped silently instead of being exited.
  const newExits: string[] = [];
  const abandonedHeldKeys: string[] = [];
  for (const key of prevCurrentKeys) {
    if (!(currentMap.has(key) || exitingKeys.has(key))) {
      if (heldKeys.has(key)) abandonedHeldKeys.push(key);
      else newExits.push(key);
    }
  }

  // Keys that re-appeared while exiting — cancel their exit.
  const reenteredKeys: string[] = [];
  for (const key of exitingKeys) if (currentMap.has(key)) reenteredKeys.push(key);

  // Detect which keys just appeared for the first time.
  const newEntries: string[] = [];
  for (const key of currentKeySet) {
    if (!prevCurrentKeys.has(key)) newEntries.push(key);
  }

  // Reset completion flags for keys starting or canceling an exit, so stale
  // reports from a previous (canceled) exit can't complete the next one early.
  // Ref mutation during render: idempotent, safe under StrictMode re-renders.
  for (const key of [...newExits, ...reenteredKeys]) {
    const registered = registryRef.current.get(key);
    if (registered) for (const childId of registered.keys()) registered.set(childId, false);
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
  if (reenteredKeys.length > 0)
    // biome-ignore lint/plugin: intentional derived-state-in-render; only fires when an exiting key re-appears in the tree, converges once the key leaves the exiting set
    setExitingKeys((prev) => {
      const next = new Set(prev);
      for (const key of reenteredKeys) next.delete(key);
      return next;
    });
  if (abandonedHeldKeys.length > 0)
    // biome-ignore lint/plugin: intentional derived-state-in-render; only fires when a held (never-rendered) key leaves the tree, converges once it is dropped from the held set
    setHeldKeys((prev) => {
      const next = new Set(prev);
      for (const key of abandonedHeldKeys) next.delete(key);
      return next;
    });

  // exitBeforeEnter: hold new entries while exits are in progress. `newExits`
  // must be counted too — on an atomic key swap the exit detected in this very
  // render pass has not been committed to `exitingKeys` yet (Fix B).
  if (exitBeforeEnter && newEntries.length > 0 && (exitingKeys.size > 0 || newExits.length > 0))
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

  // Exclude held keys from the render set so new children wait their turn.
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

  // Fire onExitComplete when the exiting set drains — but only when the drained
  // keys actually finished rather than being canceled by re-entry. useModalRender
  // unmounts its Modal on this callback; firing it after a rapid re-open would
  // tear down a modal that is open again.
  const prevExitingRef = useRef<ReadonlySet<string>>(new Set());
  // biome-ignore lint/plugin: detecting the exiting-set drain and firing onExitComplete must happen after commit — calling it during render (or inside a setState updater) would double-fire under StrictMode
  useEffect(() => {
    const prevExiting = prevExitingRef.current;
    prevExitingRef.current = exitingKeys;
    if (prevExiting.size === 0 || exitingKeys.size > 0) return;
    for (const key of prevExiting) if (currentKeySet.has(key)) return;
    onExitComplete?.();
  });

  // Safety net + cache cleanup. finishExitIfDone completes exiting keys whose
  // subtree contains no registered Moti children (nothing would ever report),
  // and keys that are neither current nor exiting release their caches so
  // allElementsRef doesn't grow forever (TextCascade mints a key per label).
  // biome-ignore lint/plugin: pruning per-key caches and completing childless exits must run after children's effects have registered/reported — inherently a post-commit side effect
  useEffect(() => {
    for (const key of exitingKeys) finishExitIfDone(key);
    for (const key of allElementsRef.current.keys()) {
      if (!(currentKeySet.has(key) || exitingKeys.has(key))) {
        allElementsRef.current.delete(key);
        registryRef.current.delete(key);
        keyCallbacksRef.current.delete(key);
      }
    }
  });

  const wrappedChildren = keysToRender.map((key) => {
    const element = currentMap.get(key) ?? allElementsRef.current.get(key);
    if (!element) return null;

    const isPresent = currentMap.has(key);
    const callbacks = getKeyCallbacks(key);

    return (
      <PresenceContext.Provider
        key={key}
        value={{
          isPresent,
          register: callbacks.register,
          safeToUnmount: isPresent ? null : callbacks.safeToUnmount,
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
