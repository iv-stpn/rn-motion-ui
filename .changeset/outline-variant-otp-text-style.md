---
"rn-motion-ui": minor
---

**Button / IconButton: re-add `outline` variant; ThemedIcon token for it; OtpInput theme text styles typed as `TextStyle`**

- `Button` and `IconButton` gain an `outline` variant (`border border-border bg-transparent`, label `text-foreground`) — a bordered ghost, distinct from the borderless `ghost`. Previously pruned in the variant-consolidation refactor; consumers (offkeep) need it back.
- `ThemedIcon` maps `outline` to the `foreground` token so icons inside outline buttons resolve a legible stroke colour.
- `OtpInput`'s `OtpInputTheme.pinCodeTextStyle` / `placeholderTextStyle` are now `TextStyle` instead of `ViewStyle` — they are applied to `Text`, so the old typing rejected legitimate font styles (letterSpacing, fontSize, fontWeight).
