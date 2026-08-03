---
"rn-motion-ui": minor
---

**FileSystem: filtering goes headless, and the browser gets breadcrumbs and a
real search view.** The component used to own its own toolbar: a sort select, a
filter menu, a Finder-style search field that collapsed to a button at narrow
widths, a row of filter pills beneath the header, and the date-range modal the
filter menu raised. All of it is gone. What stays is the pipeline behind it —
search, sort, file-type and date filtering, custom ranges — now reachable
through a `renderFilters` slot that hands you every action and no markup.

```tsx
<FileSystem
  items={items}
  renderFilters={(
    { searchValue, setSearchValue, fileTypeOptions, toggleFileType, count },
  ) => (
    <MyFilterBar
      count={count}
      onSearch={setSearchValue}
      onToggleType={toggleFileType}
      search={searchValue}
      types={fileTypeOptions}
    />
  )}
/>;
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
