---
"rn-motion-ui": major
---

**Breaking**: `rn-motion-ui/icons` is gone. Icons live in `rn-motion-ui-icons`.

The 109 icons this package used to re-export were a subset of Lucide, hand-picked
because each one had to be committed as generated source. That is a bad deal for a
consumer: the icon you want is either in that list or it does not exist for you,
and the list only grew when a component here happened to need something.

`rn-motion-ui-icons` replaces it with the whole MingCute set — 3335 icons, one
subpath each. Every icon this package renders internally now comes from there, so
what components use and what you can use are the same set.

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

Install it alongside this package — `rn-motion-ui` depends on it, so anything that
takes an icon (`ThemedIcon`, `CommandIcon`, `BloomIcon`, `FileSystem`'s action
icons) is already typed against the new `IconProps` and needs no change beyond the
import.

**`strokeWidth` is gone from `IconProps`.** Lucide's geometry is stroked and took a
width; MingCute ships fill and stroke variants with the weight baked into the path,
so there is nothing to widen. Drop the prop — it is a type error now. Where this
package passed `strokeWidth={2.5}` for a slightly heavier check (`Input`,
`OTPInput`, `StatefulButton`, `AnimatedBadge`), those icons now render at MingCute's
own weight, which is a visible but deliberate change.

Names do not carry over: MingCute names its own icons, and most differ from
Lucide's. Every icon is suffixed `-line` or `-fill` (1667 line, 1668 fill), and the
component name is the PascalCase of the file — `icons/check-line` exports
`CheckLine`. The mapping used for the internal migration, if you were relying on the
same names:

| was (Lucide) | now (MingCute) |
| --- | --- |
| `AlertCircle`, `Info` | `icons/information-line` → `InformationLine` |
| `AlertTriangle` | `icons/alert-line` → `AlertLine` |
| `Check` | `icons/check-line` → `CheckLine` |
| `ChevronDown` / `Up` / `Left` / `Right` | `icons/down-line` / `up-line` / `left-line` / `right-line` |
| `Circle` | `icons/round-line` → `RoundLine` |
| `FileText`, `ScrollText` | `icons/file-line` → `FileLine` |
| `FolderClosed`, `FolderKanban` | `icons/folder-line` → `FolderLine` |
| `GripVertical` | `icons/dots-vertical-line` → `DotsVerticalLine` |
| `LoaderCircle` | `icons/loading-line` → `LoadingLine` |
| `MoreHorizontal` | `icons/more-1-line` → `More1Line` |
| `Plus` | `icons/add-line` → `AddLine` |
| `Trash2` | `icons/delete-2-line` → `Delete2Line` |
| `User` | `icons/user-2-line` → `User2Line` |
| `X` | `icons/close-line` → `CloseLine` |

The rest resolve the same way: kebab-case the concept, add `-line` or `-fill`, and
the export is its PascalCase.
