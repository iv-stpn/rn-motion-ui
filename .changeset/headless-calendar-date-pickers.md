---
"rn-motion-ui": minor
---

**Headless calendar, date picker and date range picker.** Three hooks that own
the date arithmetic, the keyboard, and the accessibility payload, and render
nothing. There is no styled `<Calendar />` here on purpose: a calendar is mostly
markup decisions — seven cells in a row, or a `FlatList`, or a table — and every
styled one ends up fought with. `FileSystem`'s `applyCustomRange(type, from, to)`
has been waiting for exactly this on the other side of the handoff.

```tsx
import { useCalendar } from 'rn-motion-ui/hooks/use-calendar';

const calendar = useCalendar({ mode: 'range', numberOfMonths: 2, minDate: '2026-01-01' });

<View {...calendar.getRootProps()}>
  {calendar.months.map((month) => (
    <View key={month.month} {...calendar.getMonthProps(month.month)}>
      <Text {...calendar.getMonthLabelProps(month.month)}>{month.label}</Text>
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

Dates are ISO `'YYYY-MM-DD'` strings everywhere — arguments, return values,
callbacks. No `Date` crosses the API, so a value compares with `===`, sorts as a
string, survives JSON, and sits in a dependency array without a stable-reference
dance. The arithmetic underneath runs in UTC, because `+1 day` in local time
lands back on the same date across a DST boundary, and `new Date().toISOString()`
names tomorrow for anyone east of UTC in the evening.

Data arrives decorated. Each cell carries `isSelected`, `isToday`, `isInRange`,
`isRangeStart`, `isRangeEnd`, `isPreview`, `isDisabled`, `outside` and
`isWeekend`, so styling is a lookup rather than a recomputation per render — and
the preview band that follows the pointer while a range's second endpoint is
unchosen is maintained for you.

What the getters carry beyond the obvious:

- **A roving tab stop.** Exactly one cell per calendar has `tabIndex: 0`. Tab
  reaches the grid once and arrows move within it; 42 cells in the tab order is
  not the grid pattern.
- **Keyboard.** Arrows step a day or a week, `Home`/`End` reach the ends of the
  week, `PageUp`/`PageDown` step a month and a year with shift. A step past the
  visible months pages the view, and focus follows onto the destination cell even
  when that cell mounts *after* the step. `isRTL` mirrors the horizontal axis
  only — up is still up. `preventDefault` fires only for keys the grid acts on,
  so Tab still leaves.
- **Disabled days keep their tab stop.** They get `aria-disabled` and
  `accessibilityState` but not `disabled`, because a day you cannot reach cannot
  tell you why it is unavailable. The press handler refuses.
- **Both a11y dialects, always together.** Native `accessibilityRole`/
  `accessibilityState` and web `aria-*`, since react-native-web maps only the
  `aria-` form.

The two pickers add a disclosure, a typeable field per date, and a backdrop:

```tsx
const picker = useDatePicker({ onSelectDate: setValue, testID: 'depart' });

<TextInput {...picker.getFieldProps()} />
<Pressable {...picker.getTriggerProps()}><Text>Pick a date</Text></Pressable>
{picker.isOpen ? (
  <>
    <Pressable {...picker.getDismissProps()} />
    <View {...picker.getPanelProps()}>{/* the calendar, as above */}</View>
  </>
) : null}
```

The field is forgiving where a date field has to be: typing shows a draft without
committing, blur commits, submit commits and closes. Unparseable text snaps back
to the current value instead of silently discarding it, and a complete allowed
date moves the grid as you type so field and calendar never disagree. `format`
takes a `{ parse, format }` pair for a non-ISO field order.

`useDateRangePicker` differs only where a range does: two months by default, two
independent field drafts, and it closes when the range is **complete** rather
than on the first press, which only starts it. A range entered backwards is
reordered rather than rejected, clearing one field leaves a half-open range the
next press completes, and a date typed into the end field is revealed in the
*last* month on screen so the start stays visible beside it.

The trigger is a button with `aria-expanded`, deliberately not a `combobox`: RN
has neither `aria-controls` nor `aria-haspopup`, so a combobox would announce a
popup assistive tech cannot then find. The panel is a `dialog` whose three modal
flags all follow one `modal` option, so an inline calendar never claims to trap
focus that nothing has trapped. A day cell is a button rather than a `gridcell`,
which RN's role union does not have.

Pass `testID` and every child derives one (`depart-day-2026-08-05`,
`depart-grid-2026-08`, `depart-trigger`, `depart-panel`); pass nothing and no
`testID` is emitted anywhere, so a tree stays clean by default.

New subpaths: `hooks/use-calendar`, `hooks/use-date-picker`,
`hooks/use-date-range-picker`, plus the pure modules behind them — `calendar`
(the date core), `calendar-format`, `calendar-props`, `calendar-selection`,
`date-field` and `date-picker-props` — exported so a consumer can type a render
function or reuse the arithmetic without the hooks.
