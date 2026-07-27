/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// Custom date range picker: From/To fields, a range calendar (two months side
// by side when there's room), and quick presets. Applied ranges span the start
// of the first day to the end of the last.

import { useCallback, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { cn } from '../../lib/cn';
import { Calendar, ChevronLeft, ChevronRight } from '../../lib/icons';
import { AdaptiveModal } from '../AdaptiveModal/adaptive-modal';
import { Button } from '../Button/button';
import { ThemedIcon } from '../Icon/themed-icon';
import { Input } from '../Input/input';
import { Text } from '../Text/text';
import {
  addMonths,
  calendarDayKey,
  DATE_RANGE_PRESETS,
  type DateRange,
  type DateRangeDraft,
  dateRangePresetRange,
  formatDateInputValue,
  monthLabel,
  monthWeeks,
  nextRangeForDayPress,
  parseDateInputValue,
  startOfMonth,
  WEEKDAY_LABELS,
  wholeDayRange,
} from './file-system-calendar';

/** Below this the calendar shows a single month. */
const TWO_MONTH_MIN_WIDTH = 640;
const CANCEL_LABEL = 'Cancel';
const APPLY_LABEL = 'Apply';
const DATE_INPUT_PLACEHOLDER = 'YYYY-MM-DD';

type DayCellProps = {
  day: Date | null;
  fromKey: number | null;
  onPress: (day: Date) => void;
  toKey: number | null;
  todayKey: number;
};

/**
 * One day button. Endpoints are filled with primary and lose their inner corner
 * radius so a selected range reads as one continuous bar.
 */
function DayCell({ day, fromKey, onPress, toKey, todayKey }: DayCellProps) {
  const [hovered, setHovered] = useState(false);
  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);
  const handlePress = useCallback(() => day && onPress(day), [day, onPress]);
  if (!day) return <View className="h-7 flex-1" />;

  const dayKey = calendarDayKey(day);
  const isFrom = dayKey === fromKey;
  const isTo = dayKey === toKey;
  const isEndpoint = isFrom || isTo;
  const isWithinRange = fromKey !== null && toKey !== null && dayKey > fromKey && dayKey < toKey;
  const spansDays = toKey !== null && fromKey !== toKey;

  return (
    <Pressable
      accessibilityLabel={formatDateInputValue(day)}
      accessibilityRole="button"
      accessibilityState={{ selected: isEndpoint || isWithinRange }}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPress={handlePress}
      className={cn(
        'h-7 flex-1 items-center justify-center rounded-md',
        hovered && !isEndpoint && 'bg-surface-hover',
        isWithinRange && 'rounded-none bg-surface-selected',
        isEndpoint && 'bg-primary',
        isFrom && spansDays && 'rounded-r-none',
        isTo && spansDays && 'rounded-l-none',
      )}
    >
      <Text
        numeric={true}
        size="xs"
        weight={dayKey === todayKey && !isEndpoint ? 'semibold' : 'normal'}
        className={cn(isEndpoint && 'text-primary-foreground', dayKey === todayKey && !isEndpoint && 'text-primary')}
      >
        {day.getDate()}
      </Text>
    </Pressable>
  );
}

type MonthGridProps = {
  fromKey: number | null;
  month: Date;
  onDayPress: (day: Date) => void;
  toKey: number | null;
  todayKey: number;
};

function MonthGrid({ fromKey, month, onDayPress, toKey, todayKey }: MonthGridProps) {
  return (
    <View className="flex-1">
      <Text className="text-center leading-6" size="sm" weight="medium">
        {monthLabel(month)}
      </Text>
      <View className="mt-1 flex-row">
        {WEEKDAY_LABELS.map((weekday) => (
          <Text className="h-6 flex-1 text-center text-muted-foreground leading-6" key={weekday} size="xs">
            {weekday}
          </Text>
        ))}
      </View>
      {monthWeeks(month).map((week) => (
        <View className="flex-row" key={week.key}>
          {week.cells.map((cell) => (
            <DayCell day={cell.day} fromKey={fromKey} key={cell.key} onPress={onDayPress} toKey={toKey} todayKey={todayKey} />
          ))}
        </View>
      ))}
    </View>
  );
}

export type FileSystemRangeCalendarProps = { onSelect: (range: DateRangeDraft) => void; range: DateRangeDraft };

/**
 * Range calendar. Pressing a day sets the start, then the end; pressing before
 * the start swaps the ends, and a press once both are set restarts the range.
 */
export function FileSystemRangeCalendar({ onSelect, range }: FileSystemRangeCalendarProps) {
  const { width } = useWindowDimensions();
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(range.from ?? new Date()));

  const showTwoMonths = width >= TWO_MONTH_MIN_WIDTH;
  const months = showTwoMonths ? [viewMonth, addMonths(viewMonth, 1)] : [viewMonth];
  const fromKey = range.from ? calendarDayKey(range.from) : null;
  const toKey = range.to ? calendarDayKey(range.to) : null;
  const todayKey = calendarDayKey(new Date());

  const handleDayPress = useCallback((day: Date) => onSelect(nextRangeForDayPress(range, day)), [onSelect, range]);
  const showPreviousMonth = useCallback(() => setViewMonth((previous) => addMonths(previous, -1)), []);
  const showNextMonth = useCallback(() => setViewMonth((previous) => addMonths(previous, 1)), []);

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          onPress={showPreviousMonth}
          className="size-6 items-center justify-center rounded-md"
        >
          <ThemedIcon icon={ChevronLeft} variant="ghost" size={16} />
        </Pressable>
        <Pressable
          accessibilityLabel="Next month"
          accessibilityRole="button"
          onPress={showNextMonth}
          className="size-6 items-center justify-center rounded-md"
        >
          <ThemedIcon icon={ChevronRight} variant="ghost" size={16} />
        </Pressable>
      </View>
      <View className="-mt-6 flex-row gap-4">
        {months.map((month) => (
          <MonthGrid
            fromKey={fromKey}
            key={monthLabel(month)}
            month={month}
            onDayPress={handleDayPress}
            toKey={toKey}
            todayKey={todayKey}
          />
        ))}
      </View>
    </View>
  );
}

type PresetButtonProps = { onSelect: (preset: string) => void; preset: string };

function PresetButton({ onSelect, preset }: PresetButtonProps) {
  const handlePress = useCallback(() => onSelect(preset), [onSelect, preset]);
  return (
    <Button onPress={handlePress} size="sm" variant="outline">
      {preset}
    </Button>
  );
}

export type FileSystemDateRangeModalProps = {
  initialRange?: DateRange;
  onApply: (from: Date, to: Date) => void;
  onClose: () => void;
  open: boolean;
  /** Names the filter the range applies to, e.g. "Date modified". */
  title?: string;
};

export function FileSystemDateRangeModal({ initialRange, onApply, onClose, open, title }: FileSystemDateRangeModalProps) {
  const [range, setRange] = useState<DateRangeDraft>(() => initialRange ?? {});
  const [fromInput, setFromInput] = useState(() => formatDateInputValue(initialRange?.from));
  const [toInput, setToInput] = useState(() => formatDateInputValue(initialRange?.to));

  const selectRange = useCallback((next: DateRangeDraft) => {
    setRange(next);
    if (next.from) setFromInput(formatDateInputValue(next.from));
    if (next.to) setToInput(formatDateInputValue(next.to));
  }, []);

  const selectPreset = useCallback((preset: string) => selectRange(dateRangePresetRange(preset)), [selectRange]);

  const handleFromInput = useCallback((value: string) => {
    setFromInput(value);
    const parsed = parseDateInputValue(value);
    if (parsed) setRange((previous) => ({ ...previous, from: parsed }));
  }, []);

  const handleToInput = useCallback((value: string) => {
    setToInput(value);
    const parsed = parseDateInputValue(value);
    if (parsed) setRange((previous) => ({ ...previous, to: parsed }));
  }, []);

  const handleApply = useCallback(() => {
    if (range.from && range.to) {
      const applied = wholeDayRange(range.from, range.to);
      onApply(applied.from, applied.to);
    }
  }, [onApply, range.from, range.to]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onClose();
    },
    [onClose],
  );

  return (
    <AdaptiveModal
      onOpenChange={handleOpenChange}
      open={open}
      showClose={true}
      title={title ? `Custom range · ${title}` : 'Custom date range'}
      widePanelSize={{ maxWidth: '100%', width: 560 }}
    >
      <View className="gap-4">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Input
              accessibilityLabel="From date"
              label="From"
              leftIcon={<ThemedIcon icon={Calendar} variant="ghost" size={14} />}
              onChange={handleFromInput}
              placeholder={DATE_INPUT_PLACEHOLDER}
              size="sm"
              value={fromInput}
            />
          </View>
          <View className="flex-1">
            <Input
              accessibilityLabel="To date"
              label="To"
              leftIcon={<ThemedIcon icon={Calendar} variant="ghost" size={14} />}
              onChange={handleToInput}
              placeholder={DATE_INPUT_PLACEHOLDER}
              size="sm"
              value={toInput}
            />
          </View>
        </View>

        <FileSystemRangeCalendar onSelect={selectRange} range={range} />

        <View className="flex-row flex-wrap gap-2">
          {DATE_RANGE_PRESETS.map((preset) => (
            <PresetButton key={preset} onSelect={selectPreset} preset={preset} />
          ))}
        </View>

        <View className="flex-row justify-end gap-2 border-border border-t pt-3">
          <Button onPress={onClose} size="sm" variant="outline">
            {CANCEL_LABEL}
          </Button>
          <Button disabled={!(range.from && range.to)} onPress={handleApply} size="sm">
            {APPLY_LABEL}
          </Button>
        </View>
      </View>
    </AdaptiveModal>
  );
}
