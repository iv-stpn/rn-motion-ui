// Middle-truncation split. RN has no reliable CSS "ellipsis in the middle" for
// a flex-shrinking label, so we split the name into a shrinking head (ellipsized
// at its end) and a pinned tail that always shows the file extension (and,
// optionally, a few trailing basename chars). Pure + RN-free.

/**
 * The file extension of a leaf name, including the leading dot, or `''`.
 * Dotfiles (`.env`) and extensionless names return `''`.
 */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot);
}

export type MiddleTruncationSplit = {
  /** Leading part; the renderer lets this shrink and ellipsizes its end. */
  head: string;
  /** Trailing part pinned visible (at least the extension). */
  tail: string;
};

/**
 * Split `name` so the tail always retains the extension (plus up to
 * `tailLength` total trailing chars). When the name is short enough that a split
 * would be pointless, the whole name stays in `head` and `tail` is empty.
 */
export function splitForMiddleTruncation(name: string, tailLength = 0): MiddleTruncationSplit {
  const ext = fileExtension(name);
  const minTail = Math.max(ext.length, tailLength);
  // Nothing worth pinning, or the tail would swallow the whole name.
  if (minTail === 0 || minTail >= name.length) return { head: name, tail: '' };
  const cut = name.length - minTail;
  return { head: name.slice(0, cut), tail: name.slice(cut) };
}
