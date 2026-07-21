/** Joins truthy class strings. No conflict resolution — additive use only. */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
