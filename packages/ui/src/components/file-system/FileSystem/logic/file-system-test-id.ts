// The per-entry `testID` scheme, shared by all four views.
//
// One entry gets one id, whichever view is drawing it — a list row, an icons
// tile, a columns row and a filmstrip tile for the same path all answer to
// `<root>-entry-<path>`, so a test that switches views keeps its queries. The
// path is the identity (see file-system.types), so it is what the id carries;
// folder paths keep their trailing slash, exactly as `items` spells them.

/** Fallback root, matching `<Table>`'s: a per-entry id is available untagged. */
const DEFAULT_TEST_ID = 'file-system';

/**
 * Each view's scrollable body — the box a drop lands in and the background a
 * press on empty space belongs to. Fixed rather than derived from the root
 * `testID`: a test reaching for "the area, not any entry in it" has exactly one
 * node to name per view, and there is nothing for a consumer to disambiguate.
 */
export const FS_DRAG_CONTAINER_TEST_ID = {
  column: 'file-system-column-drag-container',
  icons: 'file-system-icons-drag-container',
  list: 'file-system-list-drag-container',
};

/**
 * The outline an expanded folder's overlay dropzone paints while a release would
 * land in it. It renders only once the overlay has measured and won the hit test,
 * so a test can wait on it as the signal that an in-flight drag's overlays are
 * settled — the deterministic stand-in for a fixed number of timer ticks.
 */
export const FS_OVERLAY_DROPZONE_TEST_ID = 'file-system-overlay-dropzone';

/** `testID` for the entry at `path`, from the root `testID` (or the default). */
export function fileSystemEntryTestID(rootTestID: string | undefined, path: string): string {
  return `${rootTestID ?? DEFAULT_TEST_ID}-entry-${path}`;
}
