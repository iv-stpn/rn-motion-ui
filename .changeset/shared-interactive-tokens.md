---
"rn-motion-ui": minor
---

**Breaking: token rename — `--spacing-button-*` → `--spacing-interactive-*`, `--radius-button-*` → `--radius-interactive`**

The box geometry tokens (height, horizontal padding, corner radius) that were previously named after buttons have been renamed because they are shared by Button, Input, OtpInput, Tabs, and ButtonGroup. Consumers who overrode `--spacing-button-md`, `--radius-button-md` or their CSS utility classes `h-button-*`, `rounded-button-*`, `px-button-pad-*` must update to the new names.

**New: four-category corner radius system**

Radius is now split into `--radius-interactive` (buttons, inputs, tabs), `--radius-card`, `--radius-menu`, and `--radius-modal` — each family independently tunable. A new shared `lib/radius.ts` module exports the corresponding pixel constants and Tailwind class strings, replacing the definitions that lived inside `button-scale.ts`.

**Menu: staggered item entry, faster exit, size-aware separators**

Each menu item now fades in with a 25ms stagger delay, driven by a new `MOTION_MENU_ENTER` spring preset. Exit duration was cut to 150ms, enter scale deepened to 0.85, and per-item offset increased to 12px. `MenuSeparator` and `MenuLabel` now accept a `size` prop so their thickness and font size track the menu scale.

**Button: press animation modes and continuous spinner**

Buttons gain a `pressMode` prop — `scale` (default, uniform), `scaleY` (vertical compression for segmented controls), and `none`. The loading spinner was rewritten from declarative MotiView loop to imperative Reanimated `withRepeat` so it no longer restarts on every parent re-render.

**Tabs: new `size` prop**

Tabs now accepts `size` (`sm` | `md` | `lg`) to control trigger height via the interactive surface family tokens, aligning with Button and Input at the same size.

**Input: size-aware text and padding**

The Input text box now scales its font size and horizontal padding per the `size` prop, matching the interactive surface family.

**Dock, Table, Loader, FeedbackWidget, ButtonGroup, and others**

All components updated to use the renamed tokens and consolidated radius constants.
