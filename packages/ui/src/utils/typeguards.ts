/**
 * Narrows a union to the member(s) that declare `key` — a type-guard replacement for the
 * `in` operator's discriminated-union narrowing. Returns `true` only when `key` is an own
 * property of `obj`. For a plain boolean presence check where no type narrowing is needed,
 * prefer `Object.hasOwn(obj, key)` directly.
 */
export function hasKey<K extends PropertyKey>(key: K, obj: unknown): obj is Record<K, unknown> {
  return obj !== null && typeof obj === 'object' && Object.hasOwn(obj, key);
}
