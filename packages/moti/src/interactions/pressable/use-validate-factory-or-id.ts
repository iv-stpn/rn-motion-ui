import { INTERACTION_CONTAINER_ID, type MotiPressableInteractionIds, useMotiPressableContext } from './context';

type Id = MotiPressableInteractionIds['id'];
type Deps = unknown[] | null | undefined;
type Returns<Factory> = {
  id: Id;
  factory: Factory;
  deps?: Deps;
};

type HookName = 'useMotiPressableAnimatedProps' | 'useMotiPressable' | 'useMotiPressableTransition';

// biome-ignore lint/suspicious/noExplicitAny: Factory must use any[] — unknown[] breaks the constraint due to parameter contravariance
export function useFactory<Factory extends (...args: any[]) => any>(
  hookName: HookName,
  factoryOrId: Factory | MotiPressableInteractionIds['id'],
  maybeFactoryOrDeps?: Factory | Deps,
  maybeDeps?: Deps,
): Returns<Factory> {
  const context = useMotiPressableContext();

  let factory: Factory;
  let id: Id = INTERACTION_CONTAINER_ID;
  let deps: Deps;

  if (typeof factoryOrId === 'function') {
    factory = factoryOrId as Factory;
    deps = maybeFactoryOrDeps as Deps;
  } else if (typeof maybeFactoryOrDeps === 'function') {
    id = factoryOrId as string;
    factory = maybeFactoryOrDeps as Factory;
    deps = maybeDeps;
  } else {
    throw new Error(
      `[${hookName}] Invalid arguments. If the first argument is a unique ID string, the second must be a worklet function. Alternatively, the first argument can be a function, without an ID argument. Received ${String(factoryOrId)} as first argument, and ${String(maybeFactoryOrDeps)} as the second.`,
    );
  }

  if (!context) {
    console.error(`[${hookName}] Missing context. Is this component a child of a <MotiPressable /> component?`);
  } else if (!context.containers[id]) {
    let error = `[${hookName}] Received id "${id}", but there is no <MotiPressable id="${id}" /> wrapping it.`;
    const containerKeys = Object.keys(context.containers);
    if (containerKeys.length) {
      if (containerKeys.length === 1 && containerKeys[0] === INTERACTION_CONTAINER_ID) {
        error += ` A <MotiPressable /> is present as a parent, but it does not have id="${id}" set.`;
      } else {
        const possibleIds = containerKeys.filter((k) => k !== INTERACTION_CONTAINER_ID);
        if (possibleIds.length) error += ` Did you mean one of: ${possibleIds.join(', ')}?`;
      }
    }
    console.error(error);
  }

  return { factory, id, deps };
}
