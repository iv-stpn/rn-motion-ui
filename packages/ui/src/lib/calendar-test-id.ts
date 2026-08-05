// The `testID` scheme shared by the calendar and the two pickers.
//
// Every part of a calendar derives its id from the one the consumer put on the
// root, so a test that has the root id can reach any cell without the hook
// having to hand back a map of ids. Unlike `<FileSystem>`'s scheme there is no
// default root: a calendar is a generic primitive that a consumer may render
// several of on one screen, so inventing `'calendar-day-2026-08-05'` would make
// two grids answer to the same query. No root id means no ids at all.

/** `` `${testID}-<suffix>` ``, or nothing at all when the root carries no testID. */
export function deriveTestID(testID: string | undefined, suffix: string): string | undefined {
  return testID === undefined ? undefined : `${testID}-${suffix}`;
}
