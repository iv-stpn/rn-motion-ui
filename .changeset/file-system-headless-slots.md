---
'rn-motion-ui': minor
---

feat(ui): `FileSystem` headless header/footer slots + per-region classNames

`renderHeader` and `renderFooter` replace the built-in toolbar and status bar
with your own UI. Each receives the same state the default region renders from,
so a custom header wires navigation, search, sort and filters without
reimplementing any of the logic:

```tsx
<FileSystem
  items={items}
  renderHeader={({ folderName, canGoBack, goBack, searchValue, setSearchValue, layout }) => (
    <MyToolbar … />
  )}
/>
```

The state shapes are exported as `FileSystemHeaderState` and
`FileSystemStatusState`. Both include the responsive hints the built-in header
uses (`layout`, `isCompact`), so a custom region can collapse at the same widths.

For the common case of restyling rather than replacing, four class hooks merge
onto the built-in regions: `headerClassName`, `bodyClassName`, `footerClassName`
and the existing `className`. The two `render*` props take precedence over their
matching `*ClassName`.

Defaults are unchanged — omit everything and the component renders exactly as
before.
