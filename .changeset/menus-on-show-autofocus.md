---
'rn-motion-ui': patch
---

feat(menus): expose a uniform `onShow` signal so overlays can autofocus content

A `TextInput` with `autoFocus` inside a Modal-based overlay never received
keyboard focus on iOS: `autoFocus` fires `becomeFirstResponder` at mount, before
the modal's separate window is presented, so the focus request is silently
dropped. Every menu/overlay component now exposes an `onShow` prop — fired from
iOS `Modal.onShow` after presentation — so a consumer can focus a ref'd element
at the correct moment:

```tsx
<MorphingModal onShow={() => inputRef.current?.focus()}> … </MorphingModal>
```

A new `useAutoFocusOnShow(ref)` hook pairs a ref with the signal, returning
`{ onShow, focusOnShow }`. The morphing shells (`MorphingModal`) defer their
`onShow` until content has measured to a non-zero height, so the zero-height
clip can't swallow the focus request. Web is unaffected — there is no separate
modal window, so plain `autoFocus` still works and the hook degrades to a no-op.
