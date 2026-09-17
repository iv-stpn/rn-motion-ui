/**
 * multi-step-menu.logic — the pure path/navigation semantics for MultiStepMenu,
 * kept out of the component so the section-tree walk and the direction decision
 * are unit-testable and reusable by other step-tree surfaces.
 */

/** The minimal node shape `resolveSection` walks: a path and optional children. */
type SectionNode<T> = { path: string; subsections?: T[] };

/**
 * Walks `path` through the section tree, matching each segment among the current
 * level's siblings. Returns the deepest matched section, or `null` when any
 * segment is missing — an empty path resolves to `null` too (there is no root
 * section; the root is the section list itself).
 */
export function resolveSection<T extends SectionNode<T>>(sections: T[], path: string[]): T | null {
  let nodes = sections;
  let match: T | null = null;
  for (const segment of path) {
    const found = nodes.find((s) => s.path === segment);
    if (!found) return null;
    match = found;
    nodes = found.subsections ?? [];
  }
  return match;
}

/**
 * Whether a path change slides forward (into a deeper or equal path) or backward
 * (up a level). An equal-length change reads as forward — a sibling swap replaces
 * the current pane in the forward direction.
 */
export function computeDirection(current: string[], next: string[]): 'forward' | 'backward' {
  if (next.length < current.length) return 'backward';
  return 'forward';
}
