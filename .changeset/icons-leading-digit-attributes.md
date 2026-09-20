---
'rn-motion-ui-icons': patch
---

Write the generated icon attributes' numeric values with a leading digit, closing the same gap in `gen-icons.mjs` that flattened the file-system glyphs on native.

react-native-svg parses a gradient stop's `offset` with a regex that demands a leading digit, and a value that misses it warns and coerces to `0` — which, because the stops are then sorted by offset, collapses a whole gradient onto one position. No mingcute icon ships a dot-leading `offset` today, and none of the seven values this changes is broken by the dot: they are `stopOpacity=".55"`, `opacity=".1"` and `r=".5"`, all of which are read with `Number()`/`+`. What made it worth closing is the adjacency — `loading-line` writes `stopOpacity=".55"` on the line directly under the gradient stops it would have to be confused with.

The generator now gives a leading zero to any attribute value that begins with a dot-leading number, as it is serialised, and refuses to write a file if one ever survives that. Only the value's leading number is touched: `d` and `transform` cannot match, since a path begins with a command letter and a transform with a function name, and their interior dots (`1.546-.243`) are valid SVG rather than defects.

Six icons are regenerated — `live-photo-line` (`strokeDasharray=".5 5"`), `loading-3-fill`, `loading-3-line`, `loading-fill`, `loading-line` and `palette-2-line`. Nothing renders differently; the changed values are the same numbers spelled the way every parser in the chain accepts.
