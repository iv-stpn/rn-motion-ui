/** biome-ignore-all lint/style/useExportsLast: the payload's own validator sits between the writer and the reader it guards */
// What a FileSystem drag carries, and whether a folder will take it.
//
// Pure on purpose. The views that use this are `.tsx` and therefore untestable
// here (vitest cannot load react-native's Flow source), and these predicates are
// the part with actual rules in it — a folder may not be dropped into its own
// subtree, an entry may not be dropped where it already lives. So they live apart
// from the rendering, and the tests next door assert them directly.
//
// The payload travels as MIME-keyed strings on the drag transfer, which is what
// lets the same drop resolve identically in all three views: the destination
// re-reads the source entries off the transfer rather than looking them up in
// whichever row list it happens to have. Under the HTML5 transport it is a real
// `DataTransfer`, so the same drag also lands on `onExternalDrop` elsewhere on
// the page, or on another app.

import type { DragTransfer } from '../../../gestures/drag.types';
import type { FileSystemEntry, FileSystemIndex } from '../types/file-system.types';

/** Where the dragged entries ride. Read it back with {@link readFileSystemDragItems}. */
export const FS_DRAG_ITEMS_MIME = 'application/x-file-system-entries';

/**
 * One dragged entry, reduced to what a destination has to know to accept or
 * refuse it: where it is, what it is, and where it already lives.
 *
 * Deliberately not the whole `FileSystemEntry` — the payload crosses a
 * `DataTransfer` as a string, and a destination that needed the entry's metadata
 * to validate a move would be asking the wrong question.
 */
export type FileSystemDragItem = {
  kind: 'file' | 'folder';
  name: string;
  /** Folder the entry currently sits in; `''` for the implicit root. */
  parentPath: string;
  path: string;
};

/** The portable form of an entry, for a drag lifted from it. */
export function fileSystemDragItem(entry: FileSystemEntry): FileSystemDragItem {
  return { kind: entry.kind, name: entry.name, parentPath: entry.parentPath, path: entry.path };
}

/**
 * The portable items for `paths`, resolved against the index, in the order given.
 *
 * A path that resolves to nothing is left out rather than carried as a stub: a
 * selection survives a reload that dropped an entry, and a destination asked
 * whether it accepts something that no longer exists has no honest answer.
 */
export function fileSystemDragItems(index: FileSystemIndex, paths: readonly string[]): FileSystemDragItem[] {
  const items: FileSystemDragItem[] = [];
  for (const path of paths) {
    const entry = index.files.get(path) ?? index.folders.get(path);
    if (entry) items.push(fileSystemDragItem(entry));
  }
  return items;
}

/**
 * The transfer payload for `items`: the entries themselves, plus their names as
 * `text/plain`.
 *
 * The plain-text copy is there because this drag can leave the page. A text
 * editor, another tab or a `drop` listener that has never heard of this component
 * gets something meaningful instead of nothing, and it costs one line.
 */
export function fileSystemDragData(items: readonly FileSystemDragItem[]): Record<string, string> {
  return { [FS_DRAG_ITEMS_MIME]: JSON.stringify(items), 'text/plain': items.map((item) => item.name).join('\n') };
}

/** Narrows parsed JSON to something indexable, so fields read as `unknown`. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDragItem(value: unknown): value is FileSystemDragItem {
  if (!isRecord(value)) return false;
  // Every field is a claim: the payload crossed a `DataTransfer` as text, and it
  // may have been written by something that never heard of this component.
  const { kind, name, parentPath, path } = value;
  return (
    (kind === 'file' || kind === 'folder') &&
    typeof name === 'string' &&
    typeof parentPath === 'string' &&
    typeof path === 'string'
  );
}

/**
 * The entries a transfer carries, or `[]` when it carries none of ours.
 *
 * Total rather than throwing: a zone's `accepts` runs against every drag in the
 * tree, including OS file drags and payloads from other components, and "not ours"
 * has to be an ordinary answer on that path.
 */
export function readFileSystemDragItems(transfer: DragTransfer | null | undefined): FileSystemDragItem[] {
  if (!transfer) return [];
  const raw = transfer.getData(FS_DRAG_ITEMS_MIME);
  if (raw === '') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isDragItem) : [];
  } catch {
    return [];
  }
}

/**
 * Whether moving `item` into `destinationPath` is a move at all.
 *
 * Three things are not: an entry onto itself, an entry into the folder it already
 * sits in, and a folder into its own subtree — the last would reparent a folder
 * under its own child and orphan the branch. Folder paths carry a trailing slash,
 * so the subtree test is a prefix test.
 *
 * The destination is a path rather than an entry because a drop can land on a
 * folder row, a tile, or a whole column in the columns view, and only one of those
 * has a row object behind it.
 */
export function canDropFileSystemItem(item: FileSystemDragItem, destinationPath: string): boolean {
  if (destinationPath === item.path || destinationPath === item.parentPath) return false;
  return !(item.kind === 'folder' && destinationPath.startsWith(item.path));
}

/**
 * The paths a drop into `destinationPath` would actually move, out of everything
 * the drag carries.
 *
 * Each entry stands or falls on its own: a multi-selection can hold entries the
 * destination is already the parent of, alongside others it is not. Returning the
 * survivors — rather than refusing the whole group — is what makes dragging a
 * mixed selection onto a folder do the obvious thing.
 */
export function movableFileSystemSources(items: readonly FileSystemDragItem[], destinationPath: string): string[] {
  return items.filter((item) => canDropFileSystemItem(item, destinationPath)).map((item) => item.path);
}

/**
 * Whether a folder will take this drag at all — the predicate behind both the
 * highlight and the drop, so a folder can never light up and then refuse.
 */
export function acceptsFileSystemDrop(items: readonly FileSystemDragItem[], destinationPath: string): boolean {
  return items.some((item) => canDropFileSystemItem(item, destinationPath));
}

/**
 * The ghost's label: the entry's name for a single drag, a count for a group.
 *
 * A multi-drag has no one name to show, and showing the grabbed entry's alone
 * would misreport what is moving.
 */
export function fileSystemDragLabel(items: readonly FileSystemDragItem[]): string {
  if (items.length === 1) return items[0]?.name ?? '';
  return `${items.length} items`;
}
