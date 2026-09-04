import { type RefObject, useCallback } from 'react';

/** Anything with an imperative `focus()` — a `TextInput`, a focused `Pressable`. */
type Focusable = { focus: () => void };

/** The focus signals the hook returns — pass `onShow` to a menu's `onShow` prop. */
type AutoFocusOnShow = {
  /** Pass directly to a menu's `onShow` prop. */
  onShow: () => void;
  /** Focus the ref'd element now (e.g. outside the on-show flow). */
  focusOnShow: () => void;
};

/**
 * Pairs a ref with a menu's `onShow` signal so the ref'd element is focused only
 * after the overlay has fully presented.
 *
 * On iOS, `autoFocus` calls `becomeFirstResponder` when a `TextInput` *mounts* —
 * inside a `Modal` that happens before the modal's own window is presented, so
 * the focus request is silently dropped and the keyboard never appears.
 * `Modal.onShow` fires after presentation, which is the correct moment. This hook
 * turns that signal into a focus call, so a consumer writes:
 *
 * ```tsx
 * const inputRef = useRef<TextInput>(null);
 * const { onShow } = useAutoFocusOnShow(inputRef);
 * <MorphingModal onShow={onShow}>
 *   <TextInput ref={inputRef} />
 * </MorphingModal>
 * ```
 *
 * The morphing shells (`MorphingModal` / `MorphingMenu`) delay their own `onShow`
 * until the content has measured to a non-zero height, so the ref is already laid
 * out by the time this fires. On web there is no separate modal window — `onShow`
 * never fires and plain `autoFocus` already works — so this is inert there.
 */
export function useAutoFocusOnShow(ref: RefObject<Focusable | null>): AutoFocusOnShow {
  const focusOnShow = useCallback(() => {
    ref.current?.focus();
  }, [ref]);

  return { onShow: focusOnShow, focusOnShow };
}
