---
"rn-motion-ui": minor
---

**FileSystem: `pinnedAt`, `favoritedAt`, and `renderEntryIcon`.**

Three new capabilities land together because they share the same wiring path through the component tree.

### Pinned entries

Add `pinnedAt` (ISO-8601 string or `null`) to any item and it floats to the top of its parent folder, ahead of every unpinned sibling, regardless of the active sort key or direction. Within the pinned group the chosen sort still applies normally.

```ts
{ kind: 'file', path: 'README.md', pinnedAt: '2026-06-01T00:00:00Z', … }
```

### Favorited entries

Add `favoritedAt` to mark an entry as a favorite. The flag is surfaced visually in every view and is already consumed by search (boosts hits) but does not reorder entries within a folder — that stays the caller's responsibility.

```ts
{ kind: 'file', path: 'Invoice.pdf', favoritedAt: '2026-05-01T00:00:00Z', … }
```

### Visual badges

All four views (list, column, icons, gallery strip) now render a **Pin** badge and a **Heart** badge when the corresponding field is set:

- List and column: inline icons flanking the entry name.
- Icons tile: inline in the label chip, tinted to match the selection state.
- Gallery strip: absolute badges pinned to the tile corners, with a translucent halo for readability over thumbnails.

### `renderEntryIcon`

Pass a renderer to substitute a custom icon for any entry. The component falls back to its default glyph when the callback returns `null` or `undefined`, so partial overrides work without branching on every entry type.

```tsx
<FileSystem
  renderEntryIcon={(entry, size) => {
    if (entry.kind === 'folder' && entry.path.startsWith('Archive/'))
      return <ArchiveIcon size={size} />;
  }}
  …
/>
```

The prop is forwarded into every view context — icons, list, column, gallery strip — so one callback covers the whole component.

---

All three additions are purely additive. Existing items without `pinnedAt` or `favoritedAt` render exactly as before, and `renderEntryIcon` is optional.
