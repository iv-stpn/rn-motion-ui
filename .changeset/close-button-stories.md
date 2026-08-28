---
'rn-motion-ui': patch
---

add CloseButton stories and pin the storybook group order

`CloseButton` gains its first stories — an `Interactive` playground (floating,
elevation, size), a press demo that asserts `onPress` fires, and an `AllSizes`
catalogue. The storybook sidebar/story list also gets an explicit
`options.storySort`, so the `Buttons` group sorts above `File System` instead of
relying on filesystem discovery order.
