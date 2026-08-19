---
'rn-motion-ui': patch
---

fix(Input): render the value and placeholder in the custom font

Input (and CommandPalette's search field) now apply the `font-sans-normal`
family token to the `TextInput`, so the typed text and its placeholder use the
app's custom typeface (e.g. Geist) instead of the platform's default font,
matching the rest of the UI.
