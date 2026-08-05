---
"rn-motion-ui": patch
---

fix(FileSystem): list-view width init, external drop indicator, and store refactors

- Initialize `width` state to `null` instead of `0` in `FileSystemListView` — distinguishes "not yet measured" from a genuine zero, so `showDate` defaults to visible and the date column no longer flickers on mount at wide breakpoints.
- Replace the two conditional external-drop JSX branches with an `ExternalDropIndicator` component that encapsulates the folder-row vs. full-area fallback logic.
- Use `rowsRef.current.length` directly in `hitTest` and remove the now-redundant `rowCountRef`.
- Split react-native mixed `import` into a `import type` block + a value import block.
- Extract `resolveFolderName` helper in `file-system-context.tsx` — eliminates four identical inline ternaries that computed the current folder display name.
- Extract `historyStep` helper — `goBack` and `goForward` were duplicating the same nav/search/entries recompute patch; both now delegate to a single function.
- Add result-caching to `computeFileTypeOptions` keyed on index identity — the walk-and-sort runs once per index change instead of once per store action.
- Use `cancelSearchDebounce()` consistently in `setSearchInput` instead of a direct `clearTimeout`.

fix(MultiStepMenu): reduce sidebar divider from `border-r-2` to `border-r`
