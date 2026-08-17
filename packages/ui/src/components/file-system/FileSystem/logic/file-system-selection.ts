/** biome-ignore-all lint/style/useExportsLast: the empty-selection constant belongs beside the state type it is an instance of */
// The selection model. Pure and RN-free, so the decision table can be unit
// tested without a renderer.
//
// One press can mean three different things — replace the selection with this
// entry, toggle this entry in place, or run from the anchor to it — and which
// one it means is a modifier key on web and a gesture on touch. Both converge on
// `additive` and `range`: the render layer maps Ctrl/Cmd-click, Shift-click and
// long-press onto them, and this module owns what they do to the set. Nothing
// here knows which of them produced it.

/** Whether more than one entry can be selected at a time. */
export type FileSystemSelectionMode = 'single' | 'multiple';

/** What a press meant, once the render layer has read the platform's signals. */
export type FileSystemSelectionModifiers = {
  /**
   * Ctrl/Cmd-click on web, long-press on touch: toggle this entry in place
   * rather than replacing the selection with it. Ignored in `single` mode.
   */
  additive?: boolean;
  /**
   * Long-press: the additive gesture, minus the removal half. Joins the entry
   * to the selection and never takes one out — a re-hold of an already
   * selected entry keeps it, so the drag that follows can carry the whole
   * group again. Only meaningful alongside `additive: true`.
   */
  addOnly?: boolean;
  /**
   * Shift-click: take the contiguous run from the anchor to this entry, in the
   * order the pressed view lays its entries out. Ignored in `single` mode, and
   * when the caller passes no `orderedPaths` to measure it against.
   */
  range?: boolean;
};

/**
 * The whole selection.
 *
 * `lead` is the entry every single-selection surface follows — the columns
 * trail, the gallery stage, the preview pane, the status bar's name and
 * `onSelectionChange`. It is always a member of `paths`, except when both are
 * empty. Toggling the lead off promotes the most recently added survivor, so a
 * multi-selection never leaves those surfaces blank while entries remain.
 *
 * `anchor` is where a Shift-range measures from: the last entry picked *without*
 * Shift. A range press deliberately leaves it alone, so shift-clicking around
 * grows and shrinks one run from a fixed origin instead of accumulating — the
 * behaviour every desktop file manager has.
 */
export type FileSystemSelectionState = { anchor: string | null; lead: string | null; paths: ReadonlySet<string> };

export const EMPTY_FILE_SYSTEM_SELECTION: FileSystemSelectionState = {
  anchor: null,
  lead: null,
  paths: new Set<string>(),
};

/** Last member in insertion order — the survivor that inherits the lead. */
function lastOf(paths: ReadonlySet<string>): string | null {
  let last: string | null = null;
  for (const path of paths) last = path;
  return last;
}

/** Same members, order disregarded. Guards the identity contract below. */
function sameMembers(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

/**
 * The contiguous run between two paths in `orderedPaths`, inclusive of both, or
 * `null` when either is missing from it. Direction-agnostic: a range dragged
 * upward is the same run as one dragged down.
 */
export function runBetween(from: string, to: string, orderedPaths: readonly string[]): string[] | null {
  const start = orderedPaths.indexOf(from);
  const end = orderedPaths.indexOf(to);
  if (start === -1 || end === -1) return null;
  return orderedPaths.slice(Math.min(start, end), Math.max(start, end) + 1);
}

export type ApplySelectionArgs = {
  mode: FileSystemSelectionMode;
  modifiers?: FileSystemSelectionModifiers;
  /**
   * The pressed view's entries in the order it lays them out — the list view's
   * flattened rows, one grid's tiles, one columns pane. A range only ever runs
   * through the surface the press landed on, which is why the ordering comes
   * from the view rather than from the store.
   */
  orderedPaths?: readonly string[];
};

/**
 * The long-press join: additive minus the removal half.
 *
 * Returns `current` by identity when the entry is already selected — no state
 * write, no callbacks — so a re-hold of a selected entry keeps the selection
 * intact and a drag lifted off it can still carry the whole group.
 */
function joinFileSystemSelection(current: FileSystemSelectionState, path: string): FileSystemSelectionState {
  if (current.paths.has(path)) return current;
  const paths = new Set(current.paths);
  paths.add(path);
  return { anchor: path, lead: path, paths };
}

/**
 * Apply one press to the selection.
 *
 * Returns `current` itself when the press changes nothing — a re-press of the
 * sole selected entry, a range that reselects what is already selected, or a
 * clear against an empty selection — so callers can compare by identity and skip
 * both the state write and the consumer callbacks it would otherwise fire.
 *
 * @param path `null` clears the selection (a press on the background).
 */
export function applyFileSystemSelection(
  current: FileSystemSelectionState,
  path: string | null,
  { mode, modifiers, orderedPaths }: ApplySelectionArgs,
): FileSystemSelectionState {
  if (path === null) return current.lead === null && current.paths.size === 0 ? current : EMPTY_FILE_SYSTEM_SELECTION;

  // `single` ignores both modifiers rather than treating them as a toggle or a
  // run: a consumer who did not ask for multi-selection should never end up with
  // an empty selection from a Ctrl-click, or several entries from a Shift-click.
  const canMulti = mode === 'multiple';
  const additive = canMulti && Boolean(modifiers?.additive);

  if (canMulti && modifiers?.range && orderedPaths) {
    // With no anchor yet the press is its own origin, so the run is just itself.
    const run = runBetween(current.anchor ?? path, path, orderedPaths);
    if (run !== null) {
      // Shift alone replaces; Shift with Ctrl/Cmd adds the run to what is there,
      // which is how you build a selection out of several separate runs.
      const paths = additive ? new Set([...current.paths, ...run]) : new Set(run);
      if (sameMembers(paths, current.paths) && current.lead === path) return current;
      return { anchor: current.anchor ?? path, lead: path, paths };
    }
    // An ordering that does not contain the press (a stale anchor from another
    // folder, say) falls through and is treated as an ordinary press.
  }

  if (!additive) {
    if (current.lead === path && current.anchor === path && current.paths.size === 1) return current;
    return { anchor: path, lead: path, paths: new Set([path]) };
  }

  // Long-press (addOnly): join, never remove. A re-hold of an already selected
  // entry is a no-op by identity — no state write, no callbacks — so the
  // selection survives the hold and a drag lifted off it still carries the
  // whole group.
  if (modifiers?.addOnly) return joinFileSystemSelection(current, path);

  const paths = new Set(current.paths);
  if (!paths.delete(path)) {
    paths.add(path);
    return { anchor: path, lead: path, paths };
  }
  return { anchor: path, lead: current.lead === path ? lastOf(paths) : current.lead, paths };
}

/**
 * Apply a live selection box to the selection.
 *
 * Called on every pointer move of a marquee, so the identity contract matters
 * more here than anywhere else: a box dragged across empty space must not write
 * to the store sixty times a second.
 *
 * @param covered  Paths the box currently encloses, in the view's own order.
 * @param base     The selection as it stood when the box was started, when the
 *                 marquee is additive (Ctrl/Cmd held); `null` when it replaces.
 */
export function applyFileSystemMarquee(
  current: FileSystemSelectionState,
  covered: readonly string[],
  base: ReadonlySet<string> | null,
): FileSystemSelectionState {
  const paths = base === null ? new Set(covered) : new Set([...base, ...covered]);
  if (sameMembers(paths, current.paths)) return current;
  // The first entry the box reached anchors it, so a Shift-click after the
  // marquee measures from where the box started rather than from before it.
  const anchor = covered[0] ?? current.anchor;
  return { anchor: paths.size === 0 ? null : anchor, lead: lastOf(paths), paths };
}

/**
 * Remove a live scrub's covered run from the selection.
 *
 * The remove-mirror of {@link applyFileSystemMarquee}: called on every move of a
 * scrub that started on an already-selected entry, so it carries the same identity
 * contract — a run that removes nothing must not write to the store sixty times a
 * second. `base` is the non-null snapshot the scrub took when it started; removing
 * from `base` (not from `current`) is what lets the finger drag back over a run it
 * just cleared and re-add it, instead of sticking to the first clear.
 */
export function applyFileSystemDeselect(
  current: FileSystemSelectionState,
  covered: readonly string[],
  base: ReadonlySet<string>,
): FileSystemSelectionState {
  const paths = new Set(base);
  for (const path of covered) paths.delete(path);
  if (sameMembers(paths, current.paths)) return current;

  // Removing members is `pruneFileSystemSelection`'s shape: keep the lead and anchor
  // when they survive, and otherwise promote the most recently added survivor — a
  // scrub that clears the lead must not leave the preview/status surfaces blank while
  // entries remain, and one that clears everything drops the anchor too.
  // When nothing survives, `lastOf` is already `null`, so the anchor falls back to it.
  const lead = current.lead !== null && paths.has(current.lead) ? current.lead : lastOf(paths);
  const anchor = current.anchor !== null && paths.has(current.anchor) ? current.anchor : lead;
  return { anchor, lead, paths };
}

/**
 * Drop everything the current filter/search no longer shows.
 *
 * `visiblePaths` is `null` when nothing is filtering, which is not the same as
 * "nothing is visible" — it means every path is, so the selection stands.
 * Returns `current` by identity when nothing was pruned.
 */
export function pruneFileSystemSelection(
  current: FileSystemSelectionState,
  visiblePaths: ReadonlySet<string> | null,
): FileSystemSelectionState {
  if (visiblePaths === null) return current;

  const anchorHeld = current.anchor === null || visiblePaths.has(current.anchor);
  if (current.paths.size === 0) return anchorHeld ? current : { ...current, anchor: null };

  const paths = new Set<string>();
  for (const path of current.paths) if (visiblePaths.has(path)) paths.add(path);
  if (paths.size === current.paths.size && anchorHeld) return current;

  const lead = current.lead !== null && paths.has(current.lead) ? current.lead : lastOf(paths);
  return { anchor: anchorHeld ? current.anchor : lead, lead, paths };
}
