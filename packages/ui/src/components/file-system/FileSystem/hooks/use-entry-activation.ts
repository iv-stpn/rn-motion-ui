// Tap-to-select / tap-again-to-open, the native stand-in for the web version's
// click + double-click pair — plus the two gestures that mean "add this one to
// what I already have": Ctrl/Cmd-click on web, long-press on touch.
//
// The two funnel into the same `additive` modifier, with one deliberate
// difference: a Ctrl/Cmd-click TOGGLES the entry (press it again and it leaves
// the selection), while a long-press only ever JOINS. A hold is how a drag
// grabs the group, so re-holding a selected entry must keep it — the lift
// that follows carries the whole selection, not just the re-held row. Taps
// remain the toggle surface in selection mode (the checkbox rows) and
// Ctrl/Cmd-click the toggle on web; `file-system-selection.ts` owns the
// decision and neither the views nor this hook branch on platform.

import { useCallback, useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import type { FileSystemSelectionMode, FileSystemSelectionModifiers } from '../logic/file-system-selection';
import type { FileSystemEntry } from '../types/file-system.types';

/** A second activation within this window opens instead of re-selecting. */
const DOUBLE_TAP_MS = 400;

/**
 * Read the selection modifiers off a press.
 *
 * Ctrl and Cmd both mean additive: Ctrl is the Windows/Linux binding and Cmd the
 * macOS one, and a component cannot tell which machine the browser is on. (On
 * macOS a Ctrl-click never gets here anyway — the browser turns it into a
 * `contextmenu`, which is what a macOS user means by it.)
 *
 * react-native-web derives `onPress` from the native `click`, so `nativeEvent`
 * is a real MouseEvent carrying the real key state. None of these are ever set
 * on native, where the long-press handler below is the only way in.
 */
function readSelectionModifiers(event: GestureResponderEvent | undefined): FileSystemSelectionModifiers {
  if (!event) return NO_MODIFIERS;
  // biome-ignore lint/plugin: RNW forwards the DOM modifier keys on nativeEvent; RN's types omit them, so a cast is the documented way to read them.
  const native = event.nativeEvent as unknown as { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean };
  return { additive: Boolean(native.ctrlKey || native.metaKey), range: Boolean(native.shiftKey) };
}

const NO_MODIFIERS: FileSystemSelectionModifiers = {};

export type EntryActivation = {
  /**
   * Wire to the entry Pressable's `onPress`.
   *
   * `orderedPaths` overrides the ordering the hook was built with, for a view
   * whose entries are not one list — the columns view hands each pane its own,
   * so a Shift-range runs through the pane the press landed in.
   */
  onPress: (entry: FileSystemEntry, event?: GestureResponderEvent, orderedPaths?: readonly string[]) => void;
  /**
   * The multi-selection join. Pass to `<HoldItem onHold>` when in
   * `multiple` mode — `HoldItem` calls it instead of opening the panel.
   * `undefined` outside `multiple` mode, so the menu keeps the gesture.
   *
   * Additive but add-ONLY: joins the entry to the selection and never removes
   * one, so a re-hold of an already selected entry keeps it selected and a
   * drag lifted off it still carries the whole group. Taps (the checkboxes)
   * and Ctrl/Cmd-click are the removal surfaces.
   */
  onLongPress: ((entry: FileSystemEntry) => void) | undefined;
};

/**
 * Row/tile activation.
 *
 * A plain first press selects, and a second press on the same entry within
 * {@link DOUBLE_TAP_MS} opens it — mouse double-clicks arrive as two presses, so
 * one handler covers web without a separate path.
 *
 * A modified press never opens, and never arms the double-tap either: two
 * Ctrl-clicks on one entry mean "select it, then deselect it", not "open it",
 * and two Shift-clicks are one run being adjusted, not a request to open.
 *
 * @param orderedPaths The view's entries in the order it lays them out — what a
 *                     Shift-range runs through. Omit for a view that hands its
 *                     own ordering in per press (see {@link EntryActivation}).
 */
export function useEntryActivation(
  onOpen: (entry: FileSystemEntry) => void,
  onSelect: (entry: FileSystemEntry | null, modifiers?: FileSystemSelectionModifiers, orderedPaths?: readonly string[]) => void,
  selectionMode: FileSystemSelectionMode,
  orderedPaths?: readonly string[],
): EntryActivation {
  const lastRef = useRef({ at: 0, path: '' });
  // Read through a ref so a re-ordered view (a sort, a folder resolving) does
  // not rebuild every row's press handler.
  const orderedRef = useRef(orderedPaths);
  orderedRef.current = orderedPaths;

  const selectAdditive = useCallback(
    (entry: FileSystemEntry) => {
      lastRef.current = { at: 0, path: '' };
      // addOnly: a hold JOINS the entry to the selection and never removes one —
      // re-holding a selected entry keeps it, so the drag that follows can carry
      // the whole group again. Deselection stays with taps and Ctrl/Cmd-click.
      onSelect(entry, { additive: true, addOnly: true }, orderedRef.current);
    },
    [onSelect],
  );

  const onPress = useCallback(
    (entry: FileSystemEntry, event?: GestureResponderEvent, ordering?: readonly string[]) => {
      const resolved = ordering ?? orderedRef.current;
      const modifiers = readSelectionModifiers(event);
      if (selectionMode === 'multiple' && (modifiers.additive || modifiers.range)) {
        lastRef.current = { at: 0, path: '' };
        onSelect(entry, modifiers, resolved);
        return;
      }
      const now = Date.now();
      const isRepeat = lastRef.current.path === entry.path && now - lastRef.current.at < DOUBLE_TAP_MS;
      lastRef.current = { at: now, path: entry.path };
      if (isRepeat) onOpen(entry);
      else onSelect(entry, undefined, resolved);
    },
    [onOpen, onSelect, selectionMode],
  );

  return { onPress, onLongPress: selectionMode === 'multiple' ? selectAdditive : undefined };
}
