---
'rn-motion-ui': patch
---

feat(FileSystem): headless header, footer and breadcrumbs

The built-in header, footer and breadcrumb trail no longer impose a surface
background or border — they now carry layout only, so consumers style them via
`headerClassName`, `footerClassName` and the new `breadcrumbsClassName`.

Adds a `renderBreadcrumbs` render prop (alongside `renderHeader`/`renderFooter`)
that receives the trail as `{ id, label }` crumbs plus `navigateTo` and
`currentPath`, so a consumer can render its own trail without duplicating the
path logic.
