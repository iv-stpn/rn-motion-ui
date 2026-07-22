---
"rn-motion-ui": minor
---

Replace hardcoded hex colors with semantic theme token hooks.

All components that previously used inline hex constants now read colors through `useThemeColor` / `useThemeColors`, enabling consumer `@theme` overrides to propagate into component internals on both web and native. Affected components: `ActionFeedbackModal`, `AnimatedBadge`, `AvailabilityScheduler`, `BloomMenu`, `BouncyAccordion`, `Button`, `Checkbox`, `FeedbackWidget`, `FullSheet`, `Input`, `Loader`, `MorphingModal`, `OtpInput`, `OverflowActions`, `Radio`, `ScrollProgress`, `StarRating`, `SwipeableList`, `Switch`, `Tabs`.
