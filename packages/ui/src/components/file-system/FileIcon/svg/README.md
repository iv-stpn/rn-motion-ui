# File-type icon sources

The SVG art the file-type glyphs are generated from. `scripts/gen-file-icons.mjs`
reads this folder and emits `../file-icon-glyphs.tsx` and `../file-icon-metrics.ts`;
nothing here is imported at runtime, so editing an SVG changes nothing until the
generator is re-run.

| Path | What it is |
| --- | --- |
| `paper.svg` | The empty file every category badge is drawn on — gradient sheet, blurred drop shadow, curled corner. Emitted once as `FilePaperGlyph` rather than repeated in all 16 badges. |
| `categories/` | The tintable badges, one per file category. Each is the glyph alone; the category colour it is drawn in is what the generator swaps for the `{color}` prop. |
| `brands/` | Fixed-colour vendor logos, emitted verbatim. Drawn full-bleed, with no paper under them. |

A category badge is authored on a 512-square page template that the vector
`paper.svg` has since replaced, which is why its coordinates do not line up with
the paper's own 128-square. `FILE_BADGE_SHEET` in the generator is the bridge
between the two — see the comments there.

The badges originally shipped that template baked in as a base64 `<image>`. It is
stripped here: the generator reads the glyph and nothing else, so keeping ~320 KB
of duplicated raster in the tree would only make the sources unreadable.

## Provenance

- `paper.svg` — based on the matt icon theme by sixsixfive, released under CC0 on
  openclipart (the attribution comment travels with the file).
- `categories/*.svg` — original art for this icon set.
- `brands/*.svg` — vendor marks, each the trademark of its owner, kept in the
  spelling their sources use: `pdf` (Adobe Acrobat), `word` / `excel` /
  `powerpoint` / `onenote` (Microsoft Office, 2019–2025 marks), `flash` and `ai`
  (vscode-icons), `video` (SVGRepo).

There is no `categories/video.svg`: `.mp4` and friends resolve to the `video`
brand glyph, so the category badge that once covered them is unused.
