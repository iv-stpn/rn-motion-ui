/**
 * Minimal mock for react-native-worklets used in vitest unit tests.
 * scheduleOnRN normally schedules a function to run on the React Native JS thread;
 * in tests we call it synchronously.
 */
export const scheduleOnRN = (fn: (...args: unknown[]) => void, ...args: unknown[]): void => {
  fn(...args);
};
