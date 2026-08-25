---
'rn-motion-ui': patch
---

feat(theme): draw every border at 1.5px

Tailwind's bare `border` is 1px, which renders thin and washed-out against the
low-alpha `border` token — on high-density screens the edge all but disappears.
Every border in the library now carries an explicit 1.5px width: `border`
becomes `border-[1.5px]`, the side utilities (`border-t`, `border-r`,
`border-b`, `border-l`) become their `-[1.5px]` equivalents, and the handful of
2px accents (`border-2`) come down to the same 1.5px so the library has one
border weight rather than three. `border-*-0` still means no border, and
`border-border` and every other color utility are untouched.

The 2px accents that changed are `Radio` and `Checkbox`'s control, `OtpInput`'s
slot and its active ring, `FileSystem`'s internal-drop highlight (column and
body) and its drop indicator. `OtpInput`'s active ring also drops its
`-inset-px` offset for `inset-0`: at 2px the ring covered the slot's own border
while bleeding 1px past the slot bounds, and at 1.5px that offset would have
left a hairline of the slot's status colour (success, error) showing inside it.
Pinned to the slot's bounds the two borders land on top of each other, so an
active cell reads as a single 1.5px edge in every state.

The two places that mirror a border width in JS move with it:
`HOLD_MENU_BORDER_HEIGHT` goes from `2` to `3` (top + bottom) so the hold-menu
panel's pre-mount height estimate stays exact, and `Dock`'s `BORDER_WIDTH`
goes from `1` to `1.5` so the active pill still centres on its item — item
layouts are reported against the border box, the pill is placed against the
padding box. `HoldMenu`'s row divider moves to a 1.5px `borderBottomWidth` to
match.

Consumers passing `border` (or a side variant) through `className` keep the 1px
Tailwind default; pass `border-[1.5px]` to match the library.
