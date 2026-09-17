# rn-motion-ui — Improvement Plan

**Scope:** full codebase (5 packages, 497 files, ~93k lines)
**Source of truth:** Repowise index (commit `b0654568`, behind HEAD by 30 files) + repo memory
**Last generated:** 2026-09-17

---

## 1. Current state

| Signal | Value | Reading |
|---|---|---|
| Average code health | **6.3 / 10** | `warning` band |
| Hotspot health | **4.99 / 10** | stable, below target |
| Maintainability | 9.27 / 10 | healthy |
| Performance | 9.98 / 10 | healthy (see §7 caveat) |
| Import cycles | **6** | structural debt |
| Bus factor | **1** (93.7% one owner) | single-point-of-failure |
| Churn trend | increasing | active but concentrated |

Health distribution by NLOC: **26.7% healthy · 58.6% warning · 14.7% alert** (42 alert files, ~10.9k lines).

The dominant defect signal is **`untested_hotspot`** — high-churn, high-complexity files with no paired test file — followed by **`change_entropy`** (scattered edits that predict further defects). The gap analysis puts **247 files below the target score of 8.0**; fixing **26 files** closes half the weighted gap.

### Highest-leverage files (share of total repo gap)

| File | Share | Why it ranks |
|---|---|---|
| `packages/ui/src/components/file-system/FileSystem/file-system.stories.tsx` | 6.9% | 2,375 NLOC story file, untested, 16 bug fixes |
| `packages/ui/CHANGELOG.md` | 6.5% | non-code noise; should be excluded from scoring |
| `packages/ui/src/components/file-system/FileSystem/store/file-system-context.tsx` | 3.5% | CCN 42, 849 NLOC, top-5% entropy |
| `packages/ui/src/components/display/Table/table.stories.tsx` | 2.9% | 996 NLOC untested story |
| `packages/ui/src/components/menus/HoverMenu/hover-menu.tsx` | 2.0% | CCN 34, 25 dependents, worst score (1.12) |

---

## 2. How the workstreams are ordered

Each phase is a self-contained, shippable batch. Ordering = **impact ÷ risk**, with "quick wins" first and structural changes last. Nothing here is a rewrite — every phase is a decomposition, extraction, or deletion of an existing file.

| Phase | Workstream | ROI |
|---|---|---|
| 0 | Hygiene: exclude non-code from health scoring | trivial, unblocks honest metrics |
| 1 | Test the untested hotspots | highest — targets the #1 signal |
| 2 | Decomplex the remaining CCN hotspots | high, low risk |
| 3 | Split the change-entropy / bug-magnet files | high, medium risk |
| 4 | Dead-code removal | high, low risk |
| 5 | Break the 6 import cycles | medium, medium risk |
| 6 | Harden against recurring defect patterns | medium, prevents regressions |
| 7 | Script-only performance findings | low, cosmetic |

---

## Phase 0 — Exclude non-code from health scoring (15 min)

`CHANGELOG.md`, `README.md`, and `.changeset/*.md` are ranked as "high-leverage files" purely because they are large and churn with releases. They pollute the dashboard.

**Actions**
1. Add `packages/ui/CHANGELOG.md` and the two READMEs to the Repowise non-code/ignore list (`repowise update` after; or the equivalent exclude filter for `get_health`).
2. Re-run `get_health()` and re-derive the top-247 list before starting Phase 1, so effort isn't wasted on files that were only noisy.

**Done when:** `CHANGELOG.md` no longer appears in `high_leverage_files`.

---

## Phase 1 — Test the untested hotspots (highest ROI)

The `untested_hotspot` biomarker means "no paired `__tests__` file and no coverage data." **Not every flagged file is actually untested** — this repo's strategy is storybook-vitest play functions + pure-`.ts` logic tests (see memory: `vitest-cannot-import-tsx`, `verify-visuals-by-measuring-dom`). Treat the flag as "no *behavioral* guard", then cover each file with the appropriate mechanism:

- **View/gesture behavior** → a `.stories.tsx` play function that drives the DOM and asserts (playwright/vitest).
- **Pure logic** → extract to a `.ts` sibling and unit-test it (already the established pattern for text ticker, calendar, drag geometry).

**Order of attack (by weighted deficit), with the right mechanism per file:**

| File | Deficit | Mechanism |
|---|---|---|
| `components/menus/HoverMenu/hover-menu.tsx` | 2,546 | story play (25 dependents — a regression here is expensive) |
| `components/file-system/FileSystem/views/file-system-list-view.tsx` | 2,449 | story play |
| `components/menus/MorphingSwitcher/morphing-switcher.tsx` | 2,332 | story play |
| `components/file-system/FileSystem/views/file-system-column.tsx` | 2,054 | story play + extract column math |
| `components/file-system/FileSystem/views/file-system-mobile-grid-view.tsx` | 1,981 | story play |
| `components/file-system/FileSystem/views/file-system-mobile-list-view.tsx` | 1,770 | story play |
| `components/navigation/Dock/dock.tsx` | 1,476 | story play (19 dependents) |
| `components/navigation/Tabs/tabs.tsx` | 1,462 | story play (22 dependents) |
| `components/display/SwipeableList/swipeable-list.tsx` | 1,767 | story play (23 dependents) |
| `components/form/WheelPicker/wheel-picker.tsx` | 2,002 | story play (20 dependents) |

**Prioritize by dependents first** (hover-menu 25, SwipeableList 23, Tabs 22, WheelPicker 20, Dock 19), not by raw deficit — a defect in a 20+ dependent file has the widest blast radius.

**Done when:** each file above has either a passing story play or a paired `.test.ts`; `get_health` no longer lists them under `untested_hotspot`.

---

## Phase 2 — Decomplex the remaining CCN hotspots

Recent work already decomplexed three hotspots (commit `360b56e9`). The ones still over the threshold:

| File | CCN | NLOC | Action |
|---|---|---|---|
| `store/file-system-context.tsx` | 42 | 849 | extract pure selectors/reducers to `logic/` (see Phase 3) |
| `moti/presence/animate-presence.tsx` | 42 | 205 | extract the enter/exit branch resolution into a pure function |
| `menus/HoverMenu/hover-menu.tsx` | 34 | 370 | split per-variant render paths into subcomponents |
| `gestures/drag-store.ts` | 16 | 445 | extract per-event reducers into named functions |

**Rule of thumb:** cyclomatic complexity > 20 in a `.tsx` is almost always a `switch`/ternary over variants — pull each branch into a named subcomponent or a pure selector and the score drops without behavior change.

**Done when:** no runtime `.tsx`/`.ts` file (excl. stories) has `max_ccn` > 20.

---

## Phase 3 — Split the change-entropy / bug-magnet files

These files both **churn heavily** *and* **have shipped the most bugs**. Each edit is scattered (high entropy), which repowise flags as a strong future-defect predictor. The fix is the same in every case: shrink the file by extracting a stable seam, so future edits land in one place.

| File | Fix count / signal | Split direction |
|---|---|---|
| `file-system/FileSystem/file-system.stories.tsx` | 16 fixes, 2,375 NLOC | extract story data/helpers into a shared `*.story-data.ts` module (already done for Table in `c9b141ab`, FileSystem in `347697c9` — finish the remainder) |
| `menus/MorphingFAB/morphing-fab.tsx` | 12 fixes | extract layout math to `morphing-fab.logic.ts` |
| `menus/HoldMenu/hold-item.tsx` | 12 fixes | extract the twin-measure logic to a pure `.ts` |
| `menus/HoldMenu/hold-item-twin.tsx` | 12 fixes | same as above, shared with `hold-item.tsx` |
| `menus/HoldMenu/hold-menu.stories.tsx` | 11 fixes | extract story data |
| `file-system/FileSystem/store/file-system-context.tsx` | top-5% entropy, 849 NLOC | split store into `reducers.ts` + `selectors.ts` + thin context |
| `gestures/drag-store.ts` | top-1% entropy | split per-event reducers |
| `menus/Overlay/overlay-shell.tsx` | top-5% entropy | extract portal positioning |
| `typography/TextNumberTicker/text-number-ticker.tsx` | top-4% entropy | logic already split — extract the remaining display math |

**Done when:** each file is < ~350 NLOC of component code (logic in sibling `.ts`), and `get_risk` on the bug magnets shows declining `prior_defect` counts over the following weeks.

---

## Phase 4 — Dead-code removal

Repowise reports **824 dead-code findings: 29 safe-to-delete, ~414 safe lines, ~703 lines reclaimable.** These are clean removals with no graph references. Do this in one PR after Phase 1–3 (so the removals don't mask still-needed files).

**High-confidence, safe deletions** (unused exports, no importers):

- `components/display/Surface/surface.native.tsx::Surface` (109 lines)
- `storybook/native/.rnstorybook/preview.tsx::preview` (73 lines) — confirm it's not a Storybook convention-referenced export before deleting
- `components/display/Toaster/toaster.native.tsx::Toaster` (47 lines)
- `file-system/FileSystem/logic/file-system-kinds.ts::{FILE_KIND_LABELS, EXTENSION_MIME_TYPES, FALLBACK_MIME_TYPE}`
- `menus/Overlay/blur-provider.native.tsx::BlurProvider`, `menus/Overlay/overlay-blur.native.tsx::OverlayBlur`
- `menus/HoldMenu/style-guide.ts::TYPOGRAPHY`, `menus/Overlay/overlay-portal-store.ts::getOverlayDepth`
- `file-system/FileSystem/logic/file-system-sort.ts::SORT_OPTIONS`, `logic/file-system-icons-grid.ts::MIN_TILE_WIDTH`
- `gestures/drag-scope.ts::ROOT_DRAG_SCOPE`, `file-system/FileIcon/file-icons.tsx::useFileIconColor`
- `moti/interactions/pressable/hoverable.native.tsx::Hoverable`
- `__stories__/story-trigger.tsx::{TRIGGER_KINDS, TRIGGER_SIZES, TRIGGER_SHAPES}`
- `file-system/FileSystem/views/file-system-column.tsx::{COLUMN_ROW_HEIGHT, COLUMN_ROW_STRIDE, COLUMN_PADDING}`
- `file-system/FileSystem/views/file-system-mobile-menu.tsx::{MOBILE_KEBAB_SUFFIX, MOBILE_CHECKBOX_SUFFIX}`
- `file-system/FileSystem/views/file-system-search-view.tsx::SEARCH_ROW_HEIGHT`
- `lib/radius.ts::ROUNDED_INTERACTIVE`

**Verify before touching the `medium`/`low` tiers** (runtime-loaded or config files): `lib/haptics.native.ts`, `packages/icons/src/resolve-icon-color.ts`, and every `*.native.tsx` / `metro.config.js` / `babel.config.js` entry — these are loaded by platform resolution or tooling, not by an import edge.

**Done when:** `get_dead_code(safe_only=true)` returns 0 in the high tier, and the 414 safe lines are removed.

---

## Phase 5 — Break the 6 import cycles

Repowise names three of the six SCCs (the others are smaller):
- **Form Otp Input**
- **File System ↔ File System** (the `FileSystem` module is self-cyclic — likely views ↔ store ↔ types)
- **Menus Action Feedback Modal**

**Actions**
1. Enumerate the exact edges with `get_context(include=["callers","callees"])` on each SCC, or `repowise` SCC pages `scc-75a592713cff`, `scc-8d69df821005`, `scc-e718f73635fb`.
2. Break each cycle by moving the shared dependency (usually a type or a constant) into a leaf module that both sides import — never both directions.
3. The FileSystem cycle is the priority: it likely involves `file-system-context.tsx`, which is already being split in Phase 3. Fold the cycle-break into that split so `types/` and `logic/` become leaf modules.

**Done when:** `get_overview()` reports 0 import cycles.

---

## Phase 6 — Harden against the recurring defect patterns

The repo memory records a set of bugs that have each bitten **repeatedly**. Each is a candidate for a lint rule or a `check-*` script so it can't regress:

1. **`withRepeat` loops leak on unmount** → every `useSharedValue` + `withRepeat` needs `cancelAnimation` cleanup. (Root cause of a past 15s storybook stall.)
2. **`HoldItem` memo defeated by inline `containerStyles`** → object-literal props re-run the whole stack. Lint: flag inline object props to memoized components.
3. **Moti retains removed `animate` keys** → variant-conditional keys need every branch or a `key={variant}` remount.
4. **Children rendered twice** in several components → the decorative copy must stay unnamed or `getByTestId` matches twice.
5. **Hairlines** must be the `hairline` @utility, never a bare `border`.

**Actions:** promote the highest-frequency ones (1, 2, 3) into the existing `biome-*` plugin rules or `packages/ui/scripts/check-*.mjs` suite. The rest stay as documented conventions in `CONTRIBUTING.md`.

**Done when:** a `check-*` script or lint rule exists for items 1–3, wired into `lint` or `test`.

---

## Phase 7 — Script-only performance findings (low priority)

All 15 performance findings (`io_in_loop`, `hot_path_sync_io`) live in build/dev scripts with `health_impact: 0` — **none are in runtime component code.** They batch file/network I/O in `.github/scripts/upload-apk-to-s4.py`, `packages/ui/scripts/{check-readme,check-no-hardcoded-colors,gen-icons,gen-file-icons,migrate-icons}.mjs`, and `packages/icons/scripts/gen-icons.mjs`.

These only matter if CI is slow. **Defer** unless build times become painful; then the fix is "read the directory once, filter in memory" rather than per-iteration I/O.

---

## Sequencing & definition of done

**Suggested order:** 0 → 1 → 2 → 3 → 4 → 5 → 6 (7 deferred).

**Overall success metrics**
- Average code health **≥ 8.0** (from 6.3).
- Hotspot health **≥ 7.0** (from 4.99).
- **0** import cycles (from 6).
- **0** high-tier dead-code findings (from 26).
- **0** runtime files with `max_ccn` > 20 (from 3 at 34–42).
- The 5 bug-magnet files (≥ 11 fixes each) show no new bug fixes over a 30-day window.

**Working agreement:** every phase ships as its own changeset/commit (repo convention: commit straight to `main`), with `npm run typecheck && npm run lint && npm run test` green before merge.

---

*Generated from Repowise (`get_health`, `get_overview`, `get_dead_code`) + repo memory. Re-run `repowise update` before Phase 1 to refresh the 30 files changed since the last index.*
