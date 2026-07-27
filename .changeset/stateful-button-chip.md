---
"rn-motion-ui": major
---

**Breaking — `StatefulButton`'s `elevated` prop is replaced by `chip`.** `elevated` was a boolean with one alternative to the flat button; there are now two chip keys, so the flag becomes a mode:

```diff
-<StatefulButton elevated onPress={submit}>Save</StatefulButton>
+<StatefulButton chip="elevated" onPress={submit}>Save</StatefulButton>
```

Omitting `chip` renders the flat button, exactly as omitting `elevated` did. `elevated` is gone rather than deprecated — it shipped one release ago in 3.2.0, and keeping a boolean that means "one particular chip" beside the mode it is a subset of reads worse than the rename costs.

The new value is `chip="glossy"`: the `GlossyButton` key (domed SVG gradient, inset bevel, OKLCH-derived cast) driven through the same machine. Either key keeps its full appearance through loading/success/error instead of greying out, and each state adopts the matching variant — idle/loading map the flat variant onto that key's palette (danger family → `danger`, `special`/`inverse` carry over, everything else → the key's neutral fill), success switches to the `success` key, error to the `danger` key. Full fill, gloss, rim and cast, not a flat overlay: neither chip paints the flat button's crossfaded colour plate, because it has a variant to switch instead. Glossy dims whole-key via opacity rather than recolouring its label, so its idle content colour comes from `glossyContentColor` and holds constant across states.

The success/error horizontal padding squeeze is now derived from the family's shared `--spacing-button-pad-*` rather than tabulated per size, so retuning a padding token keeps the squeeze proportional.
