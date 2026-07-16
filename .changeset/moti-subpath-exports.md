---
"@rn-motion-ui/moti": minor
---

Restructure the package around explicit subpath exports. All barrel files and `export *` re-exports were removed; every module is now reached through a flat subpath declared in `package.json` (e.g. `@rn-motion-ui/moti/view`, `@rn-motion-ui/moti/motify`, `@rn-motion-ui/moti/use-moti-pressable`). There is no longer a root `.` entry, so bare `@rn-motion-ui/moti` imports must be replaced with the relevant subpath.
