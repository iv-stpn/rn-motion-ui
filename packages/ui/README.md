# rn-motion-ui

Animated React Native + React Native Web UI components, styled with [Tailwind](https://tailwindcss.com/) via [uniwind](https://github.com/nativewind/uniwind) and powered by an in-package Moti / [Reanimated](https://docs.swmansion.com/react-native-reanimated/) 4 layer.

The components are written as React Native primitives, so they run on native (iOS/Android via Expo or bare RN) and on the web through `react-native-web`.

## Install

```sh
npm install rn-motion-ui
# or: bun add rn-motion-ui
```

### Peer dependencies

Install these in your app (they are not bundled):

```sh
npm install react react-native react-native-reanimated react-native-gesture-handler
```

| Peer | Supported range |
| --- | --- |
| `react` | `>=18.0.0` |
| `react-native` | `>=0.76.0` |
| `react-native-reanimated` | `>=4.0.0` |
| `react-native-gesture-handler` | `>=2.0.0` |

## Consumer setup

This package **ships TypeScript source** (no prebuilt bundle). Your bundler already transpiles your own app code, so it will transpile these components the same way — but two build-time plugins are required for the components to work correctly:

1. **`react-native-reanimated/plugin`** (Babel) — transforms Reanimated worklets. Without it, easing/animation worklets throw at runtime.
2. **`uniwind`** — resolves the `className` props on RN components to styles at build time. Without it, `className` is ignored.

### Native (Expo / Metro)

`babel.config.js`:

```js
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-reanimated/plugin'],
};
```

Set up `uniwind` per its docs (Metro transformer + a `global.css` Tailwind entry).

### Web (Vite / react-native-web)

Alias `react-native` → `react-native-web`, run the Reanimated Babel plugin through your React transform, and add the `uniwind` Vite plugin. See this repo's `storybook/web/.storybook/main.ts` for a working reference config.

## Usage

Every module is a **subpath export** — import directly from its path. There is no barrel `index` export by design, so bundlers only pull in what you import.

```tsx
import { Button } from 'rn-motion-ui/button';
import { Switch } from 'rn-motion-ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from 'rn-motion-ui/tabs';
import { useReducedMotion } from 'rn-motion-ui/hooks/use-reduced-motion';
import { MotiView } from 'rn-motion-ui/moti/view';
import { AnimatePresence } from 'rn-motion-ui/moti/presence';
import { hasKey } from 'rn-motion-ui/utils/typeguards';
```

## Available exports

Subpaths are namespaced by category:

- **UI components** — flat, e.g. `rn-motion-ui/button`, `rn-motion-ui/tabs`, `rn-motion-ui/bottom-sheet`, …
- **Hooks** — `rn-motion-ui/hooks/<name>` (`use-reduced-motion`, `use-mount-effect`, `use-in-view`, …)
- **Moti primitives** — `rn-motion-ui/moti/<name>` (`view`, `text`, `motify`, `presence`, `pressable`, …)
- **Utils** — `rn-motion-ui/utils/typeguards`

### UI components

| Subpath | Component / hook |
| --- | --- |
| `/button` | `Button` |
| `/elevated-button` | `ElevatedButton` |
| `/stateful-button` | `StatefulButton` |
| `/glossy-button` | `GlossyButton` |
| `/switch` | `Switch` |
| `/checkbox` | `Checkbox` |
| `/checkbox-card` | `CheckboxCardGroup`, `CheckboxCard` |
| `/radio` | `Radio` |
| `/radio-card` | `RadioCardGroup`, `RadioCard` |
| `/star-rating` | `StarRating` |
| `/input` | `Input` |
| `/tabs` | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| `/breadcrumbs` | `Breadcrumbs` |
| `/card` | `Card` |
| `/text` | `Text` |
| `/skeleton` | `Skeleton` |
| `/loader` | `Loader` |
| `/animated-badge` | `AnimatedBadge` |
| `/text-cascade` | `TextCascade` |
| `/text-number-ticker` | `TextNumberTicker` |
| `/text-reveal` | `TextReveal` |
| `/text-rolling` | `TextRolling` |
| `/text-shimmer` | `TextShimmer` |
| `/marquee` | `Marquee` |
| `/scroll-reveal` | `ScrollReveal` |
| `/scroll-progress` | `ScrollProgress` |
| `/scroll-to` | `ScrollTo` |
| `/smooth-scroll` | `SmoothScroll` |
| `/dock` | `Dock` |
| `/draggable` | `Draggable` |
| `/popover` | `Popover` |
| `/drawer` | `Drawer` |
| `/bottom-sheet` | `BottomSheet` |
| `/full-sheet` | `FullSheet` |
| `/morphing-modal` | `MorphingModal` |
| `/adaptive-modal` | `AdaptiveModal` |
| `/action-feedback-modal` | `ActionFeedbackModal` |
| `/adaptive-dropdown` | `AdaptiveDropdown` |
| `/menu` | `Menu`, `MenuSeparator`, `MenuLabel` |
| `/menu-item` | `MenuItem` |
| `/multi-step-menu` | `MultiStepMenu` |
| `/bloom-menu` | `BloomMenu` |
| `/hover-menu` | `HoverMenu` |
| `/hold-context-menu` | `HoldContextMenu` |
| `/overflow-actions` | `OverflowActions` |
| `/bouncy-accordion` | `BouncyAccordion` |
| `/dynamic-island` | `DynamicIsland` |
| `/action-swap` | `ActionSwap` |
| `/animated-list` | `AnimatedList`, `AnimatedListItem` |
| `/swipeable-list` | `SwipeableList` |
| `/range-slider` | `RangeSlider` |
| `/cylinder-carousel` | `CylinderCarousel` |
| `/wheel-picker` | `WheelPicker` |
| `/command-palette` | `CommandPalette` |
| `/otp-input` | `OtpInput` |
| `/feedback-widget` | `FeedbackWidget` |
| `/table` | `Table` |
| `/table-header` | `HeaderCell` |
| `/table-row` | `TableRow`, `RowCell` |
| `/table-types` | table type definitions |
| `/table-utils` | sorting / filtering helpers |
| `/use-table` | `useTable` |
| `/use-column-reorder` | `useColumnReorder` |
| `/file-system` | `FileSystem` |
| `/file-icon` | `FileTypeIcon`, `FileSystemFolderGlyph` |
| `/icon` | `ThemedIcon` |
| `/ease` | easing constants |
| `/tokens.css` | design token stylesheet |
| `/theme/use-theme-color` | `useThemeColor`, `useThemeColors` |
| `/breakpoints` | breakpoint scale + pure resolvers |
| `/hooks/use-breakpoint` | `useBreakpoint`, `useBreakpointAtLeast` |
| `/hooks/use-calendar` | `useCalendar` |
| `/hooks/use-date-picker` | `useDatePicker` |
| `/hooks/use-date-range-picker` | `useDateRangePicker` |
| `/calendar` | ISO date arithmetic + month grids |
| `/calendar-format` | `Intl` label formatters |
| `/calendar-props` | calendar prop types + builders |
| `/calendar-selection` | selection, per-cell state, focus movement |
| `/date-field` | text ⇄ date parsing for the pickers' fields |
| `/date-picker-props` | trigger / panel / field prop types |

## Responsive breakpoints

Every responsive decision in the library resolves against one scale, which mirrors Tailwind's default `screens` so a `md:` class and a `useBreakpoint() === 'md'` check flip at the same width:

| Name | Min width |
| --- | --- |
| `base` | `0` |
| `sm` | `640` |
| `md` | `768` |
| `lg` | `1024` |
| `xl` | `1280` |
| `2xl` | `1536` |

### `useBreakpoint`

Returns the current tier and **re-renders only when that tier changes**. `useWindowDimensions` pushes a render for every resize frame — dragging a window edge across 200 px re-renders the whole subtree ~200 times even though the layout decision never moved. This subscribes to the same `Dimensions` event but stores only the resolved breakpoint.

```tsx
import { useBreakpoint, useBreakpointAtLeast } from 'rn-motion-ui/hooks/use-breakpoint';

const breakpoint = useBreakpoint();               // 'base' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
const breakpoint = useBreakpoint({ md: 720 });    // move just the md edge
const isWide = useBreakpointAtLeast('md');        // one cutoff, boolean, flips once
const isWide = useBreakpointAtLeast(900);         // raw pixels work too
```

Overrides are matched by value, not object identity, so an inline `{{ md: 720 }}` literal doesn't re-subscribe on every render.

### Per-component overrides

Components that pick a layout from the window width take a `wideBreakpoint` prop — a breakpoint name or a raw pixel number:

| Component | Prop | Default |
| --- | --- | --- |
| `AdaptiveModal` | `wideBreakpoint` | `'sm'` (640) |
| `FullSheet` | `wideBreakpoint` | `'sm'` (640) |
| `AdaptiveDropdown` | `wideBreakpoint` | `'md'` (768) |

```tsx
<AdaptiveModal wideBreakpoint="md" … />   {/* stay narrow until 768 */}
<AdaptiveDropdown wideBreakpoint={900} … />
```

`AdaptiveModal` also keeps `isWideScreen` to bypass width entirely, and `MultiStepMenu` still receives `isWideScreen` from its caller.

`FileSystem` is the exception: it adapts to its **own measured width**, not the window's, so it collapses inside a narrow parent too. Its tiers are container widths and are overridden as a group:

```tsx
<FileSystem breakpoints={{ minimal: 320, compact: 520, tablet: 720 }} … />
```

### Measuring your own container

The resolvers are pure and React-free, so a component that measures itself can reuse the same thresholds:

```tsx
import { breakpointForWidth, isWidthAtLeast } from 'rn-motion-ui/breakpoints';

const tier = breakpointForWidth(measuredWidth);          // 'md'
const isWide = isWidthAtLeast(measuredWidth, 'lg');      // boolean
```

## Headless calendar and date pickers

Three hooks — `useCalendar`, `useDatePicker`, `useDateRangePicker` — that own the date logic, the keyboard, and the accessibility payload, and render nothing. There is no styled `<Calendar />` in the package: the markup is yours, so the grid can be seven `Pressable`s in a `View`, a `FlatList`, or a table, without fighting a wrapper's opinions.

Dates are ISO `'YYYY-MM-DD'` strings throughout — arguments, return values, and callbacks. No `Date` objects cross the API, so a value can be compared with `===`, sorted as a string, stored as JSON, and put in a dependency array without a stable-reference dance.

### `useCalendar`

The month grid. State plus a prop getter per element, each returning an object to spread:

```tsx
import { useCalendar } from 'rn-motion-ui/hooks/use-calendar';

const calendar = useCalendar({ mode: 'range', numberOfMonths: 2, minDate: '2026-01-01' });

<View {...calendar.getRootProps()}>
  <Pressable {...calendar.getPreviousMonthProps()}><Text>‹</Text></Pressable>
  {calendar.months.map((month) => (
    <View key={month.month} {...calendar.getMonthProps(month.month)}>
      <Text {...calendar.getMonthLabelProps(month.month)}>{month.label}</Text>
      <View {...calendar.getWeekdayRowProps(month.month)}>
        {calendar.weekdays.map((weekday) => (
          <Text key={weekday.weekday} {...calendar.getWeekdayProps(weekday, month.month)}>{weekday.short}</Text>
        ))}
      </View>
      <View {...calendar.getGridProps(month.month)}>
        {month.weeks.map((week, index) => (
          <View key={index} {...calendar.getWeekProps(month.month, index)}>
            {week.map((day) => (
              <Pressable key={day.date} {...calendar.getDayProps(day)}>
                <Text>{day.day}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  ))}
</View>
```

Every cell arrives decorated — `isSelected`, `isToday`, `isInRange`, `isRangeStart`, `isRangeEnd`, `isPreview`, `isDisabled`, `isWeekend`, and `outside` for an adjacent-month day — so styling is a lookup rather than a recomputation per render.

What the getters carry beyond the obvious:

- **Roving tab stop.** Exactly one cell per calendar has `tabIndex: 0`; the rest are `-1`. Tab reaches the grid once and the arrow keys move within it, which is the WAI-ARIA grid pattern — 42 cells in the tab order is not.
- **Keyboard.** Arrows step a day or a week, `Home`/`End` go to the ends of the week, `PageUp`/`PageDown` step a month (a year with shift). A step that leaves the visible months pages the view. `isRTL` mirrors the horizontal axis only — up is still up. `preventDefault` is called only for keys the grid acts on, so Tab still leaves.
- **Focus.** Moving the cursor focuses the destination cell through its `ref`, including when that cell mounts after the step (paging to a month that isn't rendered yet).
- **Disabled days keep their tab stop.** They get `aria-disabled` and `accessibilityState`, but not `disabled` — an unreachable day cannot announce why it is unavailable. The press handler refuses.
- **Both a11y dialects.** Native `accessibilityState`/`accessibilityRole` and web `aria-*` are emitted together, because react-native-web maps only the `aria-` form.

### `useDatePicker` / `useDateRangePicker`

The grid plus a disclosure, a typeable text field per date, and a backdrop:

```tsx
import { useDatePicker } from 'rn-motion-ui/hooks/use-date-picker';

const picker = useDatePicker({ onSelectDate: setValue, testID: 'depart' });

<TextInput {...picker.getFieldProps()} />
<Pressable {...picker.getTriggerProps()}><Text>Pick a date</Text></Pressable>
{picker.isOpen ? (
  <>
    <Pressable {...picker.getDismissProps()} />
    <View {...picker.getPanelProps()}>
      {/* render picker.calendar exactly as above */}
      <Pressable {...picker.getClearProps()}><Text>Clear</Text></Pressable>
    </View>
  </>
) : null}
```

The field is forgiving in the ways a date field has to be. Typing shows a draft without committing it; blur commits, submit commits and closes. Text that doesn't parse snaps back to the current value rather than silently discarding it, and a complete, allowed date moves the grid as you type so the two never disagree. `format` takes a `{ parse, format }` pair for a non-ISO field order.

The range picker differs where a range genuinely differs: two months by default, two independent field drafts, and it closes when the range is **complete** — not on the first press, which only starts it. A range typed backwards is reordered rather than rejected, clearing one field leaves a half-open range the next press can complete, and a date typed in the end field is revealed in the *last* month on screen so the start stays visible beside it.

The trigger is a **button with `aria-expanded`**, deliberately not a `combobox`: React Native has neither `aria-controls` nor `aria-haspopup`, so a combobox would announce a popup assistive tech cannot then find. The panel is a `dialog` whose three modal flags (`role`, `aria-modal`, `accessibilityViewIsModal`) all follow one `modal` option, so an inline calendar never claims to trap focus that nothing has trapped.

### Test IDs

Pass `testID` and every child derives its own; pass nothing and no `testID` is emitted anywhere, so a tree stays clean by default.

```tsx
useDatePicker({ testID: 'depart' });
// depart-trigger · depart-panel · depart-field · depart-clear · depart-dismiss
// depart-day-2026-08-05 · depart-grid-2026-08 · depart-month-label-2026-08 · depart-prev-month
```

### Pure helpers

The logic underneath is exported separately, all React-free: `rn-motion-ui/calendar` (ISO arithmetic, `buildMonthGrid`, range helpers), `rn-motion-ui/calendar-format` (`Intl` labels), `rn-motion-ui/calendar-selection` (selection transitions, per-cell state, focus movement), `rn-motion-ui/calendar-props` and `rn-motion-ui/date-picker-props` (the prop shapes, for typing your own render functions), and `rn-motion-ui/date-field` (parse/format and commit resolution).

## Theming

### Design tokens

The library ships a canonical Tailwind token sheet that you import once in your app's global CSS:

```css
@import "tailwindcss";
@import "rn-motion-ui/tokens.css";
```

This registers 13 semantic color tokens as Tailwind CSS utilities (`bg-primary`, `text-foreground`, `border-border`, …) and applies automatic dark-mode overrides via `@media (prefers-color-scheme: dark)`.

#### Token reference

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `surface` | `oklch(99% 0 0)` | `oklch(9% 0 0)` | Page / screen background |
| `foreground` | `oklch(15% 0 0)` | `oklch(96% 0 0)` | Default text |
| `card` | `oklch(97% 0 0)` | `oklch(13% 0 0)` | Card / panel surfaces |
| `muted` | `oklch(97% 0 0)` | `oklch(16% 0 0)` | Subtle backgrounds |
| `muted-foreground` | `oklch(50% 0 0)` | `oklch(60% 0 0)` | Secondary / placeholder text |
| `border` | `oklch(15% 0 0 / 0.06)` | `oklch(99% 0 0 / 0.08)` | Dividers and outlines |
| `primary` | `oklch(15% 0 0)` | `oklch(96% 0 0)` | Primary actions / fills |
| `primary-foreground` | `oklch(99% 0 0)` | `oklch(15% 0 0)` | Text on primary |
| `secondary` | `oklch(97% 0 0)` | `oklch(18% 0 0)` | Secondary fills |
| `secondary-foreground` | `oklch(15% 0 0)` | `oklch(96% 0 0)` | Text on secondary |
| `danger` | `oklch(62% 0.22 25)` | `oklch(66% 0.22 25)` | Error / danger states |
| `success` | `oklch(70% 0.18 155)` | `oklch(72% 0.18 155)` | Success states |
| `warning` | `oklch(78% 0.18 75)` | `oklch(80% 0.18 75)` | Warning states |

#### Overriding tokens

Add a `@theme` block after the import to override any token for your brand:

```css
@import "rn-motion-ui/tokens.css";

@theme {
  /* Brand blue as primary */
  --color-primary:            oklch(52% 0.22 250);
  --color-primary-foreground: oklch(99% 0 0);
}
```

For manual dark mode (`.dark` class on `<html>` instead of `prefers-color-scheme`):

```css
@import "rn-motion-ui/tokens.css";

/* tokens.css already handles system dark-mode; add .dark support too: */
@layer base {
  .dark {
    --color-primary: oklch(70% 0.22 250);
  }
}
```

#### Retinting the neutral palette

The neutral ramp (surfaces, foregrounds, borders, muted) is not pure grey — every step carries a faint shared tint, declared in the sheet as `--neutral-hue` / `--neutral-chroma`. Those two are documentation, not inputs: uniwind folds every color to a hex at bundle time, and a `var()` inside `oklch()` never folds on native, so the tint has to be baked into the literals. To change it, generate your own sheet:

```bash
npx rn-motion-ui-tokens --hue 250 --chroma 0.006
```

That writes a `tokens.css` into the current directory. Import it **instead of** `rn-motion-ui/tokens.css` — it's a full replacement, not an overlay:

```css
@import "tailwindcss";
@import "./tokens.css";
```

Every neutral-tinted literal is rewritten to the new hue, with each token's chroma scaled proportionally so partial tints stay partial. Status colors (`danger`, `success`, `warning`, `info`) and true achromatic values are left alone, as are the shadow recipes, all three theme blocks, and anything you'd added upstream. `--chroma 0` drops the tint for a strictly neutral grey ramp. Run it with no arguments and you get the shipped sheet back verbatim.

| Flag | Default |
| --- | --- |
| `--hue <deg>` | shipped `--neutral-hue`; cyclic, so `-20` and `400` both work |
| `--chroma <c>` | shipped `--neutral-chroma`; `0`–`0.4` |
| `--out <path>` | `./tokens.css` |
| `--force`, `-f` | refuse to overwrite unless passed |
| `--stdout` | write to stdout instead of a file |

Regenerate after upgrading `rn-motion-ui` so new tokens land in your copy.

### Animated and SVG colors — `useThemeColor`

Reanimated worklets and `react-native-svg` props require resolved color strings, not CSS utility classes. Use `useThemeColor` to read the current token value at runtime:

```tsx
import { useThemeColor } from 'rn-motion-ui/theme/use-theme-color';
import { useAnimatedStyle } from 'react-native-reanimated';

function Spinner() {
  const color = useThemeColor('primary');
  const style = useAnimatedStyle(() => ({ borderColor: color }));
  return <Animated.View style={[styles.ring, style]} />;
}
```

On **web** it reads the live CSS custom property (`--color-primary`) so consumer `@theme` overrides are automatically respected. On **native** it uses `useColorScheme()` to select from the static light/dark maps, matching the values in `tokens.css` with no provider required.

Use `useThemeColors()` when you need several tokens at once:

```tsx
import { useThemeColors } from 'rn-motion-ui/theme/use-theme-color';

const { primary, danger, success } = useThemeColors();
```

## Menu motion

Every panel a trigger summons — `AdaptiveDropdown` (on wide screens), `HoverMenu`, `Popover`, `HoldContextMenu` — opens on one shared animation: a fade up from `0.96` scale, sliding 8px toward its trigger, out of the corner nearest it. They close the reverse way on a 200ms ease-in. Sheets are deliberately not in this group; `BottomSheet`, `FullSheet`, `Drawer` and `AdaptiveModal` slide from an edge, which is a different gesture with a different feel.

All four take the same `motion` prop to retune it:

```tsx
import { Popover, PopoverTrigger, PopoverContent } from 'rn-motion-ui/popover';

<Popover motion={{ enter: { type: 'spring', stiffness: 140, damping: 22 }, offset: 16 }}>
  <PopoverTrigger>…</PopoverTrigger>
  <PopoverContent>…</PopoverContent>
</Popover>
```

| Key | Default | |
| --- | --- | --- |
| `enter` | `MOTION_STANDARD` — spring, 300 stiffness / 24 damping / 0.8 mass | merged over the default, so `{ stiffness: 140 }` keeps the rest |
| `exit` | 200ms `Easing.in(Easing.cubic)` | same merge |
| `scale` | `0.96` | `1` opens with no scale |
| `offset` | `8` | px traveled toward the trigger; `0` opens with no slide |

`HoldContextMenu` adds `scrim` and `lift` for the two surfaces only it has — the dim behind the lifted item, and the item's own rise off the page. `lift` falls back to `enter`, so retuning the panel moves the item with it by default.

`useReducedMotion` wins over all of it: whatever `motion` says, an OS reduced-motion preference collapses these to a 150ms opacity fade with no scale and no travel.

The pieces are exported from `rn-motion-ui/theme/motion` if you're building a panel of your own that should match — `resolveMenuMotion({ motion, reduce, side })` returns the whole `from` / `animate` / `exit` / `transition` / `exitTransition` set for a `MotiView`, and `menuTransformOrigin({ side, align })` gives the matching CSS `transform-origin`.

## License

[MIT](./LICENSE) © Ivan Stepanian
