// The per-entry `testID` scheme, shared by all four views.
//
// One entry gets one id, whichever view is drawing it — a list row, an icons
// tile, a columns row and a filmstrip tile for the same path all answer to
// `<root>-entry-<path>`, so a test that switches views keeps its queries. The
// path is the identity (see file-system.types), so it is what the id carries;
// folder paths keep their trailing slash, exactly as `items` spells them.

/** Fallback root, matching `<Table>`'s: a per-entry id is available untagged. */
const DEFAULT_TEST_ID = 'file-system';

/** `testID` for the entry at `path`, from the root `testID` (or the default). */
export function fileSystemEntryTestID(rootTestID: string | undefined, path: string): string {
  return `${rootTestID ?? DEFAULT_TEST_ID}-entry-${path}`;
}
