// The pinned-ancestor overlay. As the list scrolls, the ancestor directory rows
// of the top visible row pin to the top of the viewport (VS Code / Finder-style
// "breadcrumb" headers). The stack + push transition are computed purely by
// `computeStickyHeaders`; this component only lays the resulting rows out.
//
// Each header is an opaque copy of a row already in the FlatList beneath it —
// it reuses the parent's row builder (via `renderRow`) so a pinned header stays
// fully interactive (tap to collapse, long-press for actions) and looks
// identical to its scrolled twin. The deepest header is shoved up by
// `transition` px as the next section arrives; shallower headers paint on top
// (higher zIndex) so the departing one slides away behind them, and the
// container clips it. Non-interactive gaps let taps fall through to the list.

import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { FileTreeVisibleRow } from './file-tree.types';

export type FileTreeStickyHeadersProps = {
  /** Ancestor rows to pin, shallow→deep (from `computeStickyHeaders`). */
  headers: FileTreeVisibleRow[];
  /** How far (px) the deepest header is pushed up by the arriving section. */
  transition: number;
  /** Uniform row height — each header occupies exactly one row slot. */
  itemHeight: number;
  /** The parent's row builder, so a pinned header renders like its twin. */
  renderRow: (row: FileTreeVisibleRow) => ReactNode;
};

/**
 * Absolute overlay of pinned ancestor rows. Renders nothing when the stack is
 * empty. Each header sits at `slot * itemHeight`; the deepest is translated up
 * by `transition`. Shallower headers get a higher `zIndex` so the departing
 * deepest slides away behind them, and the clipped container hides the overflow.
 */
export function FileTreeStickyHeaders({ headers, transition, itemHeight, renderRow }: FileTreeStickyHeadersProps) {
  if (headers.length === 0) return null;
  const deepest = headers.length - 1;
  return (
    <View
      className="absolute top-0 right-0 left-0 overflow-hidden"
      style={{ height: headers.length * itemHeight, zIndex: 2 }}
      pointerEvents="box-none"
    >
      {headers.map((row, slot) => (
        <View
          key={row.path}
          className="absolute right-0 left-0 bg-surface-2"
          style={{
            top: slot * itemHeight,
            height: itemHeight,
            zIndex: headers.length - slot,
            transform: slot === deepest ? [{ translateY: -transition }] : undefined,
          }}
        >
          {renderRow(row)}
        </View>
      ))}
    </View>
  );
}
