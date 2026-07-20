import { hasKey } from '../../../utils/typeguards';

/**
 * Unwraps a Reanimated SharedValue/DerivedValue wrapper ({ value }) to its inner value,
 * or returns the prop itself when it is already a plain value.
 */
export function resolveSharedOrPlain<T>(prop: { value?: T } | T | undefined): T | undefined {
  'worklet';
  // biome-ignore lint/plugin: detecting the DerivedValue `.value` wrapper on an opaque generic requires an assertion
  if (prop !== null && prop !== undefined && hasKey('value', prop)) return (prop as { value?: T }).value;
  // biome-ignore lint/plugin: detecting the DerivedValue `.value` wrapper on an opaque generic requires an assertion
  return prop as T | undefined;
}
