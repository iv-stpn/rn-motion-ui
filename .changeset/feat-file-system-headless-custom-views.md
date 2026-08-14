---
"rn-motion-ui": minor
---

**FileSystem: headless views + custom views**

The view switcher left the default header, and views are now a consumer-extensible concern:

- **Custom views** — the new `views` prop maps a view id to a component handed the full `FileSystemViewProps` contract; a key that matches a built-in (`icons`/`list`/`columns`/`gallery`) replaces it, any other id becomes a first-class view.
- **View-switching API** — `useFileSystemView()` and `useFileSystemViewActions()` (`setView`) let a consumer's own header switch views; the `renderHeader` slot still receives `view`/`setView`.
- **Removed built-in switcher** — the header no longer renders the four-tab / dropdown switcher; view switching is the consumer's UI now (`view`/`setView` via `renderHeader` or the hooks).
- **Restructured internals** — `FileSystem/` is split into `views/`, `logic/`, `store/`, `hooks/`, `types/`, `shell/` subfolders; the public surface is unchanged.
