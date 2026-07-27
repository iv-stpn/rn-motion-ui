/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// Applied filters, one segmented pill each: type · operator · value · remove.
// Every segment but the type label opens its own dropdown, so a pill can be
// re-operated or re-valued in place.

import { type ReactNode, useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { cn } from '../../lib/cn';
import { Calendar, FileIcon, X } from '../../lib/icons';
import type { TriggerRenderProps } from '../AdaptiveDropdown/adaptive-dropdown';
import { AdaptiveDropdown } from '../AdaptiveDropdown/adaptive-dropdown';
import { ThemedIcon } from '../Icon/themed-icon';
import { Text } from '../Text/text';
import type {
  FileSystemDateFilterType,
  FileSystemFilter,
  FileSystemFilterOperator,
  FileTypeFilterOption,
} from './file-system.types';
import { FILTER_OPERATOR_LABELS, FILTER_TYPE_LABELS, filterOperatorChoices, isCustomDateRangeValue } from './file-system-filter';
import { DatePresetPanel, FileTypeChecklist, MenuRow } from './file-system-menus';

const CLEAR_ALL_LABEL = 'Clear all';
const RANGE_SEPARATOR = ' – ';

/** Shared segment shell: 20px tall, hairline-joined, no wrapping. */
const PILL_SEGMENT_CLASSNAME = 'h-5 flex-row items-center gap-1 border border-border border-l-0 bg-surface-1 px-1.5';

function formatRangeBounds(value: string[]): string {
  return value.map((entry) => new Date(entry).toLocaleDateString()).join(RANGE_SEPARATOR);
}

type PillSegmentProps = { children: ReactNode; className?: string };

function PillSegment({ children, className }: PillSegmentProps) {
  return <View className={cn(PILL_SEGMENT_CLASSNAME, className)}>{children}</View>;
}

type PillButtonProps = { accessibilityLabel?: string; children: ReactNode; className?: string; onPress: () => void };

/** A pressable segment. Kept flat (no ripple) so the pill reads as one control. */
function PillButton({ accessibilityLabel, children, className, onPress }: PillButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      className={cn(PILL_SEGMENT_CLASSNAME, className)}
    >
      {children}
    </Pressable>
  );
}

type OperatorRowProps = { onSelect: (operator: FileSystemFilterOperator) => void; operator: FileSystemFilterOperator };

function OperatorRow({ onSelect, operator }: OperatorRowProps) {
  const handlePress = useCallback(() => onSelect(operator), [onSelect, operator]);
  return <MenuRow label={FILTER_OPERATOR_LABELS[operator]} onPress={handlePress} />;
}

type OperatorSegmentProps = { filter: FileSystemFilter; onOperatorChange: (operator: FileSystemFilterOperator) => void };

/** The operator segment: switches between the pair its value type allows. */
function OperatorSegment({ filter, onOperatorChange }: OperatorSegmentProps) {
  const renderTrigger = useCallback(
    ({ toggle }: TriggerRenderProps) => (
      <PillButton accessibilityLabel="Change operator" onPress={toggle}>
        <Text size="xs" className="text-primary">
          {FILTER_OPERATOR_LABELS[filter.operator]}
        </Text>
      </PillButton>
    ),
    [filter.operator],
  );

  return (
    <AdaptiveDropdown title="Operator" trigger={renderTrigger} width={160}>
      {filterOperatorChoices(filter).map((operator) => (
        <OperatorRow key={operator} onSelect={onOperatorChange} operator={operator} />
      ))}
    </AdaptiveDropdown>
  );
}

type FileTypeSegmentProps = {
  fileTypeOptions: FileTypeFilterOption[];
  onToggleFileType: (mime: string, checked: boolean) => void;
  value: string[];
};

/** The file-type value segment: the same checklist the filter menu uses. */
function FileTypeSegment({ fileTypeOptions, onToggleFileType, value }: FileTypeSegmentProps) {
  const labels = value.map((mime) => fileTypeOptions.find((option) => option.mime === mime)?.label ?? mime);
  const summary = value.length === 1 ? labels[0] : `${value.length} selected`;

  const renderTrigger = useCallback(
    ({ toggle }: TriggerRenderProps) => (
      <PillButton accessibilityLabel={`File types: ${labels.join(', ')}`} onPress={toggle}>
        <Text numberOfLines={1} size="xs">
          {summary}
        </Text>
      </PillButton>
    ),
    [labels, summary],
  );

  return (
    <AdaptiveDropdown title="File type" trigger={renderTrigger} width={260}>
      <FileTypeChecklist checkedMimes={value} onToggle={onToggleFileType} options={fileTypeOptions} />
    </AdaptiveDropdown>
  );
}

type DatePresetSegmentProps = {
  onOpenCustomRange: () => void;
  onSelectDatePreset: (preset: string) => void;
  value: string;
};

/** The relative-date value segment. Presets replace the value in place. */
function DatePresetSegment({ onOpenCustomRange, onSelectDatePreset, value }: DatePresetSegmentProps) {
  const renderTrigger = useCallback(
    ({ toggle }: TriggerRenderProps) => (
      <PillButton accessibilityLabel={`Date: ${value}`} onPress={toggle}>
        <Text numberOfLines={1} size="xs">
          {value}
        </Text>
      </PillButton>
    ),
    [value],
  );

  return (
    <AdaptiveDropdown title="Date" trigger={renderTrigger} width={220}>
      <DatePresetPanel onOpenCustomRange={onOpenCustomRange} onSelectPreset={onSelectDatePreset} />
    </AdaptiveDropdown>
  );
}

type CustomRangeSegmentProps = { onOpenCustomRange: () => void; value: string[] };

/** A resolved custom range reads as its formatted bounds and reopens the calendar. */
function CustomRangeSegment({ onOpenCustomRange, value }: CustomRangeSegmentProps) {
  const label = formatRangeBounds(value);
  return (
    <PillButton accessibilityLabel={`Date range: ${label}`} onPress={onOpenCustomRange}>
      <Text numberOfLines={1} size="xs">
        {label}
      </Text>
    </PillButton>
  );
}

export type FileSystemFilterPillProps = {
  fileTypeOptions: FileTypeFilterOption[];
  filter: FileSystemFilter;
  onOpenCustomRange: (type: FileSystemDateFilterType) => void;
  onOperatorChange: (id: string, operator: FileSystemFilterOperator) => void;
  onRemove: (id: string) => void;
  onSelectDatePreset: (type: FileSystemDateFilterType, preset: string) => void;
  onToggleFileType: (mime: string, checked: boolean) => void;
};

type ValueSegmentProps = Omit<FileSystemFilterPillProps, 'onOperatorChange' | 'onRemove'> & {
  onOpenCustomRange: () => void;
  onSelectDatePreset: (preset: string) => void;
};

/** Picks the value editor the filter's type calls for. */
function ValueSegment({ fileTypeOptions, filter, onOpenCustomRange, onSelectDatePreset, onToggleFileType }: ValueSegmentProps) {
  if (filter.type === 'fileType')
    return <FileTypeSegment fileTypeOptions={fileTypeOptions} onToggleFileType={onToggleFileType} value={filter.value} />;
  if (isCustomDateRangeValue(filter.value))
    return <CustomRangeSegment onOpenCustomRange={onOpenCustomRange} value={filter.value} />;
  return (
    <DatePresetSegment
      onOpenCustomRange={onOpenCustomRange}
      onSelectDatePreset={onSelectDatePreset}
      value={filter.value[0] ?? ''}
    />
  );
}

/**
 * One applied filter as a segmented pill: type · operator · value · remove.
 * Every segment but the type label is interactive, so a filter can be
 * re-operated or re-valued without going back through the filter menu.
 */
export function FileSystemFilterPill({
  fileTypeOptions,
  filter,
  onOpenCustomRange,
  onOperatorChange,
  onRemove,
  onSelectDatePreset,
  onToggleFileType,
}: FileSystemFilterPillProps) {
  const isFileType = filter.type === 'fileType';
  const TypeIcon = isFileType ? FileIcon : Calendar;
  // The date callbacks are keyed by facet, so a file-type pill never fires them.
  const dateType: FileSystemDateFilterType = filter.type === 'fileType' ? 'dateModified' : filter.type;

  const handleOperatorChange = useCallback(
    (operator: FileSystemFilterOperator) => onOperatorChange(filter.id, operator),
    [filter.id, onOperatorChange],
  );
  const handleOpenCustomRange = useCallback(() => onOpenCustomRange(dateType), [dateType, onOpenCustomRange]);
  const handleSelectDatePreset = useCallback(
    (preset: string) => onSelectDatePreset(dateType, preset),
    [dateType, onSelectDatePreset],
  );
  const handleRemove = useCallback(() => onRemove(filter.id), [filter.id, onRemove]);

  return (
    <View className="flex-row items-center">
      <PillSegment className="rounded-l-md border-l">
        <ThemedIcon icon={TypeIcon} token="primary" size={12} />
        <Text size="xs" className="text-primary">
          {FILTER_TYPE_LABELS[filter.type]}
        </Text>
      </PillSegment>
      <OperatorSegment filter={filter} onOperatorChange={handleOperatorChange} />
      <ValueSegment
        fileTypeOptions={fileTypeOptions}
        filter={filter}
        onOpenCustomRange={handleOpenCustomRange}
        onSelectDatePreset={handleSelectDatePreset}
        onToggleFileType={onToggleFileType}
      />
      <PillButton
        accessibilityLabel={`Remove ${FILTER_TYPE_LABELS[filter.type]} filter`}
        onPress={handleRemove}
        className="rounded-r-md px-1"
      >
        <ThemedIcon icon={X} variant="ghost" size={12} />
      </PillButton>
    </View>
  );
}

export type FileSystemFilterPillsProps = Omit<FileSystemFilterPillProps, 'filter'> & {
  filters: FileSystemFilter[];
  onClearFilters: () => void;
};

/**
 * The applied-filter row under the toolbar. Scrolls horizontally rather than
 * wrapping, so a long filter set never pushes the file area down.
 */
export function FileSystemFilterPills({ filters, onClearFilters, ...pillProps }: FileSystemFilterPillsProps) {
  if (filters.length === 0) return null;

  return (
    <ScrollView
      className="shrink-0 border-border border-b bg-surface-2"
      contentContainerClassName="flex-row items-center gap-1 px-2 py-1.5"
      horizontal={true}
      showsHorizontalScrollIndicator={false}
    >
      {filters.map((filter) => (
        <FileSystemFilterPill filter={filter} key={filter.id} {...pillProps} />
      ))}
      <Pressable accessibilityRole="button" onPress={onClearFilters} className="rounded-md px-1.5 py-0.5">
        <Text size="xs" className="text-muted-foreground">
          {CLEAR_ALL_LABEL}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
