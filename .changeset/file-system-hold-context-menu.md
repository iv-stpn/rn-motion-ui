---
"rn-motion-ui": minor
---

**FileSystem**: context menus now use `HoldContextMenu` throughout — the same interaction the rest of the app uses.

Every entry long-press opens a `HoldContextMenu` panel instead of the previous custom modal. The background long-press (empty space in list/icons views and the empty-folder placeholder) does the same. On web the right-click path was already correct; this change brings native into line with it.

**Breaking changes**

`FileSystemProps.contextMenuWideBreakpoint` is removed. The breakpoint that switched the old modal into a sidebar is no longer meaningful — `HoldContextMenu` handles its own sizing, and the panel never needed a sidebar mode. Remove the prop from any `<FileSystem>` usage.

`FileSystemContextMenuProvider` is no longer exported from this package. It was an internal implementation detail of the old modal approach. If you imported it directly, remove the import; the context menu is now self-contained inside each entry row.

**HoldContextMenu: new `trigger="passive"` mode with controlled `open`/`onOpenChange`**

When the host needs to control exactly when the menu opens — for example, a button that calls `setOpen(true)`, or an entry row that already owns the long-press gesture — set `trigger="passive"`:

```tsx
const [open, setOpen] = useState(false);

<HoldContextMenu items={items} open={open} onOpenChange={setOpen} trigger="passive">
  <Pressable onPress={() => setOpen(true)}>
    <Text>Open menu</Text>
  </Pressable>
</HoldContextMenu>
```

`trigger="passive"` skips `HoldContextMenu`'s own `Pressable` wrapper entirely; the host renders whatever gesture target it needs inside. The web `contextmenu` listener (right-click / Shift+F10) remains active so keyboard users still reach the panel without extra wiring.
