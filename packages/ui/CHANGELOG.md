# rn-motion-ui

## 5.0.1

### Patch Changes

- Updated dependencies [646025b]
  - rn-motion-ui-icons@0.0.2

## 5.0.0

### Major Changes

- 44a0672: **FileSystem**: drag and drop now runs on `Draggable`/`Dragzone`/`MultiDragManager`.

  Every view had brought its own drag. The list and icons grids shared one hook, the
  columns pane had a second one that mirrored its architecture, web had a third for
  the HTML5 half and external drops a fourth — five hooks, each measuring boxes,
  hit-testing points and tracking a session, and each with its own idea of which
  folder a release belonged to. Adding a view meant writing a sixth.

  They are gone, replaced by the components the library already ships. An entry is a
  `<MultiDraggable>`, a folder is a `<Dragzone>`, and the panes and the background are
  zones too — so the ladder a drop falls down (entry, then the column under it, then
  the open folder) is expressed as zone priority rather than as branches inside a
  resolver. `props` are unchanged: `draggable`, `onMove` and `onExternalDrop` mean
  exactly what they did.

  What changes is behaviour that used to differ per view, and now cannot:

  - **The three draggable views drag identically** — list, icons and columns — because
    none of them implements dragging any more. They resolve a drop through one hit
    test rather than three that agreed by hand.
  - **A multi-select drag carries the selection**, via `MultiDragManager`: drag one of
    three selected rows and all three move. The members left behind fade, and lifting
    an unselected entry still moves just it.
  - **Autoscroll while dragging near an edge** now works in the columns panes too,
    each scrolling on its own, where before only the list and icons grid had it.
  - **A drop is resolved from measured boxes**, so a touch pan and a mouse drag land
    on the same folder. Previously the web path read the DOM `drop` target and the
    pan path hit-tested rows, which could disagree at a row boundary.

  Two fixes fall out of the same work:

  - **`onExternalDrop` now fires for an in-library `<Draggable>` from elsewhere on the
    page**, not just for an OS file drag. Its documented contract always covered "a
    custom element on the page that sets drag data"; a payload with no FileSystem
    entries in it is foreign whether or not this library started the drag, and it
    reaches the consumer either way.
  - **The hover highlight stands down for the length of a drag**, in the list, icons
    and columns views alike, so it cannot mark one cell while a zone outlines
    another. It comes back on the first pointer move after the drop. A mouse drag is
    an HTML5 drag and the browser stops the pointer stream while one runs, so the
    highlight now takes the lift itself as its cue rather than waiting for a
    `pointercancel` that not every engine sends.

  `FS_DRAG_CONTAINER_TEST_ID` still names each draggable view's scroll surface, and
  every entry answers to `<root>-entry-<path>` in all four views. The internal hooks
  `useFileSystemDrag`, `useFileSystemColumnsDrag`, `useFileSystemIconsDrag`,
  `useFileSystemDragWeb` and `useFileSystemExternalDrop` are deleted; none was
  exported from the package.

- 706dac3: **Breaking**: `rn-motion-ui/icons` is gone. Icons live in `rn-motion-ui-icons`.

  The 109 icons this package used to re-export were a subset of Lucide,
  hand-picked because each one had to be committed as generated source. That is a
  bad deal for a consumer: the icon you want is either in that list or it does not
  exist for you, and the list only grew when a component here happened to need
  something.

  `rn-motion-ui-icons` replaces it with the whole MingCute set — 3335 icons, one
  subpath each. Every icon this package renders internally now comes from there,
  so what components use and what you can use are the same set.

  ```diff
  -import { Check, ChevronRight } from 'rn-motion-ui/icons';
  +import { CheckLine } from 'rn-motion-ui-icons/icons/check-line';
  +import { RightLine } from 'rn-motion-ui-icons/icons/right-line';
  ```

  `IconProps` moved too, and is no longer exported from this package at all:

  ```diff
  -import type { IconProps } from 'rn-motion-ui/icons';
  +import type { IconProps } from 'rn-motion-ui-icons/icon-props';
  ```

  Install it alongside this package — `rn-motion-ui` depends on it, so anything
  that takes an icon (`ThemedIcon`, `CommandIcon`, `BloomIcon`, `FileSystem`'s
  action icons) is already typed against the new `IconProps` and needs no change
  beyond the import.

  **`strokeWidth` is gone from `IconProps`.** Lucide's geometry is stroked and
  took a width; MingCute ships fill and stroke variants with the weight baked into
  the path, so there is nothing to widen. Drop the prop — it is a type error now.
  Where this package passed `strokeWidth={2.5}` for a slightly heavier check
  (`Input`, `OTPInput`, `StatefulButton`, `AnimatedBadge`), those icons now render
  at MingCute's own weight, which is a visible but deliberate change.

  Names do not carry over: MingCute names its own icons, and most differ from
  Lucide's. Every icon is suffixed `-line` or `-fill` (1667 line, 1668 fill), and
  the component name is the PascalCase of the file — `icons/check-line` exports
  `CheckLine`. The mapping used for the internal migration, if you were relying on
  the same names:

  | was (Lucide)                            | now (MingCute)                                             |
  | --------------------------------------- | ---------------------------------------------------------- |
  | `AlertCircle`, `Info`                   | `icons/information-line` → `InformationLine`               |
  | `AlertTriangle`                         | `icons/alert-line` → `AlertLine`                           |
  | `Check`                                 | `icons/check-line` → `CheckLine`                           |
  | `ChevronDown` / `Up` / `Left` / `Right` | `icons/down-line` / `up-line` / `left-line` / `right-line` |
  | `Circle`                                | `icons/round-line` → `RoundLine`                           |
  | `FileText`, `ScrollText`                | `icons/file-line` → `FileLine`                             |
  | `FolderClosed`, `FolderKanban`          | `icons/folder-line` → `FolderLine`                         |
  | `GripVertical`                          | `icons/dots-vertical-line` → `DotsVerticalLine`            |
  | `LoaderCircle`                          | `icons/loading-line` → `LoadingLine`                       |
  | `MoreHorizontal`                        | `icons/more-1-line` → `More1Line`                          |
  | `Plus`                                  | `icons/add-line` → `AddLine`                               |
  | `Trash2`                                | `icons/delete-2-line` → `Delete2Line`                      |
  | `User`                                  | `icons/user-2-line` → `User2Line`                          |
  | `X`                                     | `icons/close-line` → `CloseLine`                           |

  The rest resolve the same way: kebab-case the concept, add `-line` or `-fill`,
  and the export is its PascalCase.

### Minor Changes

- a4e9e3e: **AdaptiveDropdown**: rename `headerRight` → `headerSuffix`, remove `showClose` prop; simplify header layout (no fixed height, no border, no built-in close button).

  **BottomSheet**: increase top corner radius to `rounded-t-2xl`.

- 99e42b1: **Breadcrumbs: new component — the trail FileSystem already drew, now its own.**

  A breadcrumb trail: the levels above the current one, each a way back, with the
  current one as plain text at the end. It knows nothing about what a level _is_ —
  pass the segments outermost-first and read back the pressed `id`, so a folder
  path, a route key and a wizard step are all the same thing to it.

  ```tsx
  import { Breadcrumbs } from "rn-motion-ui/breadcrumbs";

  <Breadcrumbs
    items={[
      { id: "", label: "Files" },
      { id: "documents", label: "Documents" },
      { id: "documents/reports", label: "Reports" },
    ]}
    onNavigate={navigateTo}
  />;
  ```

  A deep trail scrolls horizontally by default, keeping one line. Set `maxVisible`
  instead to hold it to a fixed number of levels: the middle folds behind a `…`
  that says how much it hides and hands those levels back when pressed, so nothing
  becomes unreachable. `scrollable={false}` wraps instead of scrolling.

  The rest of the surface: `separator` replaces the chevron with any node, `size`
  picks the text scale (`'sm'` | `'base'`) and takes the separator and icons with
  it, an `icon` per item rides ahead of its label, and `currentId` picks which level
  is the destination — `null` makes every level pressable, for a trail whose leaf is
  not where you are. `className`, `contentClassName` and `itemClassName` reach the
  container, the segment row and each segment.

  Accessibility: the container is a `list` named `Breadcrumb`, every earlier level
  is a `button` named `Go to {label}` (override per item with `accessibilityLabel`),
  and the current level is text — being the one unpressable segment is what marks
  it as current. RN has no `aria-current`, so the trail does not claim one.

  **`FileSystem` now renders this component** instead of its own private trail. No
  API change and no visual change: same placement under the header, same hiding at
  the root, same `rootLabel` as the leading segment, and the same `Go to {label}`
  names its stories already query. Both trails — the bar and the per-row ones under
  search results — are now built from one `buildCrumbs`.

- ae616b8: `Card`: pass `onPress` and the surface becomes pressable

  A card that stands for something you can open had to be wrapped in a `Pressable`
  by hand, which meant a second element around the one that already draws the
  frame. Give `Card` an `onPress` and it renders as the `Pressable` itself:

  ```tsx
  <Card elevation={2} onPress={() => open(project.id)}>
    <Text>{project.name}</Text>
  </Card>
  ```

  Omit it and nothing changes — the card is the plain `View` it always was, with no
  press responder in the tree. The size, elevation and `className` handling are the
  same either way.

- 92504b5: **Dragzone, DragManager**: the receiving half, so a drag can mean something.

  `Draggable` could carry a payload but had nowhere to put it: you got points in
  window coordinates and wrote the hit testing yourself, per screen, per platform.
  Two components close that, and they compose rather than nest — a source and a
  zone find each other through one module-level store, so a pair of them works with
  no provider anywhere above:

  ```tsx
  <Draggable data={{ 'application/x-card': card.id }} groups={['cards']}>
    <Card {...card} />
  </Draggable>

  <Dragzone groups={['cards']} overClassName="border-info bg-info/10" onDrop={({ transfer }) => move(transfer.getData('application/x-card'))}>
    <Column />
  </Dragzone>
  ```

  `groups` is the whole compatibility mechanism, and eligibility and acceptance are
  one predicate rather than two: the same check that lights a zone up decides whether
  it takes the release, so a zone cannot highlight and then refuse. `accepts` gets
  the last word for a rule only the payload knows, `disabled` removes a zone from
  the decision entirely, and `eligibleClassName`/`overClassName` — or the render-prop
  form, `{(state) => …}` — handle the affordance without a state machine of your own.

  **One authority on both platforms.** Zones publish their measured boxes to the
  store and the store hit-tests points against them, so a native pan and a browser
  drag resolve a drop through the same code. Overlap is settled without
  configuration: explicit `priority`, then nesting depth, then the smaller box, then
  mount order — which is what makes a trash can inside a board work with neither
  side declaring anything. `priority` is there for when the geometry does not say
  what you meant.

  `<DragManager>` is optional, and adds the four things that need a _place_ in the
  tree to mean anything: a default group for its whole subtree, a boundary drags
  cannot cross (`isolate`), a frame to draw the ghost in that survives a clipping
  ancestor, and one vantage point to observe every drag beneath it from —
  `onDragStart`/`onDragMove`/`onDragEnd`/`onDrop` cover the subtree, not just the
  children you can point at. Managers nest by publishing a path of ids rather than
  by stacking providers, so an inner board isolates from an outer one without either
  knowing the other exists, and a zone mounted through a portal or on another screen
  stays reachable as long as no isolating manager sits between.

  **The payload is readable for the whole drag**, which on web it is not by default.
  The DOM drag data store is _protected_ on every event between `dragstart` and the
  drop — `types` still lists the formats, `getData` returns `''`, a privacy rule so a
  page cannot read what is merely being dragged across it — and that applies to the
  source's own listeners too, `dragend` included. So a zone asking `accepts` what is
  coming, or an `onDrop` reading it out, would get nothing under a real mouse drag.
  The transfer handed to every callback is therefore a readable mirror, snapshotted
  at lift while the store still answers, with writes going through to the browser's
  own so a format added mid-drag still crosses to a plain `drop` listener.

  **External drags.** `acceptsExternal` lets a zone take a payload the library never
  saw start — OS files, another tab — arriving as `drag: null`, `external: true`, and
  `files` on the event. Off by default, because a zone that has not asked for files
  should not swallow the page's own drop handling.

  Two subscription channels keep the cost honest: render-visible state (a drag
  starting, a zone edge crossed, a drag ending) goes through `useSyncExternalStore`,
  while pointer movement goes to a separate move channel that no component re-renders
  for. Travelling inside one zone publishes nothing at all.

  Both are pointer-only, on every platform. A manager is the natural home for the
  non-pointer path the same outcome owes its users, since it already sees every drop.

  `Draggable`, `Dragzone` and `DragManager` now live under a `gestures` category —
  `rn-motion-ui/draggable` is unchanged, and the store and its hooks are exported at
  `rn-motion-ui/drag-store` and `rn-motion-ui/use-drag-store` for custom transports
  or zones. New types: `DragzoneProps` and `DragManagerProps` from their own
  subpaths, and — from `rn-motion-ui/drag-types` — `DragzoneHandle`,
  `DragzoneRenderState`, `DragzoneDropEvent`, `DragzoneAcceptEvent`,
  `DragManagerHandle`, `DragManagerEvent`, `ActiveDrag`, `DragSnapshot`,
  `DragEndOutcome`.

- b7ea1df: **Draggable**: one grab-and-carry wrapper for web and native.

  Making something draggable meant writing the platform down. On web you set
  `draggable` on a DOM node and ride the HTML5 events — and under
  react-native-web you cannot even do that from JSX, because `View` drops unknown
  HTML attributes, so it took a `useEffect` reaching for `ref.current` as an
  `HTMLElement`. On native there is no such API at all, so you wired a pan gesture
  by hand. `Draggable` is that work done once:

  ```tsx
  <Draggable
    data={{ "application/x-my-item": JSON.stringify(item) }}
    effectAllowed="copy"
    onDragEnd={({ canceled, transfer }) => {
      if (!canceled) console.log(transfer.getData("application/x-my-item"));
    }}
  >
    <Chip label={item.name} />
  </Draggable>
  ```

  `data` is a MIME-keyed payload, written into the transfer when the drag starts.
  `onDragStart`/`onDragMove`/`onDragEnd` fire the same shapes on both platforms,
  with points in window coordinates.

  Three transports sit behind that one contract, each the one actually native to
  where it runs. A mouse on web rides a real HTML5 drag rather than a synthesized
  one, and hands the browser's own `DataTransfer` straight through — which is what
  makes the payload cross to code that has never heard of this component: an
  existing `dragover`/`drop` listener, or `<FileSystem onExternalDrop>`, receives
  these drags with no adapter. Touch on web gets a pointer-driven pan instead,
  because mobile browsers fire no HTML5 drag for touch at all and the component
  would otherwise simply not work on a phone. Native arms an RNGH pan. Both pans
  wait out a 300ms hold, matching the context-menu hold so the two never both fire,
  and draw a ghost that follows the finger. `transports` pins the choice when you
  need to: `'pan'` keeps a drag inside the library with a uniform ghost and no OS
  drag session, `'html5'` opts a component out of touch dragging.

  `onDragEnd` reports the platform's verdict instead of guessing: `dropEffect` is
  what a zone claimed, and `canceled` is `dropEffect === 'none'` on both sides. A
  native zone claims a drag exactly as a browser one does, by writing
  `transfer.dropEffect` while the drag is over it.

  The ref is a `DraggableHandle`: `isDragging()`, `getTransfer()`, `getNode()`,
  `measure()` (a promise on both platforms, since native's `measureInWindow` is
  callback-based), and `cancel()`. `cancel()` is honestly partial on web — once the
  browser owns a drag, only the user can end it, so it clears component state and
  the store's session while the browser's drag image keeps following the cursor.

  `groups` names what this drag is, and a `<Dragzone>` takes it when their labels
  intersect — omit them on both sides and everything matches everything, which is
  the right default for a tree with one kind of drag in it. See the drag system
  changeset for the receiving half.

  A drag is pointer-only on both platforms, so anything expressed only as a drag
  needs a second non-pointer path to the same outcome. New types:
  `DraggableProps`, `DraggableTransports`, `DraggableHandle`, `DragTransfer`,
  `DragStartEvent`, `DragMoveEvent`, `DragEndEvent`, `DragPoint`, `DragRect`,
  `DragDropEffect`, `DragEffectAllowed`, `DragGroups`.

- 072fe70: **FileSystemColumnsView**: cross-column drag and drop.

  `draggable` and `onMove` now work in the columns view as they do in the others:
  an entry can be dragged across panes and dropped on any valid folder, or on a
  column's own background to land in the folder that pane is showing. A ghost chip
  tracks the pointer, and the receiving row — or the whole pane, for a drop on its
  background — outlines itself.

  - Geometry constants `COLUMN_ROW_HEIGHT`, `COLUMN_ROW_STRIDE`, `COLUMN_PADDING`
    and the `columnRowHitAt` hit-test helper are exported from
    `file-system-column`, shared with the marquee and hover resolvers.
  - `FS_DRAG_CONTAINER_TEST_ID` gains a `column` key.

- e86dced: **FileSystem**: `onExternalDrop` — accept a drop from outside the component.

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

- d6b0d95: **FileSystem: filtering goes headless, and the browser gets breadcrumbs and a
  real search view.** The component used to own its own toolbar: a sort select, a
  filter menu, a Finder-style search field that collapsed to a button at narrow
  widths, a row of filter pills beneath the header, and the date-range modal the
  filter menu raised. All of it is gone. What stays is the pipeline behind it —
  search, sort, file-type and date filtering, custom ranges — now reachable
  through a `renderFilters` slot that hands you every action and no markup.

  ```tsx
  <FileSystem
    items={items}
    renderFilters={({
      searchValue,
      setSearchValue,
      fileTypeOptions,
      toggleFileType,
      count,
    }) => (
      <MyFilterBar
        count={count}
        onSearch={setSearchValue}
        onToggleType={toggleFileType}
        search={searchValue}
        types={fileTypeOptions}
      />
    )}
  />
  ```

  The header keeps back/forward, the folder name and the view switcher.

  Migrating:

  | Before                                                                                                                         | Now                                                                                                  |
  | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
  | built-in search field, sort select, filter menu and filter pills                                                               | supply them through `renderFilters`, or ship no filter UI at all                                     |
  | `FileSystemHeaderState.isSearchExpanded` / `setSearchExpanded`                                                                 | gone — the collapse-to-a-button behaviour was the built-in field's, and there is no built-in field   |
  | `renderHeader` receiving `filters`, `fileTypeOptions`, `toggleFileType`, `selectDatePreset`, `openCustomRange`, `clearFilters` | those moved to `renderFilters`; `renderHeader` keeps navigation, view, sort and the raw search value |
  | `openCustomRange(type)`, which raised the built-in date-range modal                                                            | `applyCustomRange(type, from, to)` — bring your own picker, hand the two ends over                   |

  `renderFilters` gets everything the old toolbar drove — `searchValue` /
  `setSearchValue`, `sort` / `setSortKey`, `filters`, `fileTypeOptions`,
  `toggleFileType`, `selectDatePreset`, `applyCustomRange`, `clearFilters`,
  `hasActiveFilters`, `isSearching` — plus `count`, the visible entry count after
  search and filtering. Omit the prop and no filter row renders.

  Headless goes all the way down: the date-range modal the filter menu used to
  raise is gone too, so the component now ships no filter UI whatsoever. Dates come
  in through `selectDatePreset(type, preset)` for a relative cutoff (`'1 week ago'`
  and friends) or `applyCustomRange(type, from, to)` for two explicit ends, which
  is where your own calendar hands off.

  Each active filter carries an `id`, and three actions take one: `setFilterOperator`
  negates a row, `setFilterDatePreset` re-values a date row, and `removeFilter`
  drops it. That's what a filter-pill UI needs to reach one row without rebuilding
  the rest — previously only `clearFilters` was reachable, which emptied all of
  them.

  Two additions that are not about the slot:

  **Breadcrumbs.** A trail between the header and the file area, one segment per
  folder down to the current one, each navigating on press. Hidden at the root,
  scrolls horizontally on deep paths. Nothing to opt into.

  **Search shows every match at once.** A query used to filter the current
  folder's view in place, which meant a match three folders down showed up only as
  the ancestor folder leading to it. It now swaps the view for a flat result list
  — every matching file at every depth, each row naming the folder it came from,
  so a search reads as a search rather than as a filtered folder.

  Search input is also debounced 200ms before it recomputes, so typing into a
  large manifest no longer re-runs the pipeline per keystroke. The field stays
  immediate; only the results wait. Navigating clears the query and cancels a
  pending recompute, so a debounce in flight can't land on the folder you just
  opened.

  Also: `computeVisiblePaths` short-circuits the ancestor walk for direct children
  of the current folder, instead of walking the `parentPath` chain through the
  index every time.

- 1d16717: **FileSystem**: context menus now use `HoldContextMenu` throughout — the same interaction the rest of the app uses.

  Every entry long-press opens a `HoldContextMenu` panel instead of the previous custom modal. The background long-press (empty space in list/icons views and the empty-folder placeholder) does the same. On web the right-click path was already correct; this change brings native into line with it.

  **Breaking changes**

  `FileSystemProps.contextMenuWideBreakpoint` is removed. The breakpoint that switched the old modal into a sidebar is no longer meaningful — `HoldContextMenu` handles its own sizing, and the panel never needed a sidebar mode. Remove the prop from any `<FileSystem>` usage.

  `FileSystemContextMenuProvider` is no longer exported from this package. It was an internal implementation detail of the old modal approach. If you imported it directly, remove the import; the context menu is now self-contained inside each entry row.

  **HoldContextMenu: new `trigger="passive"` mode with controlled `open`/`onOpenChange`**

  When the host needs to control exactly when the menu opens — for example, a button that calls `setOpen(true)`, or an entry row that already owns the long-press gesture — set `trigger="passive"`:

  ```tsx
  const [open, setOpen] = useState(false);

  <HoldContextMenu
    items={items}
    open={open}
    onOpenChange={setOpen}
    trigger="passive"
  >
    <Pressable onPress={() => setOpen(true)}>
      <Text>Open menu</Text>
    </Pressable>
  </HoldContextMenu>;
  ```

  `trigger="passive"` skips `HoldContextMenu`'s own `Pressable` wrapper entirely; the host renders whatever gesture target it needs inside. The web `contextmenu` listener (right-click / Shift+F10) remains active so keyboard users still reach the panel without extra wiring.

- 2f9bfc7: **FileSystem**: `isLoadingCurrentFolder` is now `isLoading`.

  **Breaking.** The field named the folder it was about, which every other field in
  the same snapshot also is — `currentPath`, `entries` and `hasActiveFilters` are
  all the current folder's, and none of them say so. The qualifier only made this
  one longer.

  `FileSystemBodyState.isLoadingCurrentFolder` → `isLoading`, which is what
  `renderBody` receives:

  ```tsx
  // Before
  <FileSystem renderBody={({ content, isLoadingCurrentFolder }) => …} />

  // After
  <FileSystem renderBody={({ content, isLoading }) => …} />
  ```

  Same value, same meaning: `true` while the current folder's children are being
  fetched. Nothing else about the snapshot changes, and a slot that never read the
  field is unaffected.

- e7acea7: **FileSystem: `pinnedAt`, `favoritedAt`, and `renderEntryIcon`.**

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

  ***

  All three additions are purely additive. Existing items without `pinnedAt` or `favoritedAt` render exactly as before, and `renderEntryIcon` is optional.

- 234a3cb: **FileSystem: search results always say where they live, and show what matched.**
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
  const row = await canvas.findByTestId(
    "file-system-entry-Reports/Q1-report.pdf"
  );
  expect(row).toHaveTextContent("Files › Reports");
  ```

  `toHaveTextContent` reads the whole subtree, so it sees through both the
  highlight spans and the trail separators. Rows outside a search are unaffected —
  nothing is split when there is no query.

- 234a3cb: **FileSystem: search can be scoped to the open folder or to the whole tree.**
  A query used to always run over the open folder's subtree, so finding something
  you could not place meant navigating back to the root first and searching again.

  `renderFilters` now hands the slot a scope it can offer as a control:

  ```tsx
  renderFilters={({ folderName, isAtRoot, rootLabel, searchScope, setSearchScope }) => (
    <View className="flex-row items-center gap-1.5">
      <Text>Search:</Text>
      <Chip active={searchScope === 'root'} onPress={() => setSearchScope('root')}>
        {rootLabel}
      </Chip>
      {isAtRoot ? null : (
        <Chip active={searchScope === 'folder'} onPress={() => setSearchScope('folder')}>
          {folderName}
        </Chip>
      )}
    </View>
  )}
  ```

  - `searchScope` — `'folder'` (the open folder and everything under it, the
    previous behavior and still the default) or `'root'` (the whole manifest).
  - `setSearchScope` — switches it, taking effect immediately on a live query with
    no debounce, since the press is the whole gesture.
  - `rootLabel`, `folderName`, `isAtRoot` — enough to name both scopes and to know
    that at the root they are the same tree, so only one is worth offering.

  The exported `FileSystemSearchScope` type is the union.

  Two deliberate boundaries. Only a _query_ widens: filters stay scoped to the
  folder they are shown against whichever way the scope is set, because a filter
  bar reads as being about the folder you are looking at. And the scope outlives a
  query — navigating clears the query but keeps the scope armed, so switching to
  root once does not have to be redone for every subsequent search.

  Nothing changes for existing consumers: the default scope is what the component
  already did, and a slot that ignores the new state keeps behaving exactly as it
  did before.

- 3f7a5df: **Headless calendar, date picker and date range picker.** Three hooks that own
  the date arithmetic, the keyboard, and the accessibility payload, and render
  nothing. There is no styled `<Calendar />` here on purpose: a calendar is mostly
  markup decisions — seven cells in a row, or a `FlatList`, or a table — and every
  styled one ends up fought with. `FileSystem`'s `applyCustomRange(type, from, to)`
  has been waiting for exactly this on the other side of the handoff.

  ```tsx
  import { useCalendar } from "rn-motion-ui/hooks/use-calendar";

  const calendar = useCalendar({
    mode: "range",
    numberOfMonths: 2,
    minDate: "2026-01-01",
  });

  <View {...calendar.getRootProps()}>
    {calendar.months.map((month) => (
      <View key={month.month} {...calendar.getMonthProps(month.month)}>
        <Text {...calendar.getMonthLabelProps(month.month)}>{month.label}</Text>
        <View {...calendar.getGridProps(month.month)}>
          {month.weeks.map((week, index) => (
            <View key={index} {...calendar.getWeekProps(month.month, index)}>
              {week.map((day) => (
                <Pressable key={day.date} {...calendar.getDayProps(day)}>
                  <Text>{day.day}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </View>
    ))}
  </View>;
  ```

  Dates are ISO `'YYYY-MM-DD'` strings everywhere — arguments, return values,
  callbacks. No `Date` crosses the API, so a value compares with `===`, sorts as a
  string, survives JSON, and sits in a dependency array without a stable-reference
  dance. The arithmetic underneath runs in UTC, because `+1 day` in local time
  lands back on the same date across a DST boundary, and `new Date().toISOString()`
  names tomorrow for anyone east of UTC in the evening.

  Data arrives decorated. Each cell carries `isSelected`, `isToday`, `isInRange`,
  `isRangeStart`, `isRangeEnd`, `isPreview`, `isDisabled`, `outside` and
  `isWeekend`, so styling is a lookup rather than a recomputation per render — and
  the preview band that follows the pointer while a range's second endpoint is
  unchosen is maintained for you.

  What the getters carry beyond the obvious:

  - **A roving tab stop.** Exactly one cell per calendar has `tabIndex: 0`. Tab
    reaches the grid once and arrows move within it; 42 cells in the tab order is
    not the grid pattern.
  - **Keyboard.** Arrows step a day or a week, `Home`/`End` reach the ends of the
    week, `PageUp`/`PageDown` step a month and a year with shift. A step past the
    visible months pages the view, and focus follows onto the destination cell even
    when that cell mounts _after_ the step. `isRTL` mirrors the horizontal axis
    only — up is still up. `preventDefault` fires only for keys the grid acts on,
    so Tab still leaves.
  - **Disabled days keep their tab stop.** They get `aria-disabled` and
    `accessibilityState` but not `disabled`, because a day you cannot reach cannot
    tell you why it is unavailable. The press handler refuses.
  - **Both a11y dialects, always together.** Native `accessibilityRole`/
    `accessibilityState` and web `aria-*`, since react-native-web maps only the
    `aria-` form.

  The two pickers add a disclosure, a typeable field per date, and a backdrop:

  ```tsx
  const picker = useDatePicker({ onSelectDate: setValue, testID: 'depart' });

  <TextInput {...picker.getFieldProps()} />
  <Pressable {...picker.getTriggerProps()}><Text>Pick a date</Text></Pressable>
  {picker.isOpen ? (
    <>
      <Pressable {...picker.getDismissProps()} />
      <View {...picker.getPanelProps()}>{/* the calendar, as above */}</View>
    </>
  ) : null}
  ```

  The field is forgiving where a date field has to be: typing shows a draft without
  committing, blur commits, submit commits and closes. Unparseable text snaps back
  to the current value instead of silently discarding it, and a complete allowed
  date moves the grid as you type so field and calendar never disagree. `format`
  takes a `{ parse, format }` pair for a non-ISO field order.

  `useDateRangePicker` differs only where a range does: two months by default, two
  independent field drafts, and it closes when the range is **complete** rather
  than on the first press, which only starts it. A range entered backwards is
  reordered rather than rejected, clearing one field leaves a half-open range the
  next press completes, and a date typed into the end field is revealed in the
  _last_ month on screen so the start stays visible beside it.

  The trigger is a button with `aria-expanded`, deliberately not a `combobox`: RN
  has neither `aria-controls` nor `aria-haspopup`, so a combobox would announce a
  popup assistive tech cannot then find. The panel is a `dialog` whose three modal
  flags all follow one `modal` option, so an inline calendar never claims to trap
  focus that nothing has trapped. A day cell is a button rather than a `gridcell`,
  which RN's role union does not have.

  Pass `testID` and every child derives one (`depart-day-2026-08-05`,
  `depart-grid-2026-08`, `depart-trigger`, `depart-panel`); pass nothing and no
  `testID` is emitted anywhere, so a tree stays clean by default.

  New subpaths: `hooks/use-calendar`, `hooks/use-date-picker`,
  `hooks/use-date-range-picker`, plus the pure modules behind them — `calendar`
  (the date core), `calendar-format`, `calendar-props`, `calendar-selection`,
  `date-field` and `date-picker-props` — exported so a consumer can type a render
  function or reuse the arithmetic without the hooks.

- 4c88409: **HoldContextMenu**: `trigger="passive"`, and a controlled `open`.

  The component has always owned the press: it wraps `children` in a `Pressable`,
  reads the gesture `activateOn` names, and squeezes under the finger. That is the
  wrong shape when the children are already a button, or already own a long-press —
  you get a second button nested in the first, an extra tab stop per item in a long
  list, and on native two press responders competing for the same touch.

  `trigger="passive"` drops the `Pressable` entirely. What is left is the measured
  wrapper the panel anchors to, and the host opens the menu itself:

  ```tsx
  const [open, setOpen] = useState(false);

  <HoldContextMenu
    items={items}
    open={open}
    onOpenChange={setOpen}
    trigger="passive"
  >
    <Pressable onPress={() => setOpen(true)}>
      <Text>Open menu</Text>
    </Pressable>
  </HoldContextMenu>;
  ```

  `open` makes the component controlled and works under either trigger mode. The
  anchor is measured when it flips true, so a host can open the menu without a
  gesture having measured anything first — the panel paints one commit later, once
  that measurement lands. Leave `open` out and the trigger keeps the state, exactly
  as before.

  Two things survive the missing `Pressable`. Web's right-click still opens the
  panel: the `contextmenu` listener sits on the wrapper and the event bubbles to it
  from whatever the children render, so keyboard users reach the menu through
  Shift+F10 without extra wiring. And nothing squeezes — the press it previewed
  belongs to someone else now — so the lifted copy springs from rest rather than
  from `HOLD_ITEM_SCALE`, which would otherwise read as a 5% pop out of an item the
  user never touched.

  New: `wrapperRef`, which hands you the measured node — a real DOM element on web —
  for attaching your own listeners to it. New type: `HoldContextMenuTriggerMode`.

- dfbc2da: **HoldContextMenu**: new component — an action menu that reads as the platform's
  own. On iOS and Android, hold an item: it lifts off the page, the rest of the
  screen dims, and an iOS-style panel grows out of the corner nearest it, both
  travelling together so the pair stays on screen. On web it is a right-click, and
  what opens is a plain dropdown anchored to the item — no hold, no lift, no dim.
  A mouse already has a button for this, and once the gesture is a click there is
  no press to animate and nothing to lift out from under a finger. One component,
  two honest presentations; `activateOn="tap"` and `"double-tap"` read the same
  either way, and get the dropdown on web too.

  A port of [react-native-hold-menu](https://github.com/enesozturk/react-native-hold-menu)
  (MIT, Enes Öztürk) onto this package's primitives. Same interaction, none of the
  upstream dependencies: no `@gorhom/portal`, `expo-blur`, `expo-haptics`, `nanoid`,
  `lodash.isequal` or `react-native-gesture-handler`.

  ```tsx
  import { HoldContextMenu } from "rn-motion-ui/hold-context-menu";

  <HoldContextMenu
    items={[
      {
        id: "reply",
        label: "Reply",
        icon: MessageCircle,
        onPress: () => reply(message.id),
      },
      {
        id: "copy",
        label: "Copy",
        icon: Copy,
        onPress: () => copy(message.body),
        separator: true,
      },
      {
        id: "delete",
        label: "Delete",
        icon: Trash2,
        destructive: true,
        onPress: () => remove(message.id),
      },
    ]}
  >
    <MessageBubble message={message} />
  </HoldContextMenu>;
  ```

  Coming from upstream:

  | Upstream                                                               | Here                                                                                                                                                                                                                         |
  | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `<HoldMenuProvider>` at app root + portal host                         | nothing — each menu owns a `Modal` through `OverlayShell`                                                                                                                                                                    |
  | `expo-blur` scrim                                                      | native dims and blurs with `backdrop-blur-xs`; web paints nothing, since a dropdown does not dim the page                                                                                                                    |
  | `hapticFeedback="Medium"` (`expo-haptics` style name)                  | `haptics` — `true` buzzes on Android, or pass your own function                                                                                                                                                              |
  | `items[].text` / `isTitle` / `isDestructive` / `withSeparator`         | `items[].label` / `heading` / `destructive` / `separator`, plus `id` and `disabled`                                                                                                                                          |
  | `actionParams` map keyed by label                                      | close over what you need in the item's `onPress`                                                                                                                                                                             |
  | `bottom` + `menuAnchorPosition`                                        | `side` + `align`, matching `Popover` and `AdaptiveDropdown`                                                                                                                                                                  |
  | `theme="light" \| "dark"`                                              | theme tokens — follows the active scheme on its own                                                                                                                                                                          |
  | menu width fixed at 60% of the screen                                  | `menuWidth`, default 240, clamped to the viewport                                                                                                                                                                            |
  | `closeOnTap` defaults to `false`                                       | defaults to `true`, the iOS behaviour — native-only, as nothing lifts on web to tap                                                                                                                                          |
  | panel scales out of the corner from `0.6`, lift on a spring of its own | the shared anchored-menu motion — scale from `0.96` with an 8px slide toward the trigger, lift on the panel's own transition so the two move as one thing. `motion={{ scale: 0.6, offset: 0 }}` restores upstream's entrance |

  Beyond the port: the right-click that opens the menu on web (`openOnContextMenu`,
  on by default) is also the keyboard path — browsers raise `contextmenu` for
  Shift+F10 and the ContextMenu key on the focused trigger, so the panel is
  reachable without the pointer a hold gesture requires. Enter and Space are left
  alone there, so they still reach whatever you nest inside the trigger. On native,
  screen readers open it through a `longpress` accessibility action. Rows are
  `menuitem`s, a `heading` row is `presentation`, a disabled row carries
  `aria-disabled`, and the scrim is a named button rather than a bare tap target.
  `useReducedMotion` swaps every spring for a short fade.

  The right-click is the _mouse_ path on web; a touch press still holds — mobile
  web has no right button, so `holdDuration` is always pinned into the gesture's
  `holdDelay`, even for a draggable trigger whose drag tuning would otherwise
  have no hold on web at all. While the hold charges, the trigger squeezes to
  95%, and the squeeze releases the moment the menu opens, not when the press
  ends: on native the lifted copy takes the scale over, and on web — where
  nothing lifts — a squeeze that outlived the open would spring back to full size
  exactly as the menu closed or a drag escaped, a flicker on the trigger at the
  worst moment. Either way, closing the menu leaves the trigger motionless. The
  drag ghost a menu-escape lifts starts exactly over the item it came from, too —
  its first frame used to sit offset by wherever the finger grabbed.

  `onHold` fires _alongside_ the menu, right after it opens — one gesture, both
  outcomes — and still fires when the menu has no items to show, so a
  multi-select toggle riding it keeps working while the panel stays silent.

  Panel placement is measured per-open from `useWindowDimensions` and the safe-area
  insets, not from module-level `Dimensions` constants read at import time, so it
  survives a rotation. The height estimate the layout runs on is corrected from the
  panel's real `onLayout` height, so a row that wrapped under a large accessibility
  font still gets a panel that fits.

  The panel opens on the same motion as every other menu a trigger summons, and
  `motion` retunes it — `enter`, `exit`, `scale` and `offset` shared with
  `AdaptiveDropdown`, `HoverMenu` and `Popover`, plus `scrim` and `lift` for the two
  surfaces only this menu has. `useReducedMotion` still wins over all of it.

  ```tsx
  // Upstream's entrance, for anyone who ported from it and wants the old feel back.
  <HoldContextMenu motion={{ offset: 0, scale: 0.6 }} items={items}>
    <MessageBubble message={message} />
  </HoldContextMenu>
  ```

- e9f5fe0: feat(Menu): composable menu list for dropdowns and context menus

  `Menu` takes an `entries` array and renders the inside of a menu — action rows,
  separators, group labels, and arbitrary nodes — so consumers stop hand-rolling a
  `View` full of `MenuItem`s. Entries compose with `&&`, so a conditional row is
  just `condition && { id, label, onSelect }`; falsy entries are dropped.

  Four entry kinds, discriminated on `type`, which is optional for the common one:

  - `{ id, label, onSelect }` — an action row (`type: 'item'` implied)
  - `{ type: 'separator' }`
  - `{ type: 'label', label }` — a non-interactive group caption
  - `{ type: 'node', node }`, or a bare `ReactElement` as shorthand

  It carries the semantics (`role="menu"`, `role="menuitem"`, `accessibilityState`,
  `aria-disabled`, `role="presentation"` on captions), closes the panel before
  running the action so a navigating row does not strand a modal, and aligns labels
  across a mixed list via an auto-detected icon gutter (`iconGutter`).

  `Menu` owns no frame: no background, border, radius, width, or horizontal
  padding. The surface belongs to whatever holds it — `AdaptiveDropdown`'s panel,
  `HoldContextMenu`'s, a `Card`, a sidebar column. The one exception is the
  vertical inset, which the list keeps for itself so the end rows clear a rounded
  panel corner without every container having to remember to pad for them.

  Also: `MenuItem` gains a `destructive` prop (danger-tinted label and icon, with
  the `bg-info` active fill still winning over it) and now dims while `disabled`.

- f3e006d: `MenuItem`: `mode` prop, hover/press feedback, retuned default scale

  **New: `mode`.** The default (non-`iconBackgroundColor`) variant now comes in two
  flavours, because the same row serves two jobs: a command-palette list, where
  every entry reads as equally available, and a sidebar, where the selected entry
  has to win against its neighbours.

  | `mode`             | Label                                           | Leading icon                     |
  | ------------------ | ----------------------------------------------- | -------------------------------- |
  | `'menu'` (default) | `foreground`, normal weight — active or not     | `foreground`, active or not      |
  | `'sidebar'`        | `font-medium`; `muted-foreground` when inactive | `muted-foreground` when inactive |

  ```tsx
  // Sidebar: the active row is the only one at full contrast
  <MenuItem
    label="General"
    icon={Settings}
    mode="sidebar"
    active={tab === "general"}
    onPress={go}
  />
  ```

  `mode` is ignored when `iconBackgroundColor` is set — that variant keeps its own
  treatment (coloured icon square, filled active row, label inverted over the
  fill), and `'sidebar'` no longer leaks its medium weight onto that label.
  The default is `'menu'`, which is the previous behaviour for active rows, so
  existing call sites keep their look except for the scale changes below.

  New type: `MenuItemMode`.

  **Hover and press feedback.** The row now fills on hover (`surface-hover`) and
  on press (`surface-selected`). Both are suppressed while `active` or `disabled`,
  so the active highlight is never double-painted and a disabled row stays inert.

  Driving those fills means the row owns `onHoverIn`, `onHoverOut`, `onPressIn` and
  `onPressOut`, so each one forwards to a caller's handler of the same name after
  setting its own state. Passing any of the four still works exactly as before —
  `CommandPalette` relies on this, using `onPressIn` to move its active row.

  **Retuned default scale.** The `md` and `lg` rows were loose next to the
  palettes and sidebars they're used in — `md` lost vertical padding and a label
  step, `lg` gained horizontal padding and a larger icon:

  | Size | Changed                                                                                    |
  | ---- | ------------------------------------------------------------------------------------------ |
  | `sm` | label pinned to 12px (was `text-xs`, the same size)                                        |
  | `md` | `py-2` → `py-1.5`; label 16px → 14px; icon spacer `h-4 w-4` → `h-5 w-5`                    |
  | `lg` | `px-3` → `px-4`; icon 22 → 24; icon spacer `h-4.5 w-4.5` → `h-6 w-6`; label pinned to 18px |

  Label sizes are now explicit pixel values rather than Tailwind's `text-*` steps.
  The `iconPlaceholder` spacer sizes are matched to the rendered icon at each size,
  so a row without an icon now aligns with one that has it.

- 603c921: **Menu motion is now one definition, and it is yours to retune.** Every panel a
  trigger summons — `AdaptiveDropdown`, `HoverMenu`, `Popover`, `HoldContextMenu` —
  had drifted onto its own spring, its own exit and its own idea of whether to scale
  or slide. Four menus, four entrances. They now share one: a fade up from `0.96`
  with an 8px travel toward the trigger, growing out of the corner facing it, and a
  200ms ease-in on the way out.

  Each of the four takes a `motion` prop to change that:

  ```tsx
  import { HoverMenu } from 'rn-motion-ui/hover-menu';

  // Slower, softer, and further.
  <HoverMenu motion={{ enter: { type: 'spring', stiffness: 140, damping: 22 }, offset: 16 }} items={items}>
    <Button>Insert</Button>
  </HoverMenu>

  // No movement at all — just the fade.
  <Popover motion={{ offset: 0, scale: 1 }}>…</Popover>
  ```

  `enter` and `exit` are `Partial<MotiTransitionProp>`, merged over the preset the
  same way `Button`, `Tabs`, `Switch`, `Radio` and `Checkbox` already take theirs, so
  a partial override changes only what it names. `scale: 1` drops the scale and
  `offset: 0` drops the slide. `HoldContextMenu` adds `scrim` and `lift` for the two
  surfaces only it has. `useReducedMotion` overrides all of it — a `motion` prop
  cannot animate a menu for someone who asked the OS for less.

  `rn-motion-ui/theme/motion` exports what the four run on, for anyone matching a
  custom overlay to them: `resolveMenuMotion` returns the whole
  `from`/`animate`/`exit`/`transition` set for a side, `menuTransformOrigin` gives
  the corner a panel should grow from for a side/align pair, and
  `MENU_ENTER_SCALE` / `MENU_ENTER_OFFSET` / `MENU_EXIT_TRANSITION` /
  `MENU_SCRIM_TRANSITION` are the tokens behind the defaults.

  Visible changes from this: `AdaptiveDropdown`, `HoverMenu` and `Popover` now scale
  slightly as they open rather than only sliding, and all three grow from the corner
  nearest their trigger instead of their centre. `HoverMenu`'s exit goes 180ms →
  200ms.

- 1d9a279: **Menu**: captions, separators and node entries are addressable by `testID`.

  Give the list a `testID` and every action row already derives one from it —
  `${testID}-item-${id}`, which is how `HoldContextMenu`'s rows have been reachable
  in a test. The other three entry kinds got nothing, and they are the ones with no
  alternative: a caption is `role="presentation"` and a separator is a bare band, so
  neither carries a role or an accessible name to query by. Selecting them meant
  `getByText` against user-facing copy, or nothing at all.

  Each non-action entry now takes the list's `testID` plus the React key the list
  had already assigned it:

  ```tsx
  <Menu
    testID="row-actions"
    entries={[
      { type: "label", id: "group", label: "Message" }, // row-actions-group
      { id: "reply", label: "Reply", onSelect: reply }, // row-actions-item-reply
      { type: "separator", id: "after-reply" }, // row-actions-after-reply
      { type: "separator" }, // row-actions-separator-0
    ]}
  />
  ```

  An entry with an `id` is named by it. One without falls back to the same per-type
  running count that already keys it — and that count only advances for the unnamed
  ones, so the numbering is positional among _them_ rather than among all separators.
  Pin an `id` on anything you plan to select. Any entry can also set `testID`
  outright to override the derivation, as action rows could already.

  `MenuSeparator` and `MenuLabel` take a `testID` too, so a `node` entry drawing its
  own matching hairline can name it the same way the list would have.

  **HoldContextMenu** inherits this: its panel already passes `${testID}-menu` down,
  so a `heading` row is now `${testID}-menu-<id>` and the band a `separator: true`
  row ends its group with is `${testID}-menu-<id>-separator`.

- d8c1833: refactor(menus)!: the anchored panels fill themselves with `Menu`

  `Menu` arrived as the list you _could_ put inside a panel. This makes it the
  list the panels actually use. `HoldContextMenu` had its own row component — a
  port of react-native-hold-menu's `MenuItem`, with its own hover and press fills,
  its own disabled dimming, its own heading branch — which is now a second
  implementation of something this package already has. It is gone, and the panel
  renders a `Menu`.

  `hold-context-menu-row.tsx` is deleted. Nothing imported it directly: it was
  never an entry point, and both types it exported (`HoldContextMenuItem`,
  `HoldContextMenuIcon`) are still exported from `rn-motion-ui/hold-context-menu`.
  The item type is unchanged and stays the component's public API — it reads in
  upstream's vocabulary (`heading`, `separator`) rather than `Menu`'s, so a new
  `hold-context-menu-item.ts` translates one into the other.

  **The rows look different.** Adopting `Menu`'s row means adopting its layout:

  - the icon **leads** the label instead of trailing it
  - a `heading` row is `Menu`'s group caption — left-aligned and muted, where it
    used to be centred
  - rows are shorter (44 → 32px floor), and the heading with them (34 → 24px)
  - the hairline under **every** row is gone. Only a row with `separator: true`
    draws anything, and what it draws is the band that ends a group

  **Breaking:** the panel's testID is now `` `${testID}-panel` ``; it used to be
  `` `${testID}-menu` ``. Row testIDs are unchanged
  (`` `${testID}-menu-item-<id>` ``). Queries by role are unaffected.

  **`role="menu"` moved onto the list.** The panel used to carry it while the rows
  carried `menuitem`, with a wrapper in between; now the element with the role
  owns its rows directly, and there is no chance of one menu nesting inside
  another. The accessible name moved with it, so `accessibilityLabel` still names
  the menu.

  **`Menu` now owns its vertical inset.** Asking every container to remember
  `contentClassName="p-1"` was the wrong split: the clearance the first and last
  row need from a rounded panel corner is the same in every panel that holds the
  list, and forgetting it left rows sitting against the corner. So the list caps
  itself top and bottom (`py-2.5`) and still draws no horizontal padding, no
  surface, no border, no radius, no width. Retune it with `className="py-*"`, or
  `py-0` to drop it — `HoldContextMenu` pins its own, because it has to predict
  its height before layout and wants a number it chose.

  Also in `Menu`: a separator is a 4px band with margins around it (12px total at
  `md`) rather than a 1px hairline, group captions sit tighter to the group they
  name, and `MENU_SEPARATOR_HEIGHT` is exported for panels that have to predict
  their own height before layout.

  `HoldContextMenu`'s pre-layout height estimate follows the new metrics, and now
  counts the panel's border and the list's inset once rather than leaving them
  out. `HOLD_MENU_MIN_PANEL_HEIGHT` is the floor a panel is clamped to — border,
  inset and one row, so the row that survives the clamp is a whole one.

  `CommandPalette` caps its scroller with `max-h-[60vh]` instead of measuring
  `useWindowDimensions()`. uniwind compiles `vh` against the same window
  dimensions and the same resize event, so this is the same height with one less
  hook.

- 97a2b25: **Breaking**: `rn-motion-ui/moti/progress` and `rn-motion-ui/moti/motify-svg` are gone.

  Both came over with the Moti layer and neither earned its place. `MotiProgressBar`
  was a progress bar with hardcoded hex defaults (`#333`, `#eee`, `#00C806`) that
  answered to nothing in the token system, so it could not sit next to anything else
  in this library without looking foreign. Nothing here rendered it.

  ```diff
  -import { MotiProgressBar } from 'rn-motion-ui/moti/progress';
  ```

  A bar is two views and a translate. If you were using it, the replacement is a
  `MotiView` inside a clipping parent — which is all it ever was, minus the
  re-render warnings:

  ```tsx
  import { MotiView } from "rn-motion-ui/moti/view";

  <View className="h-3 w-full overflow-hidden rounded-full bg-muted">
    <MotiView
      className="h-full w-full rounded-full bg-primary"
      animate={{ translateX: `${Math.round(progress * 100) - 100}%` }}
      transition={{ type: "timing", duration: 200 }}
    />
  </View>;
  ```

  `motifySvg` was a second `motify` that wrote to `animatedProps` instead of `style`,
  for animating SVG attributes like `r` or `strokeDashoffset` that are props rather
  than styles. Every SVG animation in this package is written directly against
  Reanimated's `useAnimatedProps` instead — `Loader`, `ScrollProgress`,
  `AnimatedBadge`, `Checkbox`, `StarRating` — so the wrapper was carrying an API
  surface no caller used.

  ```diff
  -import { motifySvg } from 'rn-motion-ui/moti/motify-svg';
  -const MotiCircle = motifySvg(Circle)();
  +import Animated, { useAnimatedProps } from 'react-native-reanimated';
  +import { Circle } from 'react-native-svg';
  +const AnimatedCircle = Animated.createAnimatedComponent(Circle);
  ```

  `react-native-svg` stays a peer dependency — the components above still need it.

- b2aabe1: **MultiDragManager, MultiDraggable**: drag a selection, not an item.

  `<Draggable>` knows what it holds and nothing about the list it sits in. So
  dragging one of three selected rows moves one row — the other two stay put,
  because no single draggable was ever told they existed. Every list with
  multi-select ends up re-deriving the same three things to fix that: which ids a
  lift should carry, one payload built from all of them, and a way for the members
  left behind to know they are moving too.

  ```tsx
  <MultiDragManager
    selectedIds={selected}
    getGroupData={(ids) => ({ "application/x-rows": JSON.stringify(ids) })}
    renderPreview={(ids) => <Chip label={`${ids.length} items`} />}
  >
    {rows.map((row) => (
      <MultiDraggable id={row.id} key={row.id}>
        <Row row={row} dimmed={useIsLifting(row.id)} />
      </MultiDraggable>
    ))}
    <Dragzone onDrop={({ transfer }) => move(readMultiDragIds(transfer))} />
  </MultiDragManager>
  ```

  Lifting a selected item carries every selected id; lifting an unselected one
  carries just it and leaves the selection alone. That rule is `resolveIds`, and
  the default is the one a file manager, a mail list and a canvas all want —
  replace it for a list where it is not.

  The ids in flight are read back off the drag's own transfer rather than recorded
  at lift time, which is what keeps them right on every transport and after a
  cancel: nothing to clean up, because the set empties when the drag does.
  `useIsLifting(id)` is how a member that is _not_ under the pointer knows it is
  nonetheless moving — the hook that fades the rest of the selection.

  The group also travels as `application/x-multi-drag-ids` on the transfer, so a
  plain `<Dragzone onDrop>` reads it with `readMultiDragIds` — and under the HTML5
  mouse transport, so does a `drop` listener that has never heard of this library.
  `withMultiDragIds` adds the same key to a payload you are building yourself.

  It is a `<DragManager>` underneath, with all of its props: zones, isolation,
  groups and the ghost overlay behave exactly the same. `renderPreview` draws the
  group ghost for the pan transports; under HTML5 the browser draws its own drag
  image and it is not consulted.

  A multi-select drag needs its keyboard equivalent more than a single one, since
  the selection it acts on is already reachable without a pointer — a "Move
  selected to…" command belongs next to the `onDrop` that performs it.

  New subpaths: `rn-motion-ui/multi-drag-manager`, `rn-motion-ui/multi-draggable`,
  `rn-motion-ui/multi-drag` and `rn-motion-ui/multi-drag-scope`. New types:
  `MultiDragManagerProps`, `MultiDraggableProps`, `MultiDragIdResolver`,
  `MultiDragScope`.

- 51dd604: Seven components now name their repeated children from the root `testID`.

  Each of these already took a `testID` and put it on its outer element, which left
  the interesting parts unaddressable: the stars, the wheel options, the swipe
  actions. A test could reach them only through `accessibilityLabel`, which ties the
  selector to user-facing copy, or not at all where the element carries no role and
  no name.

  | Component         | New testIDs                                               |
  | ----------------- | --------------------------------------------------------- |
  | `StarRating`      | `-star-<n>` — both the interactive and `readOnly` paths   |
  | `WheelPicker`     | `-option-<value>`                                         |
  | `SwipeableList`   | `-row-<id>`, and `-row-<id>-action-<id>` per swipe action |
  | `BouncyAccordion` | `-item-<id>`                                              |
  | `BloomMenu`       | `-item-<index>`, `-trigger`, `-close`                     |
  | `CommandPalette`  | `-item-<id>`, `-group-<group>`                            |
  | `OverflowActions` | `-item-<id>`                                              |

  Five of the seven add nothing when `testID` is omitted, so a component that does
  not ask for one renders exactly as before. The exceptions are `WheelPicker` and
  `SwipeableList`, whose roots already defaulted to `'wheel-picker'` and
  `'swipeable-list'` — their children derive from that default, so options and rows
  are named either way. Where an item type already had its own optional `testID`
  (`BouncyAccordion`, `BloomMenu`, `CommandPalette`, `OverflowActions`), it still
  wins; the derived name is the fallback.

  **Two of these render their children twice, and only the live copy is named.**
  `WheelPicker` paints a second `aria-hidden` drum for the bright centre band and
  `OverflowActions` keeps an offscreen measurer to feed its width spring; naming
  both copies would return two nodes per `getByTestId`. `aria-hidden` does not hide
  an element from `getByTestId` the way it hides one from `findByRole`, which is why
  the role queries in these components were never ambiguous but the testIDs would
  have been.

  `OverflowActions` had that bug already: its measurer duplicated any `item.testID`
  a caller set, so naming an action made every query for it ambiguous.
  `ActionButtonProps` now takes an already-derived `testID` instead of reading
  `item.testID` itself, which is what lets the measurer stay silent no matter what
  the item carries.

  `SwipeableList` keeps its old default. Rows were hardcoded to
  `swipeable-row-<id>`, ignoring the root entirely — two lists on one screen
  collided. Rows now derive from the root when there is one and fall back to the
  old string when there is not, so existing selectors keep working while a named
  list gets `<testID>-row-<id>`.

  `StarButton` (exported) gains an optional `testID`. `MenuItem` itself is untouched —
  it already forwarded one; what changed is the components above it passing a derived
  name down.

  Four stories now assert through the new IDs rather than around them. `SwipeableList`
  is the clearest case: every row repeats the same four action labels, so its old
  `findAllByRole('button', { name: 'Trash' })[0]` could assert that _something_ was
  pressed but not which row, and the buttons sit behind the draggable surface with no
  swipe to reveal them in jsdom. It now names the row and the action together and
  asserts the payload. The `WheelPicker` and `OverflowActions` plays query by testID
  specifically so a single match proves the duplicate copy stayed anonymous.

- f3e006d: `Switch`: reduced motion cuts the thumb, and a tighter label gap

  **Reduced motion now wins over `thumbTransition`.** When the OS asks for reduced
  motion, the thumb cuts straight to its position (`TIMING_INSTANT`) instead of
  springing, matching how every other animated control in the library treats the
  setting. Previously the spring ran regardless, and a caller-supplied
  `thumbTransition` was merged in even under reduced motion — now it is ignored in
  that case. With reduced motion off, `thumbTransition` merges over the default
  spring exactly as before.

  **The gap between the track and the label shrinks from 12px to 8px**, and is now
  set by a `gap-2` class on the root rather than an inline `style`. Rows of
  switches read slightly tighter; pass a `style` to set your own spacing.

- 04e622d: **Switch**: `sm`, `md`, and `lg` size variants.

  The track, thumb, travel distance and label text scale now all respond to a single
  `size` prop. `'md'` is the default, so existing usage is unchanged.

  ```tsx
  <Switch isSelected={on} onSelectedChange={setOn} size="sm" label="Compact" />
  <Switch isSelected={on} onSelectedChange={setOn} size="md" label="Default" />
  <Switch isSelected={on} onSelectedChange={setOn} size="lg" label="Large" />
  ```

  | size | track      | thumb      | travel |
  | ---- | ---------- | ---------- | ------ |
  | `sm` | 16 × 32 px | 12 × 20 px | 8 px   |
  | `md` | 20 × 44 px | 16 × 26 px | 14 px  |
  | `lg` | 28 × 56 px | 24 × 36 px | 16 px  |

  The thumb's height is not a per-size number: it insets 2px from the top and the
  bottom of whatever track holds it, so the two always agree and a retuned track
  carries the thumb with it.

  Size is threaded through context, so `Switch.Thumb` and custom children pick it up
  automatically — no extra prop is needed on sub-components.

- 51c43f7: **Breaking:** `AnimatedNumber` and `NumberTicker` are merged into a single
  `TextNumberTicker`, exported from `rn-motion-ui/text-number-ticker`. The
  `/animated-number` and `/number-ticker` subpaths are gone.

  The two components animated the same thing two ways: `NumberTicker` rolled a
  column per digit, `AnimatedNumber` counted one label up to the value. That is
  now the `mode` prop — `'roll'` (default) and `'count'`:

  ```tsx
  // Before
  <NumberTicker value={48273} locale={true} stagger={0.04} />
  <AnimatedNumber value={129480} duration={1.2} />

  // After
  <TextNumberTicker value={48273} locale={true} stagger={0.04} />
  <TextNumberTicker mode="count" value={129480} duration={1.2} />
  ```

  `duration` keeps each component's old default per mode (0.9s per digit in
  `'roll'`, 1.2s total in `'count'`), so neither migration changes timing.

  Props that were only on one of the two now apply to both where it makes sense:
  `'count'` gained `pad`, `locale`, `prefix` and `suffix`, and `'roll'` gained
  `format`. `stagger` and `digitClassName` stay `'roll'`-only. A custom `format`
  in `'count'` receives the in-flight fractional value and owns its rounding,
  which is what lets a compact formatter stay legible mid-count; without one the
  value is rounded before formatting.

  `NumberTicker`'s `blur` prop is dropped rather than carried over. It was
  accepted for web API parity and documented as having no visual effect on React
  Native, so nothing rendered differently for it.

### Patch Changes

- 6605e30: fix(AnimatedBadge): the loading spin and the pulse survive a parent re-render

  Both loops were declarative `MotiView`s with `transition={{ loop: true }}`. Moti
  resolves its pose inside a `useAnimatedStyle` whose dependency list includes the
  `animate` object, and that object is a fresh literal on every render — so any
  re-render from above (a status change, an interval tick, a theme swap) re-ran the
  worklet and re-issued the tween _from the current value_. The spin restarted
  mid-revolution with a full second to cover the remaining arc, which read as a
  stutter and a speed change rather than one steady turn; a badge under a parent
  that re-renders every 50ms barely moved at all.

  `withTiming`'s default easing was the second half of it. `Easing.inOut(Easing.quad)`
  eases to a stop at each revolution boundary, so even an uninterrupted loop paused
  once per turn.

  The spin and the halo are now two small components driving one shared value each,
  started in an effect and cancelled on unmount, with `Easing.linear` on the spin —
  the same shape the Marquee and TextShimmer loops already use. Re-renders never
  touch a shared value, so the loop keeps its phase.

  One shared value now drives both the halo's opacity and its scale, which also
  keeps them in phase: as two moti properties they drifted apart, since moti
  defaults `scale` to spring while `opacity` is timing.

  No API change — `status="loading"` and the pulse behave as documented, they just
  actually animate continuously now.

- 0756779: fix(Draggable, FileSystem): one press, three outcomes — a tap, a hold, or a drag, arbitrated in one place

  Holding an entry in `<FileSystem draggable>` did nothing on touch: the context menu never opened. Right-click on web was unaffected, which is why this only ever showed up on native and on web touch.

  The cause was two timers in two different gesture systems with nothing arbitrating between them. Both pan transports started the drag straight off their own 300ms hold timer, and RNGH cancels the touches under an activating handler — so at t=300 the entry's `Pressable` lost its long-press timer, which under `trigger="passive"` is the only way into the menu. The drag always won, 200ms before the press could fire.

  `<Draggable>` now owns the whole timeline, because it is the only thing that sees every touch, and reports the outcomes it does not keep:

  - **`onHold`** — the press stayed down past the hold delay without travelling. Open a menu, toggle a selection, start a preview.
  - **`onHoldEscape`** — a drag took the gesture back off a hold that had already fired. Undo what the hold did.

  The press reads in three phases, off four numbers both transports share so the gesture feels identical on either:

  |                                     |                                                                                                  |
  | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
  | before `armDelay` (150ms)           | movement belongs to the scroll — the pan gives the gesture up, so a list inside stays scrollable |
  | after it                            | `slop` (10px) of travel lifts a drag                                                             |
  | at `holdDelay` (300ms), still still | `onHold` fires, and no drag lifts from this press unless it travels `escapeSlop` (24px)          |

  The last row is the escape hatch: whatever the hold put on screen is under the finger by then, so getting out from under it takes a deliberate shove rather than the drift of a hand that thought it had finished.

  Those four numbers are not one set. They default per platform and are overridable per platform, through `behavior` on `<Draggable>` or once for a whole subtree on `<DragManager>`, in `Platform.select` vocabulary — flat fields everywhere, `native` for everything but web, then a block per OS:

  ```tsx
  <DragManager behavior={{ armDelay: 100, android: { slop: 12 }, ios: { holdDelay: 400 } }}>
  ```

  **Web, macOS and Windows default to no hold at all** (`holdDelay: null`, so no timer is armed and `onHold` never fires). A desktop already has a gesture for "tell me about this thing" and it is the right button; on web, a long press on touch is already the browser's own text selection and context menu, and a second meaning layered on top fights both. The arm window stays even there, because web touch still shares the surface with the page's scroll. **Android tightens `slop` to 8px and `escapeSlop` to 20px**, matching `ViewConfiguration`'s scaled touch slop where iOS follows UIKit's more forgiving 10pt.

  The resolver is pure and separately tested: `resolveDragBehavior(behavior, os)` flattens the whole thing to four numbers, `DRAG_TUNING_DEFAULTS` is the per-OS table, and `useDragBehavior` resolves against the running platform. Everything downstream reads those numbers and never asks which OS it is on again.

  ### `useDraggable`, and a `<Draggable>` that draws nothing

  The drag is now available without the wrapper's markup. `useDraggable()` is the whole of `<Draggable>` bar the three elements it renders — transport selection, the press timeline, the session, store registration, the measured rect, the handle — exposed as `getRootProps()` / `getGhostProps()` plus `gesture` for the `GestureDetector` a hook cannot render itself. For a row in a `FlatList` that must not gain a wrapper `View`, or a `Pressable` host, or a ghost drawn a different way.

  `<Draggable>` stays, as that hook plus a `View`, and **has lost its own styling**: no `cursor-grab`, no `cursor-grabbing`, no lifted state. `className` and `style` land on the host untouched. The replacement is `isDragging`, now reactive render state rather than only the imperative `handle.isDragging()` — and true under every transport, including the ones that draw no ghost here. The one style the hook still supplies is `userSelect: 'none'` on web, which is functional: without it a drag starting on text selects the text instead of lifting.

  Native switches from `activateAfterLongPress(300)` to `Gesture.Pan().manualActivation(true)`, with the phase decision in `onTouchesDown`/`onTouchesMove` worklets. That prop cannot express this gesture: it flips to ACTIVE off a timer without consulting distance, and _fails_ the pan if the finger travels first.

  In `FileSystem`, `useEntryHold` replaces `useEntryLongPress` and reconciles all three claimants on an entry — the tap, multi-selection, and the context menu. Multi-selection still wins the hold when `selectionMode="multiple"`, as before. Both hold paths stay wired (the pans see touch, the `Pressable` sees a mouse) and the first to fire locks the other out for that gesture, so a hold cannot run its action twice — which for a selection toggle meant undoing itself. A release that already produced a hold no longer counts as a tap, so the entry behind an open panel is not also selected.

  An entry stays a drag source while its own context menu is open, which is what makes the escape possible: the finger that opened the menu is still delivering to the view it started in, so that entry's own pan is what detects the shove and closes the panel.

  ### `Holdable` and `HoldDraggable`

  Two new components exposing the same timeline without requiring a `<DragManager>`:

  **`<Holdable>`** — hold only, no drag. Wraps children in the four-phase press timeline (pending → active → hold) and exposes the current state via a render-prop child:

  ```tsx
  <Holdable onHold={() => select(id)}>
    {({ isPressed, isHeld }) => (
      <Chip pressed={isPressed} selected={isHeld} label={name} />
    )}
  </Holdable>
  ```

  `isPressed` flips at `armDelay`; `onHold` fires at `holdDelay`. A cancel or release ends the press quietly — `onHoldEscape` is a drag's crossing out of a fired hold, and a bare `<Holdable>` has nothing to drag, so it never reports one (the prop exists so a consumer can move between `<Holdable>` and `<HoldDraggable>` without rewiring). The hold defaults fire on every platform (unlike `<Draggable>`, which has no hold on web by default) — but a mouse press still does nothing: a held left button is a text selection and a held right button is the context menu; the hold-and-lift is a touch idiom.

  **`<HoldDraggable>`** — hold + drag in one. Identical to `<Draggable trackPhase>` but with the render-prop always enabled, so the child always gets a live phase without a separate state lift:

  ```tsx
  <HoldDraggable
    data={{ "application/x-item": item.id }}
    onHold={() => openMenu(item)}
    onHoldEscape={closeMenu}
  >
    {({ isPressed, isHeld }) => (
      <Row row={item} pressed={isPressed} selected={isHeld} />
    )}
  </HoldDraggable>
  ```

  Web's drag transport defaults to `holdDelay: null`, so `onHold` on web needs `behavior={{ holdDelay: 300 }}` (or a platform-specific `web: { holdDelay: 300 }` block) to fire. Touch on web and all native platforms hold by default.

  ### `HoldContextMenu` — hold gesture rebuilt on `Holdable`

  `HoldContextMenu` no longer drives the squeeze animation from `Pressable.onLongPress`. On native for `activateOn="hold"`, the trigger is now a `<Holdable>` (or a `<HoldDraggable>` when `dragOptions` is set), and the squeeze fills exactly the gap between `armDelay` and `holdDelay` from the resolved tuning.

  Two new props:

  - **`behavior?: DragBehavior`** — timing and slop overrides forwarded to the gesture widget; merged with `holdDuration` if given.
  - **`dragOptions?: HoldContextMenuDragOptions`** — upgrades the hold gesture to `<HoldDraggable>`. A move past `escapeSlop` after arming lifts a drag; the hold still opens the menu, and an escape closes it before the drag takes over. Works wherever the hold does: native, and touch on web. A desktop mouse keeps the right-click, whose dropdown has no gesture to escape from.

  ### Touch on the web: the gesture now survives the browser's own ideas

  Three fights with the browser's touch pipeline, each found by driving the real
  gesture with real input rather than synthetic events:

  - **A hold that fired no longer "clicks" on release.** The browser synthesizes
    `mousedown`/`click` at the release point after `touchend` — and with a hold
    menu open, the topmost element there is the menu's own scrim, so the phantom
    click dismissed the menu the instant the finger lifted. Both pointer
    transports now cancel the `touchend` of a press that reached its hold, which
    is the documented way to suppress the compat events.
  - **The drag no longer dies one move after it lifts.** Taking explicit pointer
    capture at the lift releases the touch's implicit capture on the child under
    the finger, and that `lostpointercapture` _bubbles_ — the transport read its
    own capture handoff as "the system took the pointer" and cancelled the drag
    it had just started. A capture loss now only aborts the trip when it happens
    on the captured node itself.
  - **Chromium's native drag is refused while the pan owns the press.** A touch
    long-press on any `draggable=true` element starts a _native_ HTML5 drag,
    cancelling the pointer stream under the pan. The HTML5 transport now
    `preventDefault`s that `dragstart` whenever the press timeline is mid-gesture
    — and once a hold has fired, `touchmove` is cancelled from the first move, so
    the escape's opening travel cannot be read as a scroll either.

- 631606c: Separate `FileSystem` and `FileIcon` into their own `file-system` category.

  - Moves `FileSystem` out of `display` into a new top-level `file-system` category
  - Extracts `FileTypeIcon`, `FileSystemFolderGlyph` and their supporting utilities into a standalone `FileIcon` component at `./file-icon`
  - Storybook titles updated to `File System/FileSystem` and `File System/FileIcon`
  - No API changes; existing `./file-system` and new `./file-icon` export paths are stable

- e86dced: fix(FileSystem): the marquee works in the columns view, and no longer collapses the column it runs in

  Two bugs stopped the selection box from being usable in `ColumnsView`.

  It could not start. The web drag transport captured the pointer as soon as the
  press passed the drag slop, then asked `begin()` whether there was anything to
  drag. On empty space `begin()` returns false and the trip resets — but the capture
  had already happened, so the column's marquee listener never saw the pointer it
  was waiting for. Capture now happens after `begin()` confirms a source, which
  leaves the pointer free for a child listener when the press lands on nothing. The
  list and icons views run the same transport and gain the same ordering.

  It collapsed the trail. Each column past the first exists because a folder is
  selected in the column to its left, and a marquee replaces the selection with
  whatever it covers. Sweeping inside a sub-column therefore deselected the parent
  folder that opened it, and the column vanished from under the pointer mid-drag.
  Each column now injects the trail paths into the marquee's base, so the folders
  that opened it stay selected. Column 0 has no trail to protect and is unchanged.

  `FileSystemColumn`'s `onClearSelection` is gone with this — an empty-space press
  now resolves through the marquee, which reports an empty covered set and clears
  the selection on its own. The component is internal, so the public API is
  unchanged.

- 85d5ada: fix(FileSystem): list-view width init, external drop indicator, and store refactors

  - Initialize `width` state to `null` instead of `0` in `FileSystemListView` — distinguishes "not yet measured" from a genuine zero, so `showDate` defaults to visible and the date column no longer flickers on mount at wide breakpoints.
  - Replace the two conditional external-drop JSX branches with an `ExternalDropIndicator` component that encapsulates the folder-row vs. full-area fallback logic.
  - Use `rowsRef.current.length` directly in `hitTest` and remove the now-redundant `rowCountRef`.
  - Split react-native mixed `import` into a `import type` block + a value import block.
  - Extract `resolveFolderName` helper in `file-system-context.tsx` — eliminates four identical inline ternaries that computed the current folder display name.
  - Extract `historyStep` helper — `goBack` and `goForward` were duplicating the same nav/search/entries recompute patch; both now delegate to a single function.
  - Add result-caching to `computeFileTypeOptions` keyed on index identity — the walk-and-sort runs once per index change instead of once per store action.
  - Use `cancelSearchDebounce()` consistently in `setSearchInput` instead of a direct `clearTimeout`.

  fix(MultiStepMenu): reduce sidebar divider from `border-r-2` to `border-r`

- 56b1f2f: fix(FileSystem): correct search and subfolder scoping in `computeVisiblePaths`

  - Match search query against `entry.name` instead of the entry path — id-based paths don't embed the display name so the old path-substring test eliminated every result on any non-empty query.
  - Replace `path.startsWith(currentPath)` with a `parentPath` chain walk through the index — flat parentPath manifests assign each entry a single-segment id path, so string-prefix containment never held for nested folders.
  - Apply the same `parentPath`-aware ancestor walk in `markVisible` so highlighted entries correctly bubble up to the current folder in flat manifests.

- ff3582a: fix(HoverMenu): hover opens a pressable trigger, and a controlled `open` renders the panel

  The hover pair was `Pressable`'s `onHoverIn`/`onHoverOut`. react-native-web
  implements those with `useHover({ contain: true })`, which dispatches a bubbling
  `react-gui:hover:lock` event on enter — and an ancestor using the same hook reads
  a lock from a different target as its own hover-end. Every nested `Pressable`
  therefore cancelled its ancestors' hover:

  - A pressable trigger (a `Button`) fired the lock as the pointer reached it, so
    the wrapper's hover ended one tick after starting and `handleHoverOut` cleared
    the pending open timer. The menu only ever opened on press.
  - `MenuItem` is a `Pressable` too, so moving onto an item ended the panel's hover
    and scheduled a close while the pointer was still inside it.

  Both are now on `onPointerEnter`/`onPointerLeave` — plain DOM events with no lock
  protocol, which fire once for the element-plus-descendants region and ignore
  movement between children. That is exactly the wanted semantics, and a nested
  pressable is invisible to them. RNW forwards both props to the DOM node and they
  are part of RN's own `ViewProps`, so this stays type-safe and is inert on native,
  where `canHover` gates it anyway.

  Separately, a controlled `open` flipped from outside the menu left the panel
  invisible. The panel renders on `open && rect`, and the trigger was only measured
  on the paths the menu drives itself — the hover timer and `toggle`. A consumer
  setting `open` from a keyboard shortcut, a switch, or a route change never touched
  either, so `rect` stayed null. Measuring is now keyed on `open` becoming true,
  whatever set it, which is also correct in general: the trigger may have moved since
  the last measurement. `measure` bails on an identical rect so the extra pass costs
  no re-render.

- e0b326e: `MenuItem`: the active icon-tile row fills with `info` rather than `primary`

  The `iconBackgroundColor` variant painted its active row `bg-primary/75`, with a
  `font-semibold text-primary-foreground` label. `primary` is the monochrome token
  consumers are meant to repaint with their own brand colour, so the active row
  came out near-black in light mode and near-white in dark — an inverted row rather
  than a selected one — and any consumer who retinted `primary` got their brand
  colour as the selection fill whether they meant to or not.

  It is `bg-info` now, at full opacity, with a `text-info-foreground` label: the
  same vivid blue that already reads as "this one is picked" elsewhere in the
  library, on both schemes, and not a token consumers are invited to repaint. The
  label drops to normal weight — the fill carries the state, so the extra weight
  was doing the same job twice, and it kept the active row a hair wider than its
  neighbours.

  `text-info-foreground` is white in both schemes, which is what a vivid blue fill
  wants. `primary-foreground` would have flipped to near-black in dark mode.

  `MultiStepMenu`'s `MenuRow` picks this up, since it renders the variant. Nothing
  to change on your side unless you were relying on `primary` to tint the active
  row; that hook is gone on purpose.

- 48e1a5c: fix(theme): native read the dark values in both schemes — tokens.css now declares each scheme through `@variant`

  Every surface on native rendered its dark value regardless of the active scheme. In the native Storybook the symptom was a page that disagreed with itself: white chrome, dark cards. Web was unaffected throughout.

  tokens.css expressed dark mode the way a plain Tailwind sheet does — light values in `@theme`, dark values in `@media (prefers-color-scheme: dark) { :root:not(.light) }` plus a bare `.dark` block. Both dark forms are correct CSS and both work on web. Neither is a shape uniwind recognises as a theme.

  uniwind builds `vars.light` and `vars.dark` from one shared global base that diverges _solely_ via per-theme override buckets, and it fills those buckets only from declarations whose selector carries `:where(.light, …)` / `:where(.dark, …)`. Compiling the sheet produced no buckets at all: the `.dark` block parsed as a utility class named `dark`, and the media-query dark values fell through to the global base as the last write. So both scheme maps existed, both were byte-identical, and both held dark values — which is also why toggling the scheme changed nothing.

  The per-scheme values now live in top-level `@variant light` / `@variant dark` blocks, which expand to exactly that `:where()` shape. `@theme` keeps the light values, since that is what registers each token with Tailwind and what lands on `:root` for the web base, and keeps the tokens that don't flip (`--shadow-elevated-*`, `--spacing-button-*`, `--radius-button-*`) — a value that lives only in `@theme` is now theme-independent by construction.

  Web behaviour is unchanged. `@variant` compiles to the same three rules the sheet previously spelled out by hand: a `.dark` class rule, a `.light` class rule, and an OS-preference rule that either class suppresses. A `.light` class is still an absolute override that opts out of OS dark.

  Two consequences worth knowing:

  - **uniwind is now load-bearing for scheme switching on native**, where before the sheet also carried a plain-CSS fallback. It was already required for `className` to do anything at all, so nothing that worked before stops working.
  - **Both `@variant` blocks must declare the identical token set.** uniwind logs a parity error per missing token rather than throwing, so drift is quiet. `scripts/check-token-parity.mjs` now holds `@theme` ⇄ `@variant light` ⇄ `@variant dark` ⇄ the native `LIGHT_OKLCH`/`DARK_OKLCH` tables to one another, and runs in CI.

  The native Storybook preview also drives the scheme through `Uniwind.setTheme()` instead of `Appearance.setColorScheme()`, seeded at module scope so the first paint is already correct, and synced from the `darkMode` arg in an effect rather than during render. `setTheme()` notifies every mounted `className` consumer; doing that mid-render was tearing down Storybook's in-flight render, which is where the `cannot render when not prepared` and `canvasElement is unset` rejections came from.

- Updated dependencies [706dac3]
- Updated dependencies [4eea56d]
- Updated dependencies [9fd7f7d]
  - rn-motion-ui-icons@0.0.1

## 4.0.0

### Major Changes

- b430163: Remove `AvailabilityScheduler` component.
- 45fd462: Remove deprecated `visible`/`onClose` props and clean up internal comments

  **Breaking:** `visible` and `onClose` props have been removed from `BottomSheet`, `FullSheet`, `AdaptiveModal`, and `ActionFeedbackModal`. These were deprecated aliases introduced in the previous minor. Migrate to `open` and `onOpenChange`:

  ```tsx
  // Before
  <BottomSheet visible={open} onClose={close} />
  <FullSheet visible={open} onClose={close} />
  <AdaptiveModal visible={open} onClose={close} />
  <ActionFeedbackModal visible={open} onClose={close} />

  // After
  <BottomSheet open={open} onOpenChange={close} />
  <FullSheet open={open} onOpenChange={close} />
  <AdaptiveModal open={open} onOpenChange={close} />
  <ActionFeedbackModal open={open} onOpenChange={close} />
  ```

  **Breaking:** `state?: never` has been removed from `MotiPressableProps`. It was a no-op guard and carries no runtime effect.

  Internal call sites (`AdaptiveDropdown`, `CommandPalette`, `MultiStepMenu`) have been updated to the new API. The `PopoverCtx` internal type is renamed to `PopoverContext` (unexported; no public API change). Inline `RN FALLBACK vs web` implementation notes have been removed from component files.

- fc3b682: Remove `NotFound` component.

### Minor Changes

- a2ff66d: `FileSystem`: the background context menu now opens over the empty area

  `getBackgroundContextMenuActions` used to need a view to right-click. The placeholder that stands in for the file area — an empty folder, a search with no hits, filters that match nothing, a folder still loading — is now mounted in the same background surface the list and icons views use, so a right-click (web) or long-press (native) anywhere in it opens the background menu. An empty folder is exactly where a "New folder" action matters most.

  It uses the same single-open coordination as the views, so opening it closes any other file-system menu.

  **Also:** the background menu's title at the root now comes from the `title` prop instead of a hardcoded `'Files'`. Inside a folder it is the folder name, as before.

- 22b260f: `FileSystem`: multi-selection — Ctrl/Cmd-click, Shift-range, long-press, and a selection box

  `selectionMode="multiple"` lets more than one entry be selected at a time, with the gestures a file browser is expected to have:

  - **Ctrl-click** (Cmd-click on macOS), or a **long-press** on touch: toggle the entry under the pointer in or out of the selection.
  - **Shift-click**: take the contiguous run from the anchor — the last entry picked without Shift — to the entry pressed. The anchor stays put, so shift-clicking around grows and shrinks one run rather than accumulating; hold Ctrl/Cmd as well to add the run to what is already selected.
  - **A selection box** dragged across empty space, web only, in all four views — the list, the icons grid, any columns pane, and the gallery filmstrip (which bands horizontally, being a horizontal list). Everything the band touches is selected live as it is drawn; hold Ctrl/Cmd as you start it to add rather than replace. A box only starts from a point that is not on an entry, so a drag that begins on a row still moves that row.

  A plain press still replaces the selection, and a press on the background still clears it. All four views paint the selection, and the status bar counts it with a Clear affordance once there is more than one.

  The ordering a Shift-range runs through comes from the view you pressed, not from the store: the list view runs through its rows as drawn (an expanded folder's children included, since they sit between their parent and its next sibling), and the columns view keeps each pane to itself, so a range never jumps across the trail into a sibling folder.

  The selected set arrives through a new `onSelectedItemsChange(items)`, in the order the entries were picked. `onSelectionChange(item)` is unchanged and now follows the _lead_ — the entry added most recently — which is what the columns trail, the columns preview pane and the gallery stage keep showing. `renderBody` gains `selectedEntries`, and `renderFooter` gains `selectedCount` and `clearSelection`.

  Dragging an entry that belongs to a multi-selection now moves the whole selection: `onMove` reports every path in one `sources` array instead of firing per entry. Members the drop would not actually move — the destination itself, entries already inside it, a folder dropped into its own subtree — are filtered out first, and nothing fires when that leaves the list empty. Dragging an _unselected_ entry is still a single-entry drag.

  Two things to know before switching it on:

  - Long-press is already the entry context menu's trigger on touch, and multi-selection takes it over. With `getContextMenuActions` the menu still opens on right-click on web, but on touch it becomes unreachable — so pick one, or surface those actions elsewhere.
  - With `draggable`, a hold on native starts a drag (at 300 ms) before a long press resolves (at 500 ms), so the toggle gesture is effectively web-only in the list and icons views.

  Two fixes fall out of the same work, and apply whatever `selectionMode` is set to:

  - Entry rows and tiles now carry `aria-selected`. They only ever set `accessibilityState={{ selected }}`, which react-native-web does not map to anything, so on web the highlight fill was the only thing saying an entry was picked — assistive tech was told nothing at all.
  - A drag in the grid view now only lifts a tile when the press actually landed on one. It used to resolve the press to the _nearest_ tile, so a press in the padding or in a gutter between tiles would lift a neighbour you had not touched.

  The default is `selectionMode="single"`, which behaves exactly as before — except that re-selecting the entry you had already selected before navigating away and back no longer fires a duplicate `onSelectionChange`.

- dd54f5d: `FileSystem`: new `renderEmptyState` slot

  Replaces the placeholder that stands in for the file area when there is nothing to show, so "This folder is empty" is no longer the only option. `args.reason` says which of the four cases you are drawing — `'empty-folder'`, `'no-search-results'`, `'no-filter-matches'`, or `'loading'` — and `args.label` carries the copy the built-in placeholder would have used, ready to reuse. The rest of the args (`currentPath`, `folderName`, `view`, `searchValue`, `isSearching`, `hasActiveFilters`) describe the state that emptied it.

  The slot is per-reason rather than all-or-nothing: return `undefined` to fall through to the built-in placeholder for that state, so you can take over the empty folder and leave the loading spinner and the no-results message alone. Return `null` to draw nothing.

  Like `renderBody`, it is called as a plain function rather than rendered as a component — don't call hooks directly in it, put them in a component you render inside the returned tree.

  ```tsx
  <FileSystem
    items={items}
    renderEmptyState={({ reason, folderName }) =>
      reason === "empty-folder" ? (
        <EmptyFolderPlaceholder folder={folderName} onPick={upload} />
      ) : undefined
    }
  />
  ```

  `FileSystemEmptyStateArgs` and `FileSystemEmptyStateReason` are exported alongside it. Whatever the slot returns is mounted in the same background surface the built-in placeholder uses, so `getBackgroundContextMenuActions` still opens over it.

- 643d0ff: Add `MenuItem` — a shared menu-row primitive, now exported as `rn-motion-ui/menu-item`

  `CommandPalette` and `MultiStepMenu` each carried their own near-identical menu-row markup (leading icon, label, active highlight, trailing slot). That row is now a single component with two visual modes selected by `iconBackgroundColor`:

  - **Default** — CommandPalette style: animated `bg-surface-selected` overlay, 16 px themed icon, `py-2` padding, `text-sm` label.
  - **iOS-style** (`iconBackgroundColor` set) — Settings/MultiStepMenu style: coloured rounded-square icon, `bg-primary/75` active highlight, `h-11` row, `text-base` label.

  ```tsx
  import { MenuItem } from "rn-motion-ui/menu-item";

  <MenuItem
    icon={Bell}
    label="Notifications"
    active={isActive}
    onPress={select}
  />;
  ```

  `MultiStepMenu`'s `MenuRow` and `CommandPalette`'s internal `CommandRow` are now thin wrappers over it — no public API change to either, beyond `MenuRowProps['icon']` being typed as the exported `MenuItemIcon` (structurally identical to the previous local `IconRenderer`) and `CommandIconProps` becoming an alias of the shared `IconProps` (widened with the optional `strokeWidth`, `style` and `accessibilityLabel` fields; existing icon renderers stay assignable).

  `BottomSheet`'s sheet container moves onto `cn()` + the `SURFACE_CLASSNAME` ladder. Two visual consequences: it now carries `shadow-elevated-3` alongside `bg-surface-3`, and its non-full-sheet top radius changes from `rounded-t-2xl` to `rounded-t-lg`.

  Also folded template-literal class concatenation into `cn()` in `ActionFeedbackModal`, dropped the now-unneeded `useSortedClasses` biome-ignore comments, and rewrote the `AdaptiveDropdown` / `HoverMenu` stories to use the shared row instead of local one-off copies.

- b2d501d: `CardChoice` → `RadioCard`, now animating per card, plus a new multi-select `CheckboxCard`

  **Breaking:** `CardChoice` has been renamed to `RadioCard` to say what it is — a
  card-shaped radio — and to pair with the new `CheckboxCard`. The subpath moved
  with it; there are no deprecated aliases.

  | Old                        | New                       |
  | -------------------------- | ------------------------- |
  | `rn-motion-ui/card-choice` | `rn-motion-ui/radio-card` |
  | `CardChoice`               | `RadioCard`               |
  | `CardChoiceGroup`          | `RadioCardGroup`          |
  | `CardChoiceGroupProps`     | `RadioCardGroupProps`     |
  | `CardChoiceProps`          | `RadioCardProps`          |

  The default group `testID` prefix follows the rename: `card-choice-group` →
  `radio-card-group`, so derived ids become `radio-card-group-card-<value>`,
  `-ring`, `-dot` and `-badge`.

  ```tsx
  // Before
  import { CardChoice, CardChoiceGroup } from "rn-motion-ui/card-choice";
  <CardChoiceGroup value={plan} onValueChange={setPlan}>
    <CardChoice value="monthly" title="Monthly" subtitle="$12/mo" />
  </CardChoiceGroup>;

  // After
  import { RadioCard, RadioCardGroup } from "rn-motion-ui/radio-card";
  <RadioCardGroup value={plan} onValueChange={setPlan}>
    <RadioCard value="monthly" title="Monthly" subtitle="$12/mo" />
  </RadioCardGroup>;
  ```

  **Breaking: the shared gliding dot is gone.** `RadioCardGroup` used to render a
  single dot that measured each card's radio ring (`measureInWindow`) and glided
  between them. Selection now animates per card instead: the ring's border and the
  card's border cross-fade between `border` and `info`, the background tint
  cross-fades in the same pass, and the dot fades and scales in place. No geometry
  is measured, so selection no longer depends on layout settling.

  What changes for callers:

  - **The selected accent is `info`, not `primary`.** The ring border, dot, card
    border and background tint all resolve from `--color-info`, so selection reads
    as state rather than as the page's brand action colour. The dot also grew from
    10 px to 14 px inside the 20 px ring. The `badge` pill is unaffected — it stays
    `primary`, since it labels the offer, not the selection.
  - **`radio-card-group-indicator` no longer exists.** Each selected card renders
    its own dot at `<card testID>-dot`. Previously that id only appeared on
    standalone cards; inside a group it is now present too.
  - **`transition` retimes the cross-fade, not a glide.** The default moved from
    `MOTION_SNAPPY` (a spring, appropriate for travel) to `TIMING_FAST` (150 ms
    timing, appropriate for a fade). A spring is still accepted.
  - **`RadioCard` takes its own `transition`**, overriding the group's — the same
    group-cascades-to-card shape `CheckboxCard` uses for `checkTransition`.
  - **`className` and `style` now target the animated card surface**, the bordered
    padded box inside the pressable. A `Pressable` can't be animated directly, so
    the border and tint live on a `MotiView` inside it and the pressable keeps only
    `flex-1`. Visual overrides (padding, radius, border) behave as before; an
    override of the card's _outer_ footprint (e.g. a fixed `width`) now sizes the
    surface within `flex-1` rather than the pressable itself. Wrap the card to
    control its outer box.

  **Fixed:** `RadioCard` now sets `aria-checked` directly instead of
  `accessibilityState={{ checked }}`, which react-native-web does not forward — the
  selected state never reached the DOM on web, so screen readers announced every
  card as unchecked. Matches `Radio` and `Checkbox`. `RadioCard` also gained an
  `accessibilityLabel` prop, defaulting to `title`, so a card answers with its own
  name rather than its concatenated text content.

  **New: `rn-motion-ui/checkbox-card`** — exports `CheckboxCard` and
  `CheckboxCardGroup`, the multi-select counterpart to `RadioCard`. Same card
  anatomy (title, subtitle, badge, `numeric` subtitle, custom children), with
  `Checkbox`'s animated box in place of the radio ring: the `info` fill and the
  check mark cross-fade on toggle and the box springs down on press. Selection uses
  the same `info` accent as `RadioCard`, so the two read as one family.

  Because any number of cards can be checked at once, `CheckboxCardGroup` owns only
  the selected-value array. It takes `role="group"`; each card answers
  `accessibilityRole="checkbox"` with `aria-checked` / `aria-disabled`.

  Props follow the heroui-native names already used by `Switch` — `isSelected`,
  `onSelectedChange`, `isDisabled`. Group-level `isDisabled` and `checkTransition`
  cascade to every card, and a card can override either.

  ```tsx
  import { CheckboxCard, CheckboxCardGroup } from 'rn-motion-ui/checkbox-card';

  // Grouped — the group owns the selected array
  const [addons, setAddons] = useState<string[]>(['support']);
  <CheckboxCardGroup value={addons} onValueChange={setAddons}>
    <CheckboxCard value="seats" title="Extra seats" subtitle="$4/mo each" numeric />
    <CheckboxCard value="support" title="Priority support" subtitle="$29/mo" badge="Popular" numeric />
  </CheckboxCardGroup>

  // Standalone — the card is driven directly
  <CheckboxCard isSelected={on} onSelectedChange={setOn} title="Audit log" subtitle="$12/mo" />
  ```

  New types: `CheckboxCardProps`, `CheckboxCardGroupProps`.

- 7bb97f1: `StatefulButton`: external reset signal, `afterReset`, and `autoReset` → `shouldAutoReset`

  **Breaking:** `autoReset` is renamed to `shouldAutoReset`. It keeps the same meaning — return to idle once the success/error window closes — and the same `false` default. Rename the prop at the call site; there is no deprecated alias.

  **New `shouldReset`.** A reactive signal, not a mode: raise it and the button resets to idle immediately, wherever it happens to be. It is edge-triggered on the rise, so a parent that leaves it pinned `true` resets the button once rather than on every press — lower it and raise it again to reset again. Raising it on an idle button with nothing in flight does nothing.

  A mid-flight reset takes effect at once instead of waiting for the pending action: the in-flight run is orphaned, so when its promise finally settles it neither shows its outcome nor opens a terminal window, and `afterSuccess` / `afterError` stay silent for that run.

  **New `afterReset`.** Fires whenever a reset actually returns the button to idle, from either path — the `shouldReset` signal or the `shouldAutoReset` window end.

  The two props answer different questions and compose: `shouldAutoReset` decides what happens when a run's terminal window ends, `shouldReset` lets the parent cut a run short at any point.

  ```tsx
  const [resetSignal, setResetSignal] = useState(false);

  <StatefulButton
    onPress={submit}
    shouldReset={resetSignal}
    afterReset={() => setResetSignal(false)}
  />;
  ```

- 736a452: `Switch`: heroui-native prop names + compound sub-components

  **Breaking:** Props have been renamed to align with heroui-native conventions. Update call sites accordingly — there are no deprecated aliases.

  | Old               | New                |
  | ----------------- | ------------------ |
  | `checked`         | `isSelected`       |
  | `onCheckedChange` | `onSelectedChange` |
  | `disabled`        | `isDisabled`       |

  **Compound sub-components.** `Switch` is now a compound component; the following sub-components are available:

  - `Switch.Thumb` — sliding pill thumb. Spring-animated; squishes lightly on press. Accepts a `thumbTransition` override and render-function children `(props: SwitchRenderProps) => ReactNode`.
  - `Switch.Label` — pressable label container. Tapping it toggles the switch (like an HTML `<label>`). Disabled automatically when `isDisabled` is set.
  - `Switch.StartContent` — absolutely-positioned icon slot on the left (start) side of the track; typically holds an icon visible when the switch is off.
  - `Switch.EndContent` — absolutely-positioned icon slot on the right (end) side of the track; typically holds an icon visible when the switch is on.

  When no `children` are provided, `<Switch.Thumb>` is rendered automatically, preserving the existing visual behaviour.

  **New exports:** `useSwitch()` hook for accessing switch state from within sub-components, and `SwitchRenderProps`, `SwitchThumbProps`, `SwitchLabelProps`, `SwitchContentProps` types.

  ```tsx
  // Before
  <Switch checked={on} onCheckedChange={setOn} disabled={false} label="Enable" />

  // After — basic (drop-in)
  <Switch isSelected={on} onSelectedChange={setOn} isDisabled={false} label="Enable" />

  // After — custom thumb with icon slots
  <Switch isSelected={on} onSelectedChange={setOn}>
    <Switch.StartContent><MoonIcon /></Switch.StartContent>
    <Switch.Thumb />
    <Switch.EndContent><SunIcon /></Switch.EndContent>
  </Switch>
  ```

- 6b591be: `Switch`: custom colour themes, defaulting to `info`

  **New: `theme`.** The switch's three fills — the selected track, the unselected
  track and the thumb — are now a theme rather than two hardcoded classes. Pass a
  built-in name, or an object to override individual slots.

  ```tsx
  <Switch isSelected={on} onSelectedChange={setOn} theme="success" />
  ```

  Six built-ins, one per status token plus the monochrome `primary`: `info`
  (default), `primary`, `success`, `warning`, `danger`, `special`. Each pairs a
  vivid track with the thumb colour that stays legible on it — the status fills
  take a `white` thumb, `primary` takes `primary-foreground` instead, because
  `primary` is near-white in dark mode and a white thumb would vanish into it. The
  grey off-track is shared by all six, so a row of mixed themes reads as one
  family.

  **Breaking: the default look changed.** The selected track was `bg-primary`
  (near-black on light, near-white on dark) and the thumb was `surface-3`. The
  default `info` theme makes the track the `info` blue and the thumb `white` in
  both schemes, matching the accent `RadioCard` and `CheckboxCard` already use for
  selection — selection reads as state rather than as the page's brand action
  colour. The unselected track is unchanged (`muted-foreground` at 60%). Pass
  `theme="primary"` for the previous appearance:

  ```tsx
  // What theme="primary" restores — the previous default look
  <Switch isSelected={on} onSelectedChange={setOn} theme="primary" />
  ```

  **Custom themes.** An object overrides slots on top of `info`, so anything left
  out keeps the default — `{ track: '#0ea5e9' }` still gets the grey off-track and
  the white thumb. Each slot takes one of three things:

  | Slot value                       | Resolves to                                                                          |
  | -------------------------------- | ------------------------------------------------------------------------------------ |
  | `'accent'`                       | the `--color-accent` token, so it follows light/dark and consumer `@theme` overrides |
  | `'special/70'`                   | the same token re-alphaed to 70%, as Tailwind's slash modifier does                  |
  | `'#0ea5e9'`, `'rgba(0,0,0,0.4)'` | itself — any literal CSS colour RN parses                                            |

  ```tsx
  // Tokens — tracks the theme
  <Switch
    isSelected={on}
    onSelectedChange={setOn}
    theme={{ track: 'accent', trackOff: 'muted', thumb: 'accent-foreground' }}
  />

  // A literal brand colour for the on-track, defaults for the rest
  <Switch isSelected={on} onSelectedChange={setOn} theme={{ track: '#0ea5e9' }} />
  ```

  Fills are set through `style` from resolved values rather than by a utility
  class, because a slot accepts an arbitrary CSS colour, which no class can carry.
  Token names still go through the theme bridge, so a themed slot follows
  light/dark exactly as a class would.

  **New testIDs.** The track and thumb now carry ids derived from the switch's own:
  `<testID>-track` and `<testID>-thumb` (`switch-track` / `switch-thumb` by
  default). Previously neither was addressable.

  **`useSwitch()` gained two fields.** `colors` holds the active theme's three
  fills resolved to concrete sRGB — `Switch.Thumb` paints `thumb`, and custom
  content can read the track fills to match them. `testID` is the switch's
  resolved id, which sub-components derive their own from.

  New types: `SwitchThemeName`, `SwitchThemeColors`, `SwitchColor`, `SwitchColors`
  — all exported from `rn-motion-ui/switch`.

- e7fe0f1: Theme: `white` and `black` are now first-class tokens

  Two absolute colors join the token sheet. Unlike every other color token they do **not** flip with the theme — `oklch(100% 0 0)` and `oklch(0% 0 0)` in light, dark, and on native — so they cover the places where a fixed color is the design intent rather than an oversight: a glyph sitting on a vivid status fill, a gloss highlight, a scrim.

  They are available everywhere the other tokens are — the `bg-white` / `text-black` / `border-white` utilities, and `useThemeColor` / `useThemeColors`:

  ```tsx
  <Text className="text-white">Legible on a vivid fill in both schemes</Text>
  ```

  ```ts
  const white = useThemeColor("white"); // "rgb(255, 255, 255)"
  ```

  `ThemeToken` gains `'white' | 'black'`, and both are declared in all three places a token lives — the `@theme` block, the two dark blocks, and the native OKLCH tables — so `check-token-parity` covers them like the rest. Being achromatic, they pass through `npx rn-motion-ui-tokens` retinting untouched.

  Reach for these instead of a hardcoded `#fff` / `#000`. For anything that should track the theme, `foreground` / `surface-N` are still the answer.

### Patch Changes

- 5c135e4: `FileSystem`: fix filter-pill preset no-op and date-range modal stale draft

  **Filter-pill date preset** — picking a new date preset on an existing filter pill (e.g. changing "1 month ago" to "3 days ago" via the value chip) was a silent no-op. `setFilterDatePreset` matches on `filter.id`; the pill was passing the filter's facet type instead, so nothing ever matched.

  **Date-range modal draft** — closing and reopening the custom date range modal for the same facet showed the previous visit's draft instead of reseeding from the filter's stored bounds. The draft state is now scoped inside `AdaptiveModal`, which unmounts its children on close (wide path via `AnimatePresence` + `useModalRender`; narrow path via `BottomSheet`'s `isMounted` guard). The `DateRangeRequest` carries an `id` counter so reopening the same facet gets a `key` change and re-runs the lazy initialisers from the updated `initialRange`.

  Two regression stories cover both fixes: `Demo: Re-value a filter pill` and `Demo: Custom range starts fresh each visit`.

- 74d2e8b: `FileSystem`: the selected row now reads as a selection rather than as the primary fill

  Selection in the list, icons and columns views was painted with `primary` — the monochrome token consumers are meant to override with their own brand color. So a selected row went near-black in light mode and near-white in dark, and any consumer who retinted `primary` got their brand color as the selection highlight whether or not that was the intent.

  It is `info` now — the vivid blue that already reads as "this one is picked" in a file browser, on both schemes, and is not the token a consumer is invited to repaint. The label, the row's metadata columns, and the expand chevron sit on that fill as `white` rather than `primary-foreground`, which on a vivid blue is what legibility actually wants.

  Nothing to change on your side unless you were relying on `primary` to tint file-system selection; if you were, that hook is gone on purpose.

- f3dd5fa: `FileSystem`: migrate internal state from React Context to per-instance Zustand store

  No public API change. Each `FileSystem` mount now owns a `createStore`-based Zustand store instead of a single React Context value, so sibling instances never share state and re-renders are limited to the slices that actually changed (`useShallow` on every slice hook).

  The old `use-file-system`, `use-file-system-filters`, and `use-file-open` internal hooks are removed; all consumers now call the new granular slice hooks (`useFileSystemNavigation`, `useFileSystemEntries`, `useFileSystemSearch`, `useFileSystemFilters`, `useFileSystemSelection`, `useFileSystemViewer`, `useFileSystemLayout`, `useFileSystemConsumer`) and their matching action hooks.

- fe8d207: `StarRating`: warmer default gold, and inactive stars sit on `accent` rather than `border`

  Two color changes, both visible without touching a prop:

  - The default `activeStarColor` moves from `#edde51` to `#fec700` — the same fixed, theme-exempt gold intent, but warmer and more saturated, so a filled star reads as gold rather than as pale yellow.
  - Inactive stars now fall back to the theme `accent` color instead of `border`. `border` is a translucent hairline token (`oklch(0% 0 0 / 0.1)`), which is right for a 1 px rule and too faint for a filled glyph — empty stars were nearly invisible on light surfaces. `accent` is opaque and tracks the theme, so the empty half of a rating stays legible on both schemes.

  Pass `activeStarColor` / `inactiveStarColor` to keep the previous values.

## 3.4.0

### Minor Changes

- 281ac6a: feat(a11y): accessibility sweep of the overlay, carousel, progress and decorative components, plus a writing-direction primitive

  **Modal semantics.** `BottomSheet` and `ActionFeedbackModal` now expose `role="dialog"` with `aria-modal`, take an `accessibilityLabel`, and contain keyboard focus on the web through the new `useFocusTrap` hook — react-native-web renders `Modal` as an ordinary fixed `<div>`, so Tab previously walked straight out of an open sheet and into the page behind it, where a keyboard user could operate controls they could not see. Native already had containment from `Modal` itself, so the hook is a no-op there.

  `BottomSheet` also gains `closeAccessibilityLabel` (default `'Close'`): the backdrop is now a labelled button, because the drag handle it sits next to is a pointer-only affordance and was the only way to dismiss the sheet. The handle itself is now hidden from assistive technology.

  **Announcements.** `ActionFeedbackModal` wraps its state content in a persistent live region, so a spinner resolving to success or error is announced instead of changing silently. iOS gets an explicit `announceForAccessibility` — `accessibilityLiveRegion` is Android-only and VoiceOver does not re-read a subtree that mutated under it.

  **Values.** `CylinderCarousel` is now an adjustable control with a position value and working increment/decrement actions, giving it a non-pointer way to change slides for the first time. `ScrollProgress` reports `role="progressbar"` and a live percentage, mirrored off the UI thread in 5% steps so the indicator stays frame-driven.

  `RangeSlider` is fixed as part of this: it set React Native's nested `accessibilityValue`, which **react-native-web does not read at all** — it forwards only the flat `aria-value*` props — so on the web the slider announced no value whatsoever. Every value-bearing component now emits both spellings.

  **Decorative content.** `Skeleton` and `Marquee`'s duplicated track are hidden from assistive technology on native as well as web. The marquee previously read its entire contents out twice on iOS and Android.

  **Writing direction.** New `rn-motion-ui/hooks/use-direction` (`useDirection`, `useIsRTL`) and `rn-motion-ui/hooks/direction-provider` (`DirectionProvider`). These exist because `I18nManager.isRTL` cannot be the answer on its own: react-native-web's `I18nManager` is a stub whose `isRTL` is hard-coded `false`, so any component branching on it is silently LTR-only in every browser. The hook reads the right source per platform, and the provider states it explicitly for a subtree.

  `Marquee` is the first component wired up: `direction` accepts the logical values `'start'` (new default, identical to the old `'left'` under LTR) and `'end'` alongside the existing physical ones, and mirrors its travel under RTL — where the platform flips the belt's own row and the old direction tore a gap open in the loop instead of cycling.

  `Tabs` was audited and needs no change: its indicator and slide direction are both computed from measured geometry, which the platform mirrors along with the layout, so they come out right in either direction. That is now covered by an RTL story rather than left as an assumption. `TabsList` gained an optional `testID` — the sliding indicator is exposed as `${testID}-indicator`, so its position can be asserted.

  `RangeSlider` now mirrors under RTL: minimum on the right, filling leftwards, the way a native slider does in an RTL locale. Four things flip together — the pointer mapping (`locationX` is measured from the physical left edge whichever way the page reads, so without this the slider painted mirrored and then jumped to the wrong value on the first press), the fill's growth origin, the thumb's travel, and the tick positions. A new optional `writingDirection` prop opts out, for a track whose axis is a thing rather than a quantity — a timeline or a seek bar.

  `Table` cell alignment now follows the writing direction when a column does not set `align`. Previously the default paired a direction-relative `alignItems: 'flex-start'` with a hard-left `textAlign`, so under RTL the text sat on the left inside a right-aligned cell. An explicit `align: 'left' | 'right'` stays physical — a column of numbers asking for `right` means right. Column _order_ is untouched and now documented as the consumer's call: the table renders the `columns` array as given, since whether the first column belongs on the right depends on what the data means.

  `Table` column drag-to-reorder now mirrors as well. Its drop boundaries are accumulated from column widths in column order rather than measured, so unlike `Tabs` it could not inherit the platform's mirroring — the boundary table describes the logical axis while the pointer's `pageX` is physical, and under RTL the two run opposite ways. Dropping a column on the trailing physical edge now appends it in both directions, and the drop indicator lands on the boundary it marks rather than a column away. The row and column action overlays follow the trailing edge too, instead of pinning to the right.

  That geometry moved out of the hook into three new pure exports on `rn-motion-ui/table-utils` — `columnBoundaries`, `dropIndexAt`, `dropIndicatorX` — so the same drop-target maths a custom header needs is available without reimplementing it, and is unit-testable without a gesture.

  No breaking changes: every new prop is optional and the defaults preserve current behaviour.

- 6c97690: feat(FileSystem): `renderBody` slot for wrapping the file area

  `renderBody` decorates the file area instead of replacing it. Where `renderHeader` and `renderFooter` hand you a state snapshot and take whatever you return, this one also hands you `state.content` — the active view, or the empty/loading placeholder standing in for it — so a drop hint, an upload overlay or a details rail can sit alongside the four views without reimplementing any of them. Returning `state.content` unchanged is a no-op.

  ```tsx
  <FileSystem
    renderBody={({ content, isEmpty }) => (
      <View className="flex-1">
        {content}
        {isEmpty ? <DropHint /> : null}
      </View>
    )}
  />
  ```

  The snapshot is the state that produced the content — `currentPath`, `entries`, `view`, `selectedEntry`, `searchValue`, `isSearching`, `hasActiveFilters`, `isLoadingCurrentFolder`, `isEmpty` — exported as `FileSystemBodyState`, so a wrapper tracks the same selection and folder the views do without recomputing any of it.

  `isEmpty` is not the same as "the placeholder is showing": the columns view keeps its panes over an empty folder, since that is how Finder lets you walk back up a trail, so it only yields to the placeholder while searching or filtering.

  Unlike the header and footer slots, `renderBody` is **called as a plain function rather than mounted as a component**. An inline arrow is a new function identity on every render, and a component whose _type_ changes remounts its entire subtree — here that subtree is the active view, so every keystroke in the search field would have reset its scroll offset, its panes and any in-flight drag. Calling it keeps the returned elements in the parent's own tree, where reconciliation compares them by position as usual. The consequence for callers: don't call hooks directly inside `renderBody` — put them in a component you render inside the returned tree.

  The wrapper renders _inside_ the file-area node rather than around it, so `bodyClassName` still applies and the area keeps its flex sizing and web text-selection guard however you nest things. Give the returned tree `flex-1` (or `size-full`) if it should fill the area the way the built-in views do.

- 6c97690: feat(elevated): export `SURFACE_CLASSNAME`, and drop the built-in frame from `FileSystem` and the `AdaptiveDropdown` panel

  New `SURFACE_CLASSNAME` on `rn-motion-ui/elevated` — a level-indexed map pairing each surface background with the matching elevation shadow, so a custom surface can take both halves of the ladder at one level without calling `surfaceBackground` and `elevatedShadow` separately.

  ```ts
  import { SURFACE_CLASSNAME } from "rn-motion-ui/elevated";

  <View className={SURFACE_CLASSNAME[5]} />; // bg-surface-5 shadow-elevated-5
  ```

  It is a plain record, not a function, so it is indexed rather than clamped: `surfaceBackground` and `elevatedShadow` still take any number and clamp it into range, while an out-of-range index here is a type error and, from untyped JS, `undefined`. Reach for the functions when the level is computed at runtime.

  **Visual change.** `FileSystem`'s root no longer draws `rounded-xl border border-border`, and `AdaptiveDropdown`'s floating panel no longer draws `border border-border`. Both now render an unframed surface, leaving the frame to the container they sit in — a `FileSystem` inside a card or a pane of its own was stacking two borders, and there was no way to opt out.

  `FileSystem` takes the old chrome back through `className="rounded-xl border border-border"`; the shared `cn` resolves consumer classes last-wins, so it applies. The dropdown panel has no such escape hatch — `contentClassName` reaches the body inside the panel, not the panel itself — so its border cannot currently be restored from the outside. It keeps its `rounded-2xl` and its `elevation` shadow, which is what separates it from the page.

  Internally, the per-file `cn` copies in `Card`, `Skeleton` and `AdaptiveModal` — each a comment claiming the package ships no shared `cn` — are replaced by the real `src/lib/cn.ts`. Those copies only concatenated, so a consumer class and a component default targeting the same utility group both survived into the class string and the winner came down to stylesheet order. They now resolve last-wins in the consumer's favour, which is what their prop docs already promised.

- 58c7e45: feat(hooks): export `useSafeInsets` at `rn-motion-ui/hooks/use-safe-insets`

  The hook shipped in the source tree with the `safeArea` overlay work but was never added to the package's `exports` map, so consumers could not import it — `rn-motion-ui/hooks/use-safe-insets` resolved to nothing while every other hook was reachable.

  It resolves device safe-area insets through `react-native-safe-area-context` when that optional peer is installed and a `<SafeAreaProvider>` is above in the tree, and returns zeros otherwise — the same resolution the overlay components use internally, now available for building your own full-screen surfaces.

  ```ts
  import { useSafeInsets } from "rn-motion-ui/hooks/use-safe-insets";
  ```

### Patch Changes

- 2c7878d: fix(MorphingModal): close on overlay tap on the web

  Tapping the scrim did nothing on react-native-web. The layer that positions the card fills the whole modal and is meant to let taps through to the scrim behind it, which it asked for with `style={{ pointerEvents: 'box-none' }}`. But `box-none` is not real CSS — react-native-web implements it in the StyleSheet compiler, which expands it into `pointer-events: none` on the node plus `pointer-events: auto` on its direct children. That expansion only runs for compiled styles; the inline-style path passes the value straight to the DOM, where the browser discards `pointer-events: box-none` as invalid and the node keeps the default `auto`. The positioning layer therefore sat on top of the scrim and swallowed every tap. Moving the style into `StyleSheet.create` runs it through the compiler. Native reads the same style object directly and was unaffected.

  `testID` now also propagates to the scrim as `<testID>-backdrop`, matching `BottomSheet`, so the dismiss target is addressable from tests.

## 3.3.0

### Minor Changes

- 465ac98: feat: `useBreakpoint` — width breakpoints without resize re-renders

  New `rn-motion-ui/hooks/use-breakpoint` exports `useBreakpoint()` and
  `useBreakpointAtLeast(value)`. Both subscribe to `Dimensions` but store only the
  resolved tier, so a component re-renders when the breakpoint flips rather than
  on every resize frame the way `useWindowDimensions` does.

  The scale (`base` / `sm` / `md` / `lg` / `xl` / `2xl`) mirrors Tailwind's default
  `screens` and is the single source of truth for responsive decisions in the
  package — the pure helpers live in `rn-motion-ui/breakpoints` for components that
  measure their own container instead of the window.

  Every component that previously hard-coded a cutoff now accepts an override:

  - `AdaptiveModal`, `FullSheet` — `wideBreakpoint` (default `'sm'`, was a literal 640)
  - `AdaptiveDropdown` — `wideBreakpoint` (default `'md'`, was a literal 768)
  - `FileSystem` — `breakpoints={{ minimal, compact, tablet }}` for its
    container-measured header tiers (defaults 360 / 560 / 768), plus
    `contextMenuWideBreakpoint` (default `'md'`, was a literal 768) for the window
    width at which entry context menus open as a cursor-anchored panel rather than
    a bottom sheet

  Each takes a breakpoint name or a raw pixel number. Defaults are unchanged, so
  this is additive.

- ab84da1: One shared box for the whole button family, driven by tokens. `Button`, `ElevatedButton`, `GlossyButton` and `ActionSwapButton` had each grown their own height/padding/radius table, so an `md` of one type didn't line up with an `md` of another. They now all read the same geometry from `tokens.css` — `--spacing-button-{sm,md,lg}` (32/40/48px), `--spacing-button-pad-{sm,md,lg}` (12/16/20px) and `--radius-button-{sm,md,lg}` (8/10/12px) — so a row of mixed button types has one baseline, and overriding a token retunes every type at once.

  `ActionSwapButton` joins the family properly: it takes a `shape` prop (`'pill' | 'rounded'`, default `'pill'` so existing buttons look the same), its `size` is now the family's `ButtonSize`, and its label uses the family's type ramp instead of a duplicate of it. `ActionSwapButtonSize` is now an alias of `ButtonSize` and `ActionSwapButtonShape` of `ButtonShape` — both still exported.

  Visible changes, per type:

  - **`Button`** — `md` and `lg` lose 4px of horizontal padding (20→16, 24→20); the `rounded` shape moves off a flat 12px radius onto the 8/10/12 ramp; `icon` grows from 32 to 40px so it squares the `md` height.
  - **`ElevatedButton`** — padding grows 2–4px per size (10→12, 14→16, 16→20); `icon` grows from 32 to 40px. Radii are unchanged (AlignUI's 8/10/12 is what the shared ramp was drawn from), and its 14px label is still the documented opt-out from the type ramp.
  - **`GlossyButton`** — `md` grows 36→40px and `lg` 44→48px to join the family's height ramp; padding drops at `md`/`lg` (20→16, 24→20) and grows at `sm` (10→12); `icon` grows 36→40px; the `rounded` shape moves off a flat 12px radius onto the ramp. The 2px inset around the label is gone, so a glossy label sits at the same inset as a flat one.
  - **`ActionSwapButton`** — same height and padding as before at every size. Its content gap is now a flat 8px (was 6 at `sm` and 10 at `lg`).

  Adornment spacing is one value across the family now (8px). `ElevatedButton` previously spaced its content at 12px and pulled icons back in by 4px, which netted the same 8px beside a label — the difference only showed with two adornments.

  `StatefulButton`'s success/error padding squeeze is derived from the shared padding rather than tabulated, so it stays proportional if a token is overridden.

- de66bc8: feat(ui): `FileSystem` headless header/footer slots + per-region classNames

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

- 19c5bbc: `HoverMenu`'s render-prop `trigger` now receives `{ open, toggle }` instead of just `{ open }`, matching `AdaptiveDropdown`. A trigger that is pressable in its own right (a `Button`, a `Pressable`) claims the press, so the wrapper's own toggle never fires — `toggle` is what lets such a trigger open the menu. Also adds `triggerIsPressable`: set it and the wrapper drops its button role, `aria-expanded`, `onPress` and tab stop, since the trigger already carries all four. Without it, web renders a `<button>` inside a `<button>` and keyboard users get two tab stops for one control. Hover stays on the wrapper either way, so web hover-open is unaffected. Both are additive — a plain node trigger keeps the wrapper-owns-the-press behaviour unchanged.

  Stories: add the `glossy` trigger kind to the shared story `TriggerButton`, which gives every overlay playground that showcases trigger variants (ActionFeedbackModal, AdaptiveModal, BottomSheet, CommandPalette, FullSheet, MorphingModal) a GlossyButton chip. The `HoverMenu` and `AdaptiveDropdown` playgrounds gain that same Trigger chip row, so all four launch styles can be swapped under one live overlay; each keeps its previous plain-node trigger in a section of its own to demonstrate the wrapper-owns-the-press path.

- f2d4ba4: feat(overlays): safe-area insets on by default for full-screen overlays

  `FullSheet`, `BottomSheet`, `Drawer`, and `AdaptiveModal` now accept a `safeArea` prop (default `true`) that applies device safe-area insets — status-bar top and home-indicator bottom — to the overlay content.

  When `react-native-safe-area-context` is installed and a `<SafeAreaProvider>` is present in the tree, real device insets are used. If the package is absent, insets fall back to zero so existing consumers without it are unaffected.

  Pass `safeArea={false}` to opt out and manage insets yourself.

- 8d996ce: **Breaking — `StatefulButton`'s `elevated` prop is replaced by `chip`.** `elevated` was a boolean with one alternative to the flat button; there are now two chip keys, so the flag becomes a mode:

  ```diff
  -<StatefulButton elevated onPress={submit}>Save</StatefulButton>
  +<StatefulButton chip="elevated" onPress={submit}>Save</StatefulButton>
  ```

  Omitting `chip` renders the flat button, exactly as omitting `elevated` did. `elevated` is gone rather than deprecated — it shipped one release ago in 3.2.0, and keeping a boolean that means "one particular chip" beside the mode it is a subset of reads worse than the rename costs.

  The new value is `chip="glossy"`: the `GlossyButton` key (domed SVG gradient, inset bevel, OKLCH-derived cast) driven through the same machine. Either key keeps its full appearance through loading/success/error instead of greying out, and each state adopts the matching variant — idle/loading map the flat variant onto that key's palette (danger family → `danger`, `special`/`inverse` carry over, everything else → the key's neutral fill), success switches to the `success` key, error to the `danger` key. Full fill, gloss, rim and cast, not a flat overlay: neither chip paints the flat button's crossfaded colour plate, because it has a variant to switch instead. Glossy dims whole-key via opacity rather than recolouring its label, so its idle content colour comes from `glossyContentColor` and holds constant across states.

  The success/error horizontal padding squeeze is now derived from the family's shared `--spacing-button-pad-*` rather than tabulated per size, so retuning a padding token keeps the squeeze proportional.

- fd1d111: `Tabs` gains a choice of content-panel animation. `contentAnimation` on `Tabs` sets it for every panel, and `animation` on a single `TabsContent` overrides it for that panel only:

  - `fade` (default) — the existing cross-fade with a 4 px settle, unchanged, so nothing shifts for current consumers.
  - `slide` — the panel you land on travels a full container width in from the side the selection moved towards, while the panel you left is pushed out the opposite way, so the pair reads as one page displacing another rather than as a nudge. Sized for mobile screens and modals. Direction is read off the triggers' measured rects rather than the order the panels were declared in, so it also holds for controlled changes: a programmatic jump to a tab slides the same way a press on that tab would. Travel distance is measured on the `Tabs` root, so the first panel — which has no previous page to push out — just fades in.
  - `dropIn` — the panel falls from above on a springy scale-up.

  `fade` and `dropIn` are enter-only: `TabsContent` renders nothing for the tab it isn't showing, so a switch is an unmount plus a fresh mount, with no exiting layer to co-ordinate. `slide` is the exception, since a page swap only reads as one if the page you left is visibly pushed aside. The outgoing panel keeps its subtree mounted for the length of the push, leaves the layout flow immediately so it can't displace the panel replacing it, and finishes the trip as an absolutely positioned layer over the spot it held — hidden from assistive tech and non-interactive while it travels, then unmounted. Under `prefers-reduced-motion` every animation collapses to the same plain opacity fade with no exit layer at all — the cross-fade is information, the transforms are decoration.

  A full-width slide has to be clipped or the travelling pages paint outside the `Tabs` box, so `slide` panels mount inside an `overflow: hidden` wrapper. The clip is scoped to the motion: an arriving panel lifts it once it has landed, which keeps shadows and any overlay a panel raises inline from being cut off for the rest of the panel's life, and a departing panel simply stays clipped until it unmounts.

  `contentTransition` is the matching escape hatch, partial like `indicatorTransition`: pass only the fields you want changed and the rest come from that animation's default (180 ms timing for `fade`, 280 ms linear for `slide`, a spring for `dropIn`).

  Story: the playground gains a Content animation chip row wired to the live controlled set, a section with one tab set per animation for clicking through them side by side, and a modal-width sample where the full-width slide reads properly. `Demo: Slide (both directions)` tours forward and back at that width.

- 0cae697: Per-entry `testID`s in the file browsers, so every row/tile is addressable on its own. The id is keyed by the path that already identifies the entry (folders keep their trailing slash), the way `Table` keys rows by id. No new props: the ids derive from the component's root `testID`, falling back to the component name when it is omitted.

  - `FileSystem` — each entry is `${testID ?? 'file-system'}-entry-${path}`, the same id in all four views (list rows, icons tiles, columns rows, gallery filmstrip tiles), so a test that switches views keeps its queries.

  Additional per-item `testID`s, filling the gaps left by the previous release:

  - `CardChoice` — accepts `testID` and forwards it to the card `Pressable` (standalone or inside a `CardChoiceGroup`). Inside a group it now defaults to `${group testID ?? 'card-choice-group'}-card-${value}`, keyed by the `value` that already identifies the card, so cards are addressable without threading ids through each one. The radio ring is `-ring`, its standalone dot `-dot`, the badge `-badge`, and the group's gliding indicator `${testID ?? 'card-choice-group'}-indicator`. A standalone card has no group and no `value` to key on, so its inner ids only appear when you pass a `testID`.
  - `RadioGroupItem` — each item defaults to `${group testID ?? 'radio-group'}-item-${value}`, with the ring at `-control` and the group's gliding indicator at `${testID ?? 'radio-group'}-indicator`. Previously only an explicitly passed `testID` reached the item's `Pressable`.
  - `CommandItem` — new optional `testID` field; forwarded to each row's `Pressable` in `CommandPalette`.
  - `BouncyAccordionItem` — new optional `testID` field; forwarded to each row's trigger `Pressable`.
  - `TabsContent` — accepts `testID` and forwards it to the content wrapper.

- a981e3b: New `ThemedIcon` at `rn-motion-ui/icon` wraps any icon from `rn-motion-ui/icons` and resolves its stroke colour from the active theme, so an icon can be placed by the name of the surface it sits on rather than by a colour threaded down from a hook call.

  Two ways to name that colour, `token` winning if both are given:

  - `variant` takes any `ButtonVariant` or `ElevatedVariant` name and maps it to that fill's legible partner — `variant="primary"` gives `primary-foreground`, `variant="ghost"` gives `muted-foreground`, `variant="success"` gives `success-foreground`, and the outline/ghost danger variants give the `danger` hue itself since there is no fill to sit on. The mapping is the same one `ElevatedButton`'s `elevatedContentColor` and `Button`'s label cva already use, so an icon passed as a button adornment lands on the colour that button's own label would. Defaults to `secondary`, i.e. the plain `foreground` token.
  - `token` skips the lookup and resolves a `ThemeToken` directly, for icons whose colour isn't a button variant — a `success-foreground` check inside a green circle, or a colour that flips between two tokens on a state, `token={isActive ? 'foreground' : 'muted-foreground'}`.

  Everything else in `IconProps` (`size`, `strokeWidth`, `style`, `accessibilityLabel`) is forwarded untouched.

  Internally, the components that were each calling `useThemeColor`/`useThemeColors` solely to hand a colour to an icon now use it instead: `ActionFeedbackModal`, `BloomMenu`, `BouncyAccordion`, `CommandPalette`, `FeedbackWidget`, `Input`, `OtpInput`, `OverflowActions`, `Table`'s pagination footer, and the `FileSystem` toolbar, header, list view, menus, filter menu, filter pills, and date-range modal. Rendered colours are unchanged. Where the icon wanted the `foreground` token anyway, the wrapper is dropped altogether — icons already fall back to `foreground` when given no `color`, as in `BloomMenu`'s cells.

  `MenuRow` in `MultiStepMenu` gains `iconColor`, defaulting to the `white` it previously hard-coded. That default is right for the vivid iOS-style icon squares the row is built around, but `iconBackgroundColor` is a free-form colour, and a pale or neutral fill needs a darker icon to stay legible. Its active label also moves from a literal `text-white` to `text-primary-foreground`, which is the same colour but follows the theme.

### Patch Changes

- ab84da1: `GlossyButton` labels now use the Button family's type ramp instead of their own. The ramp moves to `LABEL_TEXT_CLASS` in `button-scale.ts`, and both `Button`'s `label` cva and `GlossyButton` read it, so a glossy `md` renders the same text as a flat `md` — which is what `StatefulButton`'s `chip="glossy"` was already doing for its rolling label. Visible change: glossy labels go `font-medium` on the `text-xs`/`text-sm`/`text-base` ramp rather than `font-normal` at a fixed 17px (14px at `sm`). `ElevatedButton` is unchanged — AlignUI pins its chips to 14px at every size.

## 3.2.0

### Minor Changes

- d8bf622: Add the `special` and `inverse` variants to `Button` and `ElevatedButton`, so all three button families now cover the same palette as `GlossyButton`. `special` fills with the non-semantic `special` token — for promotions and upgrade paths, where `info`/`success`/`warning`/`danger` each carry a meaning. `inverse` fills with `foreground` and punches its label through to `surface-1`: deliberately not `primary`, which is the consumer's brand token and designed to be overridden, so a fill built on it can't promise contrast. Untinted the two land in the same place; they diverge the moment a consumer sets a brand hue.

  Both variants get each component's full treatment — on `ElevatedButton` that means the gloss, rim highlight and coloured drop-shadow ring, with `inverse` casting the fixed dark-neutral drop that `neutral` already used rather than a tint of its own fill (darkening a near-white dark-mode fill would put a pale grey haze under the chip instead of a shadow). `StatefulButton` carries both through to its elevated chip, so `variant="special"` with `elevated` now renders the violet chip in idle/loading instead of collapsing to `neutral`. `Button`'s ripple polarity also now treats every opaque fill as filled — `danger`, `special` and `inverse` previously got the dark shimmer meant for transparent and light-plate variants.

- e43dfc2: Add `CardChoiceGroup` to `rn-motion-ui/card-choice`. Wrapping `CardChoice` cards in a group renders a single shared indicator dot that glides between cards on selection (spring-animated, reduced-motion aware) instead of each card toggling its own dot. `CardChoice` gains a `value` prop for group use; standalone `selected` + `onPress` continue to work unchanged.
- 8cde891: Add `ElevatedButton` component (`rn-motion-ui/elevated-button`). Glossy filled chip with top-down white sheen, 1px SVG rim highlight, and a multi-layer coloured drop-shadow ring. Supports 7 variants: `neutral`, `danger`, `success`, `warning`, `info` (glossy fills) and `white`, `gray` (flat plates). Hover lifts the gloss; `white` darkens on hover; `gray` is a fixed Geist-style secondary plate. Shares press interaction and content layout with `Button` via `button-internals`.
- df37c21: Add `FileSystem` (`rn-motion-ui/file-system`), a Finder-style browser over a flat manifest of files. The path is the identity — folders carry a trailing slash, the empty string is the root, and missing folder prefixes are inferred from file paths, so an object-store listing can be handed in as-is; folders with no metadata of their own inherit their newest descendant's modified date. Four presentations share one state core: an icons grid, a list with sortable columns and expandable folder rows, Finder-style columns panes, and a gallery with a large stage, a metadata sidebar on wide viewports and a filmstrip. The toolbar carries back/forward history, search, a sort menu, and a filter menu with a MIME-bucketed file-type checklist plus date created/modified facets (relative presets or a custom range picked in a calendar modal); active filters show as pills whose operator can be switched in place. Files render externally generated thumbnails — the component rasterizes nothing itself — with a pager for multi-page previews that fetches pages on demand through `loadPreviewImageUrl`, falling back to a file-type icon tinted from a per-language colour token. URLs resolve through `getFileUrl` behind a component-lifetime cache (no repeat presign, no loading flash on revisit) and folders advertising `hasChildren` fill in through cursor-paged `loadChildren`. Opening a file (double-click on web, second tap on native) shows images in a built-in viewer modal, hands the other viewable kinds to `renderFileViewer`, or defers entirely to `onFileOpen`. The header adapts to the component's own measured width rather than the window's — shedding affordances at 560px and 360px, collapsing the four-tab view switcher into a dropdown below 768px — and its menus become bottom sheets under the md breakpoint via `AdaptiveDropdown`, which now also exports its `TriggerRenderProps` / `ContentRenderProps` render-prop types. Entries carry a context menu when `getContextMenuActions` is supplied — right-click on web, long-press on native, in all four views — resolved synchronously so the panel opens with no loading state, and reporting the pick through `onContextMenuAction`; actions take an icon, a `destructive` tint and a `disabled` state, the panel is a plain modal pinned to the cursor on wide viewports and a bottom sheet on narrow/native, and opening one closes whichever was already open. With `draggable`, entries can be dragged onto folders in the list and icons views — an RNGH pan on native, pointer capture on the scroll container on web (a mouse click-drags immediately while touch waits for a hold and can still scroll) — with the live target outlined, edge auto-scroll, the post-release click swallowed, and a drop into the dragged folder's own subtree refused; `onMove` reports `{ sources, destination }` and the component mutates nothing itself. Adds `ArrowLeft`, `ChevronLeft`, `Columns3` and `Funnel` to `rn-motion-ui/icons`.
- de5ab7f: Fix hover highlights and drag-source tinting in `FileSystem` under pointer capture.
- fdbd888: Add an `npx rn-motion-ui-tokens` CLI that generates a retinted copy of `tokens.css` for consumers. The neutral ramp's shared tint can't be a `var()` — uniwind folds colours to hex at bundle time and `var()` inside `oklch()` never folds on native — so retinting is a codegen step. The script reads the shipped sheet, rewrites only the neutral-tinted `oklch()` literals to a given `--hue`/`--chroma` (scaling each token's chroma proportionally so partial tints stay partial), and passes comments, shadow recipes, status colours, and all three theme blocks through verbatim. Documented in the README's Theming section.
- d8bf622: Rebuild `GlossyButton` on an explicit primitive table. The key is now specified as seven fixed lighting slots — top and bottom edge hairlines, a rim, top and bottom spotlights, and a near and far cast — plus a dome gradient and a hover/active tint, all resolved per face rather than computed inline. Three families feed those slots: the translucent `neutral` key and the new `inverse` key are hand-authored per scheme, and every other face (status tokens, the pinned `gray` plate, and any `color` you pass) derives its rim and cast from the face's own OKLCH — a rim 0.17 lightness below the face at 0.65× its chroma, a cast pinned to lightness 0.25 at 0.4× chroma. The lighting branch follows the _face_, not the page, so a near-black key on a light page picks up the dark-face treatment (pale edges, no spotlights) instead of black-on-black bevels, and a light key on a dark page keeps its sheen. Layer order now matches the CSS original: spotlights, then rim, then edges, then the dome, then the tint — previously the tint painted _below_ the bevel and dome, which swallowed it on dark faces. Presses fade the spotlights, edges and cast to zero while the rim holds, so the key sinks rather than flattening; the tint animates opacity only and snaps its colour between the hover and active values. Ripple polarity now follows face lightness, fixing a dark shimmer on vivid light-page faces.

  Adds two variants: `inverse` fills with `foreground` and punches the label through to the page colour, distinct from `primary` which is meant to be overridden downstream; `special` fills with the new `special` token. Removes the `white` and `dark` variants — both were plates pinned against one scheme, which `inverse` covers when you want the opposite of the page and `color="#fff"` / `color="#191919"` covers when you want a literal plate. `gray` stays as the one fixed plate. Adds `--color-special` / `--color-special-foreground` (`oklch(59% 0.25 295)`, violet) as the one non-semantic status member, for promotions and upgrade paths where the other four each carry a meaning. Retints `--color-info` to `oklch(52% 0.24 264)` and `--color-warning` to `oklch(58% 0.18 40)`, and corrects dark-scheme `--color-danger` to `oklch(66% 0.22 25)` so it matches the native table. Those token changes also reach `ElevatedButton`, `AnimatedBadge`, and `SwipeableList`. A new `check-token-parity` CI guard now holds the `@media (prefers-color-scheme: dark)` block, the `.dark` block, and the native `LIGHT_OKLCH`/`DARK_OKLCH` tables to the same values.

- 954cadc: Remove ascii, comet, scramble, newton, helix, and percent loader variants; keep spinner, dots, bars, dot-matrix, and dither.
- ad5afb0: OTPInput: tap any slot to move the edit caret there (not just the first empty cell). Editing logic extracted to `otp-input.logic.ts` (pure, RN-free, unit-tested) and switched to fixed-grid overwrite semantics via `applyEdit` — a typed digit replaces the active slot in-place instead of shifting the tail. Fixes a RNW caret-drift bug where a tap on slot N could land the keystroke in slot N+1. `onComplete` now fires on every edit that yields a full-length code (not only the first incomplete→complete transition), so retyping a slot of an already-complete code re-validates.
- 42040d5: StatefulButton: add an `elevated` prop that swaps the flat button for the glossy `ElevatedButton` chip. The chip keeps its gloss/fill/rim/coloured drop-shadow through the whole state machine instead of greying out, and each state adopts the matching elevated variant — idle/loading map the flat variant onto the palette (danger family → `danger`, everything else → the monochrome `neutral` fill), success switches to the glossy `success` chip and error to the glossy `danger` chip (full fill, not a flat overlay).

  ElevatedButton: add a `noDisabledOpacity` prop that keeps a non-interactive chip's gloss/fill/shadow instead of flattening to the muted plate, and export `elevatedContentColor(variant, disabled, colors)` so a consumer rendering its own content can match the chip's label/icon colour exactly.

- ce4021b: Comprehensive `testID` coverage across all components.

  **New root `testID` props** on components that previously had none: `ActionFeedbackModal`, `AdaptiveDropdown`, `AdaptiveModal`, `BottomSheet`, `FileSystem`, `FullSheet`, `HoverMenu`, `MultiStepMenu`.

  **Sub-element and per-item `testID` support:**

  - `TabsTrigger` — accepts `testID` and forwards it to the trigger `Pressable`.
  - `BloomMenuItem` — new optional `testID` field; forwarded to each grid cell `Pressable`.
  - `OverflowActionItem` — new optional `testID` field; forwarded to each action `Pressable`. The toggle button auto-derives `${testID}-toggle` from the container's `testID`.
  - `HoverMenu` — panel `Pressable` auto-derives `${testID}-panel`.
  - `AdaptiveDropdown` — floating panel `Pressable` auto-derives `${testID}-panel`.
  - `BottomSheet` — overlay backdrop `Pressable` auto-derives `${testID}-backdrop`.
  - `ActionFeedbackModal` — dismiss button auto-derives `${testID}-dismiss`.
  - `FileSystem` — header, body, and status bar auto-derive `${testID}-header`, `${testID}-body`, and `${testID}-status`.

  Components that already forwarded `testID` via `...props` spread (`Text`, `Skeleton`, `AnimatedList`, `Card`) are unchanged.

- 89d801d: Add `variant` to `WheelPicker` (`'card'` | `'plain'`, default `'card'`).

  `card` is the existing self-contained control: elevated `Card` surface with an inset rounded centre pill. `plain` drops the container entirely — transparent, no surface, no shadow, no radius of its own — so several wheels can be butted together inside one parent frame and read as a single control (a date picker, say). Previously this needed per-wheel style overrides (`borderWidth: 0`, `backgroundColor: 'transparent'`) that fought the `Card` instead of replacing it, and left every wheel painting its own shadow underneath the shared frame.

  The rounded centre pill survives in both variants, since it is what marks the selected row; `plain` just uses a tighter horizontal inset so a narrow column (a 56px day wheel) still gets a readable band and adjacent wheels keep distinct pills rather than fusing into one bar. `elevation` is ignored under `plain`.

### Patch Changes

- 65cc7fd: ActionFeedbackModal: skip the loading/success text block entirely when no text props are set. Each state block is a flex child of a `gap-4` column, so an empty one still added a stray 16px gap under the morph icon — the minimal variant (icon only) now sits flush.
- 1e3c1c6: Extract shared Button family machinery (`usePressRipples`, `buildButtonContent`, `ButtonRipples`, `BaseButtonProps`) into `button-internals.tsx`. `Button` now delegates to those helpers, removing ~120 lines of duplication. `StatefulButton` cascade animation simplified to a whole-label roll (per-character stagger removed).
- 3dbc485: Docs: update the README colour-token table and `useThemeColors` example to use `danger` instead of the old `destructive` token name (the token was renamed in a prior release). Also refine the `useMotify` presence-unmount effect's dependency list and lint suppressions (no behavioural change).
- 064ecb6: Fix `DynamicIsland` pill background: use `bg-black` instead of `bg-foreground` so the pill stays black in both light and dark themes.
- d68328b: Storybook: rebuild the component stories around a single interactive playground per component, and expand `play`-function coverage.

  Each component now exposes one `Interactive` story that doubles as its catalogue — live controls on top, then rows of samples for the states a press can't reach — replacing the long tails of one-argument stories (`Loading`, `Disabled`, `Pill`, …) that used to sit beside each other in the sidebar. The shared chrome lives in `src/__stories__/story-harness.tsx` (`Playground`, `Controls`, `Toggle`, `Choice`, `Action`, `Section`, `Variants`, `Sample`, `Note`), with `story-trigger.tsx` supplying a swappable open-trigger for the overlay stories and `story-elevations.ts` the shared 1–8 elevation chip table.

  The harness is deliberately built from bare `Pressable`/`View` rather than the library's own `Switch`/`Radio`, so a story for `Switch` never has the harness and the subject answer the same `findByRole('switch')` query; every control carries a `story-*` `testID` so `play` functions can drive it unambiguously.

  `src/**/__stories__/**` is added to the package's `files` exclusions, so the harness ships no more than the stories it serves do.

- 8b70edb: Fix `TextShimmer` rendering black in dark mode and shimmering imperceptibly. The animated characters bypassed the themed `Text` component, so they fell back to React Native's default black regardless of theme, and moti's declarative `loop` rebuilt its `withRepeat` inside the worklet on every re-render — any theme toggle or parent state change left the repeat with almost no distance to travel and flattened the effect. The sweep now owns a single Reanimated shared value created once, and interpolates each character between `color` (default `muted-foreground`) and `highlightColor` (default `foreground`) as a narrow band travels across the string, so it tracks the active theme and stays fully legible while animating. Both colours are overridable per instance.

## 3.1.0

### Minor Changes

- 5550b74: Simplify status token model to vivid filled pairs; rename `destructive` → `danger`; remove `Card` variant prop.

  **Breaking — status token model** (`rn-motion-ui/tokens.css`, `use-theme-color`):

  - The soft-plate triad system (`*-border` partners) is replaced by vivid filled pairs: `danger` / `success` / `warning` / `info` are now saturated filled backgrounds; `*-foreground` is white in both themes for consistent legibility on the fill. The `*-border` tokens (`danger-border`, `success-border`, `warning-border`, `info-border`) are removed entirely.
  - `--color-destructive` / `--color-destructive-foreground` are removed. The unified `danger` pair covers both the former soft plate and the vivid action use-case. Any code referencing `destructive` (CSS variable, Tailwind class `bg-destructive` / `text-destructive`, or `ThemeToken`) must migrate to `danger`.
  - `ThemeToken` (exported from `use-theme-color`) drops `destructive`, `destructive-foreground`, `success-border`, `warning-border`, `info-border`, `danger-border`.

  **Breaking — `Button` variant**:

  - The `'destructive'` variant is renamed `'danger'`. Update any `<Button variant="destructive" />` to `variant="danger"`.

  **Breaking — `Card` `variant` prop removed**:

  - `Card` no longer accepts a `variant` prop (`'border' | 'elevated' | 'filled'`). All cards now render as elevation-based surfaces: background and shadow derive from the `elevation` prop (default `3`). Replace `variant="filled"` with a `className` override, and drop `variant="border"` / `variant="elevated"` (behaviour is equivalent to the former `elevated` with `elevation={3}`).

  **Breaking — `AnimatedBadge` style**:

  - Badge containers are now borderless vivid fills (matching the new status token model). The animated border was removed; the `X` error icon is replaced with `AlertCircle`. Visual appearance changes in all status variants.

  **New — `StarRating` customisation props**:

  - `activeStarColor?: string` — color of filled stars and the sparkle burst. Defaults to a fixed gold (`#edde51`) that reads as a star across every theme.
  - `inactiveStarColor?: string` — color of empty stars. Defaults to the theme `border` token.
  - `round?: boolean` — round stroke caps and joins (default `true`). Set `false` for sharp star points.

  **New — `AdaptiveDropdown` trigger function receives `toggle`**:

  - The render-prop form of `trigger` now receives `{ open, toggle }` instead of `{ open }` only. Use `toggle` when the trigger is itself pressable (e.g. a `Button`) so the inner pressable can wire `onPress` to `toggle` directly, bypassing the outer wrapper's own toggle.

## 3.0.0

### Major Changes

- c2fd8d1: Adopt the cubby-ui surfaces system as the token foundation.

  **Breaking — token model reworked** (`rn-motion-ui/tokens.css`):

  - **Surface elevation ladder**: `--color-surface-1` … `--color-surface-8` with paired `--shadow-surface-1` … `--shadow-surface-8` recipes (crisp 1px ring + progressive drop layers). Surfaces address the ladder directly — `surface-1` is the page, `surface-3` the resting level for contained content (cards, popovers, dialogs, inputs). The shadcn-style container/page aliases (`--color-surface`, `--color-card`, `--color-popover`, `--color-input`) are gone; use `bg-surface-1` / `bg-surface-3` instead. Light mode keeps surfaces neutral and lets shadows carry elevation; dark mode steps lightness per level with a subtle neutral tint (hue 270, chroma 0.004) across the whole neutral stack.
  - **State overlays**: new translucent `--color-surface-hover` / `--color-surface-selected` utilities that composite on any surface level.
  - **Status triads**: `success` / `warning` / `info` / `danger` are now soft plate backgrounds with `*-foreground` (legible text/icon on the plate) and `*-border` partners. The previous vivid `--color-success` / `--color-warning` values are gone — text/icons that used them should use `*-foreground`. `--color-destructive` stays the vivid action color and gains `--color-destructive-foreground`; new `--color-accent` / `--color-accent-foreground`.
  - The undefined `shadow-modal` class (silently no-op) is replaced with real `shadow-surface-N` recipes across overlays; `ThemeToken` (use-theme-color) covers the full new token set.

  **New — `rn-motion-ui/color`**: pure-formula OKLCH → sRGB conversion (`oklchToSrgb`, `cssColorToSrgb`) using the reference OKLab matrices with CSS Color 4 chroma-reduction gamut mapping. `useThemeColor()` now resolves web CSS variables through this deterministic formula instead of rasterising a 1×1 canvas pixel, and the native static maps are derived from the same oklch definitions at module load (no more hand-maintained hex duplicates).

  **New — `elevation` prop + `rn-motion-ui/elevated`**: surface components (`Card`, `Popover`, `AdaptiveDropdown`, `HoverMenu`, `MorphingModal`, `ActionFeedbackModal`, `AdaptiveModal`, `FeedbackWidget`) accept an `elevation` prop (`SurfaceLevel`, `1`–`8`) that drives where the surface sits on the ladder: its background (`bg-surface-N`), its drop shadow, and — in dark mode — its inset rim (top highlight + full-perimeter ring) all track the same level, so the fill and the rim highlight stay calibrated together. Because light-mode surfaces `3`–`8` are all white, coupling the background to elevation is a no-op in light mode; in dark mode a higher `elevation` reads as a lighter, more-floated surface. Backing this is a new `--shadow-elevated-1` … `--shadow-elevated-8` token pair (rim + drop folded into one box-shadow, since React Native has no `::after` to paint cubby's pseudo-element rim) and the `rn-motion-ui/elevated` helper (`elevated`, `elevatedShadow`, `surfaceBackground`, `clampSurfaceLevel`, `SURFACE_LEVELS`, `SurfaceLevel`) mirroring cubby's `surfaceClasses` two-arg (background level / float level) split. The dark stack also gains `--surface-hi-*` highlight and `--surface-ring-*` ring tokens driving the rim recipe.

  Components migrated throughout: modals/sheets/popovers sit at `bg-surface-3` with ladder shadows, tables/lists use `bg-surface-selected` for selected rows, badges/stateful buttons/swipe actions use the status triads, and StarRating's `text-neutral-*` Tailwind-palette stragglers now use `text-muted-foreground`.

## 2.3.0

### Minor Changes

- 865d908: Add motion token constants (`theme/motion.ts`).

  - Duration constants: `DURATION_INSTANT / FAST / BASE / SLOW / SLOWER`
  - Shorthand timing transitions: `TIMING_INSTANT / FAST / BASE / SLOW`
  - Semantic spring presets: `MOTION_SNAPPY`, `MOTION_STANDARD`, `MOTION_GENTLE`, `MOTION_BOUNCY`
  - `mergeTransition` helper for partial consumer overrides
  - Re-exports `MotiTransitionProp` as the canonical transition type

- 425529d: Add `open` / `onOpenChange` props to overlay components.

  `BottomSheet`, `AdaptiveModal`, `FullSheet`, and `MorphingModal` now accept the new controlled props:

  - `open` (replaces `visible`)
  - `onOpenChange(open: boolean)` (replaces `onClose`)

  The previous `visible` / `onClose` props are kept as deprecated aliases and will be removed in a future major release.

- 425529d: Extract shared overlay boilerplate into `OverlayShell` and `useSheetPresence`.

  - New `OverlayShell` component — wraps `Modal` with `useModalRender` mount lifecycle and a11y props; accepts a render-prop child receiving `{ open, onExitComplete }` to drive `AnimatePresence`
  - New `useSheetPresence` hook — manages mount state and `translateY` shared value for slide-from-bottom sheets (extracted from `BottomSheet`)
  - `ActionFeedbackModal`, `FullSheet`, and `MorphingModal` now use `OverlayShell` internally

- 865d908: Add semantic color token system (`tokens.css`, `use-theme-color.ts`).

  - New `tokens.css` — Tailwind `@theme` block with `--color-*` CSS custom properties for light and dark modes (surface, foreground, primary, destructive, success, warning, etc.)
  - New `use-theme-color` hook — reads tokens from CSS custom properties on web (respects consumer `@theme` overrides) and from a static light/dark map on native
  - New `useThemeColors` convenience hook returning the full token map at once

- 425529d: Replace hardcoded hex colors with semantic theme token hooks.

  All components that previously used inline hex constants now read colors through `useThemeColor` / `useThemeColors`, enabling consumer `@theme` overrides to propagate into component internals on both web and native. Affected components: `ActionFeedbackModal`, `AnimatedBadge`, `BloomMenu`, `BouncyAccordion`, `Button`, `Checkbox`, `FeedbackWidget`, `FullSheet`, `Input`, `Loader`, `MorphingModal`, `OtpInput`, `OverflowActions`, `Radio`, `ScrollProgress`, `StarRating`, `SwipeableList`, `Switch`, `Tabs`.

- 425529d: Add `pressTransition` and `labelClassName` props to `Button`.

  - `pressTransition` — partial override for the press-scale spring; defaults to `MOTION_SNAPPY`
  - `labelClassName` — additional NativeWind class names merged onto the label `Text`

- 425529d: Add `checkIcon` and `checkTransition` props to `Checkbox`.

  - `checkIcon` — replace the default SVG check/indeterminate mark with a custom node
  - `checkTransition` — partial override for the check-mark animation; defaults to `TIMING_FAST` (150 ms)

- 425529d: Add `closeIcon` and `errorIcon` slots to `FeedbackWidget`.

  - `closeIcon` — replace the default × icon in the panel header
  - `errorIcon` — replace the default `AlertCircle` icon shown in the error state

- b72f34a: Move `react-native-svg` to `peerDependencies`.

  As a native module it must be installed and autolinked by the consumer app; shipping it as a regular dependency risks duplicate autolink or version conflicts at the native layer — the classic RN library footgun.

  Consumers who relied on the transitive install will now need to add `react-native-svg` to their own `dependencies`.

- 425529d: Add `renderStar` custom render prop to `StarRating`.

  - `renderStar({ size, color, filled })` — replace the built-in `StarSvg` with any node; receives the resolved amber/muted color so consumers don't have to re-implement the color logic

- 425529d: Add `thumbTransition` prop to `Switch`.

  - `thumbTransition` — partial override for the thumb slide spring; defaults to `THUMB_SPRING` (stiffness 800, damping 80, mass 4)

- 425529d: Add `sortIcon` prop to `Table`.

  - New `sortIcon` prop on `HeaderCell` — replaces the default `ChevronUp` sort indicator with a custom node

- 5e6a72c: Restyle `Table` with NativeWind `className` and expose per-slot customization props.

  - Table internals now use Tailwind/uniwind `className` (merged via `cn`) instead of `StyleSheet` + the `useTableColors` hook. Colors resolve through the existing theme tokens (`bg-muted`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-primary`, …) and are overridable with classes. Numeric values that can't be classes (column widths, row/container height, drop-indicator offset) stay inline.
  - New flat customization props on `Table`: `headerClassName`, `rowClassName`, `cellClassName`, `cardClassName`, `footerClassName` (the existing `className` covers the outer container). Each merges last-wins over the defaults — e.g. `rowClassName="bg-card"` overrides the row background. `style` / `cardStyle` / `stripedStyle` are retained for dynamic inline overrides.
  - Removed the `./table-styles` package export and deleted `table-styles.ts` and `table-theme.ts`. This drops a previously-published import path (`rn-motion-ui/table-styles`); migrate to the `className` / `*ClassName` props. Bumped as minor per maintainer decision.

- 425529d: Upgrade `cn` to a last-wins conflict resolver.

  Previously `cn` was additive-only (joined truthy strings). It now performs conflict resolution for all utility groups emitted by this library (layout, sizing, spacing, typography, color, border, etc.) — consumer `className` passed as the last argument always wins over component defaults, matching the behavior of `tailwind-merge` for the groups this library uses with zero added runtime dependencies.

### Patch Changes

- b72f34a: Add `./package.json` to the exports map.

  With a sealed `exports` map, tooling that resolves `rn-motion-ui/package.json` directly (Metro, Expo Doctor, some bundlers) would fail with a package-not-found error. The entry is a bare self-reference: `"./package.json": "./package.json"`.

  `check-exports.mjs` is updated to skip this key in both validation passes so it never reports it as a dangling or missing entry.

- 3afe9e5: Resolve the remaining Biome `info`-level diagnostics from `bun lint` (no runtime change).

  - **`useSortedClasses` (36)** across the Table components: let Biome sort the NativeWind `className` tokens into canonical order. Each reorder was verified safe against this repo's `cn` resolver — no string contained two tokens in the same conflict group, so the surviving class set is identical before and after (last-wins resolution is unchanged).
  - **`noAwaitInLoops` (2)** in `ActionFeedbackModal`'s `LoadingLoops` story `play`: suppressed with `biome-ignore` because both loops are intentionally sequential and time-dependent (polling for an animated dot to mount; sampling `translateY` 250 ms apart across theme re-renders). The rule's `Promise.all` suggestion would run the iterations concurrently and defeat the test's purpose.

- 5e6a72c: Fix `cn` conflict-resolution group collisions for `flex-*` and `border-*` utilities.

  - `flex-row`/`flex-col`/… (flex-direction) and `flex-1`/`flex-auto`/… (the flex shorthand) are different properties, so they now get separate groups. Previously they shared one `flex-direction` group, so `flex-row flex-1` collapsed and the direction utility was dropped.
  - Border-width patterns (`border-b`, `border-t`, `border-2`, …) are now matched before the border-color catch-all. The color regex matched the side letter in `border-b`, so `border-b border-border` previously collapsed both into the color group and the one-sided border _width_ was silently dropped.

- 0f03609: Satisfy the `check-no-hardcoded-colors` lint across `src/components` (no runtime change — comments only).

  - **Loader `Percent`**: the track-tint rationale comment mentioned `rgb(...)` / `rgb(…)26` in prose, which tripped the script's color-literal regex on lines that contain no actual color literal (the tint uses the `color` variable). Reworded to avoid the `rgb(` token rather than mislabel the line `theme-exempt`.
  - **SwipeableList `ICON_COLOR`**: the exported static map's `neutral`/`primary` entries (`#737373` / `#fafafa`, light-mode fallbacks for external consumers) are now annotated `/* theme-exempt */`. They can't call `useThemeColors()` (module-level constant) and are already resolved reactively in-component via `SwipeActionButton`, matching the existing `#ffffff` chromatic entries below.

- 7fa25e3: Fix manual light-mode override so it wins over an OS `prefers-color-scheme: dark` preference.

  The `@media (prefers-color-scheme: dark)` block in `tokens.css` previously targeted `:root` unconditionally, so selecting light (no `.dark` class) while the OS was dark still resolved to the dark tokens. The block is now gated on `:root:not(.light)`: a `.light` class (on `<html>` or any ancestor) opts out of the automatic OS-preference dark values and falls back to the `@theme` light defaults. `.dark` continues to force dark over an OS-light preference. Backward compatible — no existing selector loses behavior; `.light` is simply now a documented absolute override.

- 7fa25e3: Fix loaders (and other `useThemeColor` consumers) rendering transparent and not adapting to dark mode on web.

  Two bugs combined to keep loaders black in dark mode:

  1. **`useThemeColor`/`useThemeColors` went stale on a manual theme toggle.** On web the hooks read the active token via `getComputedStyle` during render, but only `useColorScheme()` drove re-renders — and that tracks the OS `prefers-color-scheme` media query, not a `.dark`/`.light` class swap on `<html>` (how the Storybook toolbar and most app toggles switch themes). So a class-toggle froze the resolved color at the last commit and it never refreshed. The hooks now also subscribe to the media query and to `class` mutations on `<html>`, re-rendering and re-reading the live CSS var on either signal.

  2. **oklch tokens were silently dropped.** `getComputedStyle` returns `@theme` token values verbatim as `oklch(...)`, but React Native's color parser (used by react-native-web for every color style and by react-native-svg) only knows hex/rgb/rgba/hsl/hsla/hwb/named colors and drops anything else — so `backgroundColor: useThemeColor('foreground')` rendered as no color at all (transparent), not black. oklch (and `oklab`/`color()`) values are now rasterised to an sRGB `rgb()`/`rgba()` string via a 1×1 canvas pixel, which RN and Reanimated both parse. Native (which already uses the sRGB static maps) and SSR are unchanged.

  The Loader stories no longer hardcode `color: '#111111'`, so each variant resolves from `useThemeColor('foreground')` and follows the theme toolbar (black in light, near-white in dark). The `Percent` track switched from a `${color}26` hex-alpha hack to a 15%-opacity sibling layer, since `color` is now `rgb(...)` and `rgb(…)26` is not a valid color.

- 7fa25e3: Fix the `dots` loader freezing after one cycle in `ActionFeedbackModal` (and anywhere it re-renders mid-loading).

  The dots bounce used moti's declarative `loop`, which rebuilds its `withRepeat(withTiming(target))` on every worklet re-run. The Dot re-renders whenever an ancestor `<AnimatePresence>` churns its presence context (a theme toggle, parent state change, etc.) — and `useContext` re-renders bypass `React.memo`. A rebuild that lands while the dot already sits at its `translateY` target leaves the repeat with zero forward distance, so the dot sticks at the top of the bounce permanently ("one cycle then stops"). Reproduced on both native and web.

  `Dot` now drives the bounce with a raw Reanimated shared value whose `withRepeat` is created **once** in a `useEffect` (deps: `reduce`/`size`/`speed`/`index`). Re-renders never cancel or rebuild the animation — the stored animation runs indefinitely regardless of ancestor re-renders. The opacity fade-in is a one-shot `withTiming`; under reduced-motion the dot stays put and opacity gently pulses instead of bouncing.

- 5e6a72c: Fix `StarRating` rolling value label shoving the `/max` label sideways on change.

  The animated value digit was rendered inline next to `/max`, so the entering and exiting digits sat side-by-side and shifted the `/max` label on every change. The slot now reserves the digit's width with a hidden sizer and absolutely positions the animated label so the two digits overlap during the transition instead of pushing neighbors. Mirrors the `TextRolling` layout.

- 7fa25e3: Fix `StatefulButton` and `ActionFeedbackModal` success/error glyphs vanishing in dark mode.

  Both used the `surface` token for the success/error label (`StatefulButton`) and the morph `Check`/`X` glyphs (`ActionFeedbackModal`). `surface` is near-white in light mode but near-black (`#111111`) in dark mode, so against the saturated green/red success/error backdrop the text and icons were illegible in dark mode. Switched to theme-exempt white (`#ffffff`) so the glyphs read against the fill in both themes, matching the existing convention in `SwipeableList`.

- 7fa25e3: Fix web theme colours being silently dropped because they resolved to oklch.

  `useThemeColor`/`useThemeColors` read `@theme` tokens via `getComputedStyle`, which returns the authored `oklch(...)` strings. Reanimated's colour interpolator and react-native-web's inline-style colour parser only understand sRGB (hex/rgb/rgba/hsl), so animated and inline theme colours were dropped — leaving e.g. the ActionFeedbackModal morph vessel transparent (white glyph invisible against the card) and Loader dots colourless on web. The hooks now resolve oklch (and other non-sRGB CSS colours) to sRGB on web via a 1×1 canvas pixel readback, matching native's static sRGB maps. Native is unaffected.

- b72f34a: Close reduced-motion gaps in animated components.

  Six component directories never called `useReducedMotion` despite driving visible animations. All are now fixed:

  - **`use-sheet-presence`** — new `reducedMotion` option; swaps `withSpring` → `withTiming(160 ms)` for both open and close.
  - **`BottomSheet`** — reads `useReducedMotion()` and passes it to `useSheetPresence`.
  - **`FullSheet`** — replaced the inline `AccessibilityInfo` + `useState` + `useEffect` re-implementation with the shared `useReducedMotion` hook.
  - **`ActionFeedbackModal`** — `reduced` propagates into `MorphIcon` (all four morph transitions) and into the backdrop/card enter/exit transitions.
  - **`AdaptiveDropdown`** — `reduced` drives the panel enter spring (→ timing) and exit duration/easing.
  - **`AnimatedList`** — all `withTiming` calls in `AnimatedListItem` switch to 80 ms linear on reduced-motion; `reduced` added to both dependency arrays.
  - **`MultiStepMenu`** — slide and arrow transitions computed from `useReducedMotion()` rather than file-level constants.

  `Card` and `CardChoice` are static (no animation imports) and were excluded. `TextCascade` inherits coverage via `ActionSwap`.

- 5e6a72c: Fix `SwipeableList` action-icon contrast in dark mode for `neutral`/`primary` tones.

  `neutral` and `primary` action badges use theme-inverting backgrounds (`bg-muted`/`bg-primary`), but their icon colours were hardcoded hex (`#fafafa`/`#71717a`), so icons went invisible or low-contrast when the theme flipped. The render path now resolves these icon colours reactively via `useThemeColors()` (`muted-foreground`/`primary-foreground`), overriding any colour baked into the passed icon node so the stroke stays legible against the badge. Chromatic tones (`success`/`warning`/`danger`) keep white icons — their vivid backgrounds are stable across themes. The exported `SWIPE_TONE_ICON_COLOR` static map is now documented as a light-mode fallback for icons rendered outside the component.

## 2.2.0

### Minor Changes

- 4f9f467: **Breaking**: unexport `InputType`.

  - `InputType` is no longer re-exported from `input`; it is an internal type.

- 4f9f467: Table overhaul: pagination, load-more, infinite scroll, striped rows, sortable master switch, `getSortValue`, rich empty state. New `hasKey<K>` worklet typeguard.

  **Table:**

  - New `mode` prop (`'loadMore' | 'pagination' | 'infiniteScroll'`) controls the footer pattern.
  - Pagination: `page`, `pageSize`, `total`, `onPageChange`, `paginationLabel` props; `PaginationFooter` rendered outside `FlatList` so it stays pinned.
  - `loadingMore` prop shows a spinner + skeleton footer while a follow-up page is fetching.
  - `striped` / `stripedStyle` props for alternating-row shading.
  - `sortable` master switch — set to `false` to disable sort on all columns regardless of per-column flags.
  - `TableColumn.getSortValue` — custom value extractor used during client-side sort; avoids sorting on rendered React nodes.
  - `TableColumn.skeletonWidth` — configure the skeleton bar width per column.
  - Rich empty state: `emptyIcon`, `emptyTitle`, `emptyDescription` props (used when `emptyState` is not provided).
  - `onLoadMore` / `loadMoreLabel` for `loadMore` mode.
  - `onEndReached` now only fires in `infiniteScroll` mode — prevents accidental triggers in other modes.
  - `TableMode` type is now exported from the `table` entry point.
  - `table-parts` entry: `TableCard`, `SkeletonFooter`, `PaginationFooter`, `LoadMoreFooter` extracted into their own file.

  **Utils:**

  - `hasKey<K>(obj, key)` typeguard added to `utils/typeguards` — annotated `'worklet'` for Reanimated UI thread use.

### Patch Changes

- 4f9f467: Internal housekeeping — no API changes.

  - `Switch`: move `TRAVEL` / `SWITCH_SHAKE_STEPS` constants before the `SwitchProps` type declaration (forward-reference cleanup).
  - `ActionSwap`: remove unused `cn` import.

## 2.1.0

### Minor Changes

- cb83916: Add `className`/`style` support to all components; extend Button variants; port Input improvements from offkeep

  **Button / StatefulButton**

  - New variants: `destructive`, `outlineDanger`, `ghostDanger`, `ghostPrimary`
  - New props: `className`, `leftAdornment`, `rightAdornment`, `fitWidth`
  - `className` is merged onto the outer `MotiView` wrapper using `cn()`

  **Input**

  - Shape prop: `rounded` (default) | `pill` — replaces the old always-pill layout
  - Size prop: `sm` | `md` (default) | `lg`
  - `inputType` prop: semantic type (`text`, `email`, `password`, `otp`, …) — auto-configures `keyboardType`, `autoComplete`, `textContentType`, `secureTextEntry`, `autoCapitalize`
  - New props: `className`, `inputClassName`, `hint`, `invalid`, `multiline`, `autoFocus`, `ref`
  - iOS: `clearButtonMode="while-editing"` on single-line fields
  - Accessibility: `allowFontScaling`, `maxFontSizeMultiplier={1.45}`

  **All other components**

  - Every component now accepts `className?: string` (NativeWind classes merged onto the outer container) and `style?: StyleProp<ViewStyle>` where previously missing.

  **Shared utility**

  - New `cn()` helper at `src/lib/cn.ts` — joins truthy class strings (additive, no conflict resolution)

## 2.0.0

### Major Changes

- ecaccd5: feat(stateful-button)!: built-in async state machine driven by `onPress`

  **StatefulButton** (breaking)

  - `onPress` is now `() => Promise<void>` and drives a built-in machine: pressing runs idle → loading → success (or error, if the promise rejects) without the consumer managing `state`.
  - New timing props: `minLoadingMs` (default 300) keeps the loader visible long enough to not flash; `successDurationMs` (default 850) and `errorDurationMs` (default 600) set how long the terminal state is shown.
  - New callbacks: `afterSuccess()` and `afterError(error)` fire once the respective display window ends — use them for navigation, closing a sheet, toasts, etc.
  - New `autoReset` prop (default `false`): by default the button holds its terminal state **disabled** after the window ends (safe for page transitions that unmount it — no double-fires); set `autoReset` to return to idle and re-enable instead.
  - Controlled mode is unchanged: passing an explicit `state` bypasses the machine entirely (timings, `afterSuccess`/`afterError` and `autoReset` are ignored), and `onPress` fires as a plain handler.
  - Migration: consumers that previously drove `state` with their own timers can delete that plumbing and return a promise from `onPress`; consumers that keep `state` only need to make `onPress` async.

### Minor Changes

- ab36acd: feat(button): add `shape`, `noDisabledOpacity`, `backdropColor`, and `contentStyle` props

  - `shape` controls the border radius: `'rounded'` (default, `rounded-xl`) or `'pill'` (`rounded-full`). Previously all sizes hard-coded `rounded-full`.
  - `noDisabledOpacity` skips the 0.5 opacity when `disabled`, for cases where a button is disabled for interaction reasons but should remain visually prominent (e.g. success/error hold in StatefulButton).
  - `backdropColor` animates an absolutely-positioned colour overlay in/out by opacity without touching the variant background — used by StatefulButton for its success/error state fill.
  - `contentStyle` applies extra inline style to the Pressable container for layout overrides that cva class strings control.

- b57ff3c: fix(checkbox): animate fill with MotiView; remove(file-upload): delete FileUpload component

  **Checkbox**

  - Checkbox fill is now animated via `MotiView`, replacing the previous static fill implementation.

  **FileUpload** (removed)

  - `FileUpload` component and its Storybook story have been deleted.
  - Removed from the component list in `README.md` and `packages/ui/README.md`.

- df6ce72: **WheelPicker**: add `variant` prop (`'border' | 'filled'`, default `'filled'`) — the outer container is now a `Card`, so the picker inherits all card variants. Also fixes cylinder rendering: radius now uses the `tan` formula (rows tangent to the drum circle) instead of `sin`, and row transforms switch from `rotateX + perspective + scale` to `translateY + scaleY` — uniform perspective per element was wrong, `scaleY` alone converges all rows to the correct horizon line. Selection pill hairline borders removed; decorative centre drum marked `aria-hidden`.

  **Card**: `ref` is now part of `CardProps` (`ref?: Ref<View>`). React 19 passes `ref` as a plain prop through `...props`, so forwarding works without `forwardRef`.

- c966432: feat(wheel-picker): add `sound` prop; steepen row opacity falloff

  - New `sound` prop (default `false`): plays a short sine-wave tick on web (Web Audio API, lazily created to satisfy browser autoplay policy) or a brief `Vibration` pulse on Android on each row crossing while dragging.
  - Opacity curve changed from `cos θ` to `cos² θ` for a steeper falloff — edge rows now read more clearly as sitting behind the drum wall.

### Patch Changes

- 0a456d5: fix: update Card, OtpInput, and WheelPicker selection pill to rounded-2xl

  Aligns rounding with the Button default `rounded` shape (`rounded-xl`) across the component suite. Affected: `Card`, `OtpInput` slot, `WheelPicker` selection pill.

- c6b4e91: fix(table): use `alignItems` for SkeletonCellPulse cell alignment

  `justifyContent` acts on the main axis — in the column-direction cell `View`, that's vertical. `alignItems` is the correct prop for horizontal (cross-axis) alignment of the skeleton pulse within its column slot.

- 2374962: fix(tabs): skip indicator mount animation when starting on a non-first tab

  The sliding indicator previously always animated from its MotiView initial position on first render, producing a slide-in flash when `defaultValue` or a controlled `value` pointed to a tab that wasn't the first. A `hasPositioned` ref now lets the indicator jump directly to its initial slot and only enables the spring after the first layout commit.

## 1.1.0

### Minor Changes

- 83b611b: feat(star-rating): new animated StarRating component; fix(range-slider): no spring on mount, hide thumb until layout; perf(table): skip sort allocation when already sorted

  **StarRating** (new component — `@rn-motion-ui/ui/star-rating`)

  - Animated star-rating input: tapping a star commits the rating with a squash-and-stretch pop and an amber sparkle burst; tapping the committed star clears it (`allowClear`, default `true`).
  - Works controlled (`value` prop) or uncontrolled (`defaultValue`).
  - Supports fractional read-only display (e.g. 4.3 stars) via `readOnly`.
  - Optional rolling value label (`showValue`) animates up/down as the value changes.
  - Three sizes: `sm`, `md` (default), `lg`.
  - Full accessibility: `radiogroup` / `radio` ARIA roles, `increment` / `decrement` actions.
  - Honours `prefers-reduced-motion` — all animations collapse to instant.
  - Storybook story included.

  **RangeSlider**

  - `smooth` shared value is now initialised to the current ratio so there is no spring animation on first render.
  - Thumb is hidden (`opacity: 0`) until `onLayout` fires, preventing a flash at `x=0` on mount.
  - Replaced `useDerivedValue` with `useSharedValue` + `useEffect` to keep the smooth value in sync with externally-controlled `ratio` changes.

  **Table utilities**

  - `sortRows` checks whether `rows` is already in sorted order before allocating a new array; returns the same reference when no sort is needed, avoiding a `FlatList` reconciliation pass on every render.
  - Extracted `compareValues` helper to eliminate duplicated null / number / string comparison logic.

- a41c556: Table: add small-screen card view; Checkbox: animate fill with MotiView

  **Table**

  - New `renderSmallScreen` prop: a render function `(row, selected) => ReactNode` that replaces the column layout with a custom card per row.
  - New `useSmallScreen` boolean prop: when `true` (and `renderSmallScreen` is provided), switches the table into card mode — the sticky header is hidden and each row is rendered via `renderSmallScreen` inside a `Pressable` card.
  - New `cardStyle` prop: optional style applied to each card container in card mode.
  - Card mode provides its own skeleton loading state (three placeholder lines per card) and skips `getItemLayout` so variable-height cards scroll correctly.
  - New `SmallScreen` story with a toggle to switch between table and card views.

  **Checkbox**

  - Replaced the `cva`-based box colour swap with a `MotiView` animated fill overlay. The primary fill now fades in and out at 160 ms (or instantly when `reduce` is on) instead of switching via class variants, matching the mark animation timing.
  - Removed the unused `cva` import.

## 1.0.0

### Major Changes

- 17c2ce8: Remove `PredictionMarket` component

  The `PredictionMarket` component and its `./prediction-market` subpath export have been removed from the package. Consumers importing from `rn-motion-ui/prediction-market` must remove those imports.

### Patch Changes

- 17c2ce8: Fix animation correctness and loading indicators

  - **AnimatePresence**: exiting items now stay at their original list position instead of being appended at the end (insertion-order tracking via `keyOrderRef`).
  - **AnimatedList**: exit animation gains a downward `translateY: 8` drop alongside the existing fade+scale.
  - **Loader**: dots bounce now uses `EASE_IN_OUT` easing for a smoother feel.
  - **Button**: `buttonContent` rendered before ripples so it sits above them in z-order; `pointerEvents="none"` moved from `style` to a MotiView prop on each ripple.
  - **StatefulButton**: replaces the SVG spinning ring with a three-dot `DotsLoader`; button width is held stable during loading by keeping the idle text as a hidden sizer.
  - **ActionFeedbackModal**: loading state now uses `<Loader variant="dots">`.

## 0.2.0

### Minor Changes

- 0e9215d: Add five new components — `AdaptiveModal`, `AnimatedList`, `Card`, `CardChoice`, and `Skeleton` (each with stories and package exports) — and refine existing ones:

  - `ActionFeedbackModal`: rewrite the status icon as a single morphing vessel that animates size + fill colour across loading/success/error states while the glyph cross-fades, replacing the three static icon variants.
  - `CommandPalette`: rework layout and interaction handling.
  - `MultiStepMenu`: refine component and stories.

## 0.1.0

### Minor Changes

- First public release of `rn-motion-ui` as a single package. Consolidates the former `@rn-motion-ui/{rn,moti,hooks,utils}` packages into one unscoped package with subpath exports (no barrel files): 40+ animated React Native / React Native Web UI components, the Moti/Reanimated 4 primitives, shared React hooks, and shared TypeScript utilities.
