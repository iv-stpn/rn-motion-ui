---
"rn-motion-ui": minor
---

`Card`: pass `onPress` and the surface becomes pressable

A card that stands for something you can open had to be wrapped in a `Pressable`
by hand, which meant a second element around the one that already draws the
frame. Give `Card` an `onPress` and it renders as the `Pressable` itself:

```tsx
<Card elevation={2} onPress={() => open(project.id)}>
  <Text>{project.name}</Text>
</Card>
```

Omit it and nothing changes — the card is the plain `View` it always was, with no
press responder in the tree. The size, elevation and `className` handling are the
same either way.
