# rn-motion-ui

## 0.2.0

### Minor Changes

- 0e9215d: Add five new components — `AdaptiveModal`, `AnimatedList`, `Card`, `CardChoice`, and `Skeleton` (each with stories and package exports) — and refine existing ones:

  - `ActionFeedbackModal`: rewrite the status icon as a single morphing vessel that animates size + fill colour across loading/success/error states while the glyph cross-fades, replacing the three static icon variants.
  - `CommandPalette`: rework layout and interaction handling.
  - `MultiStepMenu`: refine component and stories.

## 0.1.0

### Minor Changes

- First public release of `rn-motion-ui` as a single package. Consolidates the former `@rn-motion-ui/{rn,moti,hooks,utils}` packages into one unscoped package with subpath exports (no barrel files): 40+ animated React Native / React Native Web UI components, the Moti/Reanimated 4 primitives, shared React hooks, and shared TypeScript utilities.
