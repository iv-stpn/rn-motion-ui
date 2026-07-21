/**
 * Narrows a union to the member(s) that declare `key` — a type-guard replacement for the
 * `in` operator's discriminated-union narrowing. Returns `true` only when `key` is an own
 * property of `obj`. For a plain boolean presence check where no type narrowing is needed,
 * prefer `Object.hasOwn(obj, key)` directly.
 *
 * The 'worklet' directive is required because this function is called from inside
 * useAnimatedStyle and applyStyleKey — both run on the Reanimated UI thread.
 */
export function hasKey<K extends PropertyKey>(key: K, obj: unknown): obj is Record<K, unknown> {
  'worklet';
  return obj !== null && typeof obj === 'object' && Object.hasOwn(obj, key);
}
