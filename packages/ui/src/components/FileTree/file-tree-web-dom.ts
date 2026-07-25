/** biome-ignore-all lint/style/useExportsLast: exports + module-private helpers interleave by concern */
// Web-only DOM glue for the FileTree. RNW routes taps/long-presses through the
// row Pressable, but right-click, double-click and keyboard navigation never
// reach it — so on web a single container-level delegate handles them and maps
// each event back to a row by the `data-fttree-path` attribute stamped on every
// row's DOM node. All of this is a no-op on native, where the gesture handlers
// on the row Pressable carry every interaction. Kept React-free so it can be
// unit-tested in jsdom; the hook that installs the listeners lives alongside.

import { Platform } from 'react-native';

/** The data-attribute every row's DOM node carries so the delegate can find it. */
export const FILE_TREE_ROW_PATH_ATTR = 'data-fttree-path';

/** The extra props `webRowIdentity` stamps on a row's `<View>` (empty on native). */
type RowIdentityProps = { dataSet?: { fttreePath: string } };

/**
 * Props stamped onto a row's outer `<View>` so its web DOM node can be found by
 * the container delegate. RNW maps `dataSet={{ fttreePath }}` → `data-fttree-path`;
 * that key is absent from RN 0.86's View types, hence the cast. `{}` on native.
 */
export function webRowIdentity(path: string): RowIdentityProps {
  if (Platform.OS !== 'web') return {};
  return { dataSet: { fttreePath: path } };
}

/** Minimal shape of the DOM `Element.closest` chain we walk (jsdom + browser). */
type ClosestTarget = { closest?: (selector: string) => { getAttribute: (name: string) => string | null } | null } | null;

/**
 * Resolve the canonical row path for a DOM event by walking up from its target to
 * the nearest `[data-fttree-path]` ancestor. Returns null when the event did not
 * land on a row (e.g. empty space, the search input).
 */
export function rowPathFromEventTarget(target: unknown): string | null {
  // biome-ignore lint/plugin: DOM event targets are typed `unknown` here; narrowing to the closest-chain shape needs a cast.
  const node = target as ClosestTarget;
  if (!node?.closest) return null;
  const row = node.closest(`[${FILE_TREE_ROW_PATH_ATTR}]`);
  return row?.getAttribute(FILE_TREE_ROW_PATH_ATTR) ?? null;
}

/** Just the shape of the focused row that keyboard resolution depends on. */
type KeyRowContext = { hasChildren: boolean; isExpanded: boolean } | null;

/**
 * What a keydown maps to, resolved purely from the key + the focused row's shape
 * so it can be unit-tested without a controller. The hook translates each action
 * into the matching controller call. Following the ARIA tree keyboard pattern:
 *  - Up/Down (and Left/Right on a leaf) move roving focus one row.
 *  - Right on a collapsed directory expands it; Left on an expanded one collapses.
 *  - Home/End jump to the first/last visible row.
 *  - Enter/Space activate; F2 renames; Escape clears the selection.
 */
export type FileTreeKeyAction =
  | { kind: 'move'; delta: number }
  | { kind: 'edge'; edge: 'first' | 'last' }
  | { kind: 'toggle' }
  | { kind: 'activate' }
  | { kind: 'rename' }
  | { kind: 'clear' };

export function resolveKeyAction(key: string, row: KeyRowContext): FileTreeKeyAction | null {
  switch (key) {
    case 'ArrowDown':
      return { kind: 'move', delta: 1 };
    case 'ArrowUp':
      return { kind: 'move', delta: -1 };
    case 'Home':
      return { kind: 'edge', edge: 'first' };
    case 'End':
      return { kind: 'edge', edge: 'last' };
    case 'ArrowRight':
      return row?.hasChildren && !row.isExpanded ? { kind: 'toggle' } : { kind: 'move', delta: 1 };
    case 'ArrowLeft':
      return row?.hasChildren && row.isExpanded ? { kind: 'toggle' } : { kind: 'move', delta: -1 };
    case 'Enter':
    case ' ':
      return { kind: 'activate' };
    case 'F2':
      return { kind: 'rename' };
    case 'Escape':
      return { kind: 'clear' };
    default:
      return null;
  }
}
