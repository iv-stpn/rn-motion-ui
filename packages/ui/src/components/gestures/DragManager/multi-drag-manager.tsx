// A manager whose drags carry a selection rather than one item.
//
// The gap it fills: `<Draggable>` knows what *it* holds, and nothing about the list
// it sits in. So dragging one of three selected rows moves one row — the other two
// stay put, because no single draggable was ever told they existed. Every list with
// multi-select ends up re-deriving the same three things to fix that: which ids a
// lift should carry, one payload built from all of them, and a way for the members
// left behind to know they are moving too.
//
// Those three live here. `<MultiDragManager>` holds the selection and the resolver,
// `<MultiDraggable>` reads them at render time, and the ids in flight come back off
// the active drag's own transfer — so the lifted set is derived from the drag rather
// than tracked alongside it, and stays right on every transport and after a cancel.
//
// It is a `<DragManager>` underneath, with all of its props: zones, isolation,
// groups and the ghost overlay behave exactly the same.

import { type ReactNode, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '../../typography/Text/text';
import { useActiveDrag } from '../use-drag-store';
import { DragManager, type DragManagerProps } from './drag-manager';
import { defaultResolveIds, type MultiDragIdResolver, readMultiDragIds } from './multi-drag';
import { type MultiDragScope, MultiDragScopeContext } from './multi-drag-scope';

// ── Default multi-drag ghost ────────────────────────────────────────────

type DefaultMultiDragGhostProps = { count: number };

/**
 * The ghost drawn when a multi-drag carries more than one item and no
 * `renderPreview` was given — one chip naming the count, because a group
 * has no single name.  Rendered by the `<DragManager>` overlay under pan
 * transports; unused under HTML5, where the browser draws its own image.
 *
 * Kept internal; a consumer that wants different copy or styling passes
 * `renderPreview` to `<MultiDragManager>` instead.
 */
function DefaultMultiDragGhost({ count }: DefaultMultiDragGhostProps) {
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-md border border-border bg-surface-1 px-2 py-1">
      <View className="h-1.5 w-1.5 rounded-full bg-primary" />
      <DefaultMultiDragGhostText count={count} />
    </View>
  );
}

type DefaultMultiDragGhostTextProps = { count: number };

function DefaultMultiDragGhostText({ count }: DefaultMultiDragGhostTextProps) {
  // Template literal is intentional: the count varies per drag.
  return <Text weight="medium" className="text-foreground text-xs">{`${count} items`}</Text>;
}

const defaultRenderPreview = (ids: readonly string[]) => {
  if (ids.length <= 1) return; // let Draggable fall back to children
  return <DefaultMultiDragGhost count={ids.length} />;
};

export type MultiDragManagerProps = DragManagerProps & {
  /**
   * The ids currently selected. Anything iterable — a `Set` you already keep, or an
   * array; it is copied into a `Set` here, so no stable identity is required.
   */
  selectedIds: Iterable<string>;
  /**
   * Which ids a lift of `liftedId` carries. Defaults to {@link defaultResolveIds}:
   * the whole selection when the lifted id is in it, otherwise just that id — which
   * is what a file manager, a mail list and a canvas all want.
   */
  resolveIds?: MultiDragIdResolver;
  /**
   * The payload for the resolved group, MIME key to string. Called once per lift, so
   * it may serialise as much as the group needs.
   */
  getGroupData: (ids: readonly string[]) => Record<string, string>;
  /**
   * The ghost for the resolved group — the place to draw "3 items" rather than one
   * row. Used by the pan transports (touch on web, native); under the HTML5 mouse
   * transport the browser draws its own drag image and this is not consulted.
   */
  renderPreview?: (ids: readonly string[]) => ReactNode;
};

/**
 * A `<DragManager>` whose `<MultiDraggable>` children drag the whole selection.
 *
 * ```tsx
 * <MultiDragManager
 *   selectedIds={selected}
 *   getGroupData={(ids) => ({ 'application/x-rows': JSON.stringify(ids) })}
 *   renderPreview={(ids) => <Chip label={`${ids.length} items`} />}
 * >
 *   {rows.map((row) => (
 *     <MultiDraggable id={row.id} key={row.id}>
 *       <Row row={row} dimmed={useIsLifting(row.id)} />
 *     </MultiDraggable>
 *   ))}
 *   <Dragzone onDrop={({ transfer }) => move(readMultiDragIds(transfer))} />
 * </MultiDragManager>
 * ```
 *
 * Lifting a selected item carries every selected id; lifting an unselected one
 * carries just it and leaves the selection alone. `useIsLifting(id)` tells a member
 * that is not under the pointer that it is nonetheless in flight, which is what
 * fades the rest of the selection while one of them is dragged.
 *
 * The group's ids also travel as {@link MULTI_DRAG_IDS_MIME} on the transfer, so a
 * plain `<Dragzone onDrop>` — or, under the HTML5 transport, a `drop` listener that
 * never heard of this library — can read them back with {@link readMultiDragIds}.
 *
 * **Accessibility.** Same as `<DragManager>`: no semantics of its own, and a drag is
 * pointer-only on every platform. A multi-select drag needs its keyboard equivalent
 * even more than a single one, since the selection it acts on is already reachable
 * without a pointer — a "Move selected to…" command belongs next to the `onDrop`
 * that performs it.
 */
export function MultiDragManager({
  children,
  getGroupData,
  renderPreview,
  resolveIds = defaultResolveIds,
  selectedIds,
  ...managerProps
}: MultiDragManagerProps) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  // The ids in flight, read back off the drag rather than recorded at lift time: a
  // drag that was cancelled, or one lifted by a sibling manager, then needs no
  // cleanup here — the set empties when the drag does.
  const drag = useActiveDrag();
  const liftedIds = useMemo(() => new Set(drag === null ? [] : readMultiDragIds(drag.transfer)), [drag]);

  // The selection is bound in here rather than passed down: a `<MultiDraggable>`
  // asks "what does lifting me carry", and threading the set through every one of
  // them would make each row's data depend on a value only the manager owns.
  const resolve = useCallback((liftedId: string) => resolveIds(liftedId, selected), [resolveIds, selected]);

  const scope = useMemo<MultiDragScope>(
    () => ({
      getGroupData,
      hasManager: true,
      liftedIds,
      renderPreview: renderPreview ?? defaultRenderPreview,
      resolveIds: resolve,
      selectedIds: selected,
    }),
    [getGroupData, liftedIds, renderPreview, resolve, selected],
  );

  return (
    <MultiDragScopeContext.Provider value={scope}>
      <DragManager {...managerProps}>{children}</DragManager>
    </MultiDragScopeContext.Provider>
  );
}
