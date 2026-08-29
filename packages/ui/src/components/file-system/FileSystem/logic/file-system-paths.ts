// Pure path helpers. Folder paths are normalized to a trailing slash, file
// paths never carry one, and `''` is the implicit root (never rendered as a row).

type NamedEntry = { name: string };

/** `'a/b'` → `'a/b/'`; `'/'` and `''` → `''` (the root). */
export function normalizeFolderPath(path: string): string {
  if (!path || path === '/') return '';
  return path.endsWith('/') ? path : `${path}/`;
}

/** Leaf name of a path, with the folder trailing slash stripped first. */
export function pathName(path: string): string {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  const separatorIndex = trimmed.lastIndexOf('/');
  return separatorIndex === -1 ? trimmed : trimmed.slice(separatorIndex + 1);
}

/** Parent folder path (always trailing-slashed), or `''` for a top-level entry. */
export function pathParent(path: string): string {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  const separatorIndex = trimmed.lastIndexOf('/');
  return separatorIndex === -1 ? '' : trimmed.slice(0, separatorIndex + 1);
}

/** Lowercased extension without the dot, or `''` when there is none. */
export function fileExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex === -1 ? '' : name.slice(dotIndex + 1).toLowerCase();
}

/** Case-insensitive, natural-order name comparison (Finder's Name column). */
export function compareEntryNames(left: NamedEntry, right: NamedEntry): number {
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
}
