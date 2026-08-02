---
"rn-motion-ui": minor
---

**FileSystem: search results always say where they live, and show what matched.**
Three changes to the flat result list a query swaps the view for.

Every row now carries its folder trail, root included. It used to drop the second
line for a hit sitting at the top level, which meant the one thing a result list
is scanned for — where each match lives — was answered for some rows and not
others. The trail is now always there, and the root segment is named rather than
implied.

That name is the new `rootLabel` prop:

```tsx
<FileSystem items={items} title="Files" rootLabel="My Drive" />
```

It defaults to `title`, so nothing changes unless you set it. It also names the
leading segment of the breadcrumb bar under the header, which previously always
used `title` — one prop for how the root reads in a trail, with `title` left as
the header's own name.

**Whatever matched is highlighted**, in the name and in the trail both — a folder
can be the reason a row is in the list at all, since its own name matching is
what puts it there. Every occurrence is marked, case-insensitively, the label's
own casing is untouched, and a label the query matches end to end is marked
whole.

**The trail separator is a caret, not a slash.** `Files › invoices › 2024` rather
than `invoices/2024` — it reads as a trail rather than as a path to copy, and it
matches the chevrons the breadcrumb bar above already uses.

One note for tests. Highlighting splits a matched label across nested nodes, and
testing-library's `getByText` reads a single node's own text — so
`getByText('Q1-report.pdf')` no longer finds a search result row whose name the
query matched. Query the row by its entry test id instead, which is stable across
every view:

```tsx
// `<root testID>-entry-<path>`, or `file-system-entry-<path>` untagged
const row = await canvas.findByTestId('file-system-entry-Reports/Q1-report.pdf');
expect(row).toHaveTextContent('Files › Reports');
```

`toHaveTextContent` reads the whole subtree, so it sees through both the
highlight spans and the trail separators. Rows outside a search are unaffected —
nothing is split when there is no query.
