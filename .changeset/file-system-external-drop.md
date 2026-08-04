---
"rn-motion-ui": minor
---

**FileSystem**: `onExternalDrop` — accept a drop from outside the component.

`onMove` covers dragging entries around inside the browser. It has nothing to say
about a file dragged in from the OS, or a chip dragged from elsewhere on the page.
`onExternalDrop` is that second half, and it hands you the raw transfer rather
than trying to interpret it:

```tsx
<FileSystem
  entries={entries}
  onExternalDrop={({ dataTransfer, destination }) => {
    for (const file of dataTransfer.files) upload(file, destination);
  }}
/>
```

`destination` is the folder the drop landed in, with a trailing slash; `''` is the
implicit root. Read `dataTransfer.files` for OS files or
`dataTransfer.getData(mime)` for data another element set in its `dragstart`. The
component never inspects the transfer, so any MIME the browser will carry works.

Passing the prop is what arms it — the file area accepts external drags and shows
a dashed drop-zone overlay while one hovers. Leave it out and nothing binds.

The list and columns views resolve the pointer to a row on every `dragover`, so a
folder row under the cursor takes the drop and gets the same per-row highlight an
internal drag draws. A file row, the padding, or empty space falls back to the
open folder and the background overlay. Icons and gallery take the background
overlay for the whole area.

Web only, and a no-op on native: the HTML5 drag API this rides on
(`dragenter`/`dragover`/`dragleave`/`drop`) does not exist there. New type:
`FileSystemExternalDropEvent`.
