---
"rn-motion-ui": patch
---

**refactor: migrate inline style props to className where possible**

Inline `style` props (flexDirection, overflow, width, opacity, textAlign) moved to Tailwind utility classes across Marquee, SwipeableList, Table, Button, and ElevatedButton. `CHECKBOX_COL_WIDTH` renamed to `CHECKBOX_COLUMN_WIDTH` and relocated from `table-types.ts` to `table-utils.ts`. No behavioural changes.
