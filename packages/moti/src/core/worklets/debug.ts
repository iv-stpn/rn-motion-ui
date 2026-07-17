export const debug = (...args: unknown[]) => {
  'worklet';
  // @ts-expect-error debug flag stashed on the runtime global
  if (!globalThis.shouldDebugMoti) return;
  console.log('[moti]', ...args);
};
