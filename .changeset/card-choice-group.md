---
"rn-motion-ui": minor
---

Add `CardChoiceGroup` to `rn-motion-ui/card-choice`. Wrapping `CardChoice` cards in a group renders a single shared indicator dot that glides between cards on selection (spring-animated, reduced-motion aware) instead of each card toggling its own dot. `CardChoice` gains a `value` prop for group use; standalone `selected` + `onPress` continue to work unchanged.
