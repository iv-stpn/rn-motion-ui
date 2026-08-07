---
"rn-motion-ui-icons": patch
---

Every icon takes a `testID`

An icon was addressable in a test only through its accessibility label, which
tied a test selector to user-facing copy and left decorative icons — the ones
with no label, by design — unreachable. `IconProps` now carries `testID`, passed
straight to the root `Svg`:

```tsx
<CheckLine testID="confirm-check" />
```

The prop is optional and adds nothing when omitted, so an icon that does not ask
for one renders exactly as before. This matches the `testID` the form components
in `rn-motion-ui` already accept, so a screen mixing the two has one way to
select either.
