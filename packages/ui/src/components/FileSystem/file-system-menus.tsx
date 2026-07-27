/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The toolbar's sort select, plus the shared menu row and file-type checklist
// the filter menu is built from. Both menus use AdaptiveDropdown, so they become
// bottom sheets under the md breakpoint.

import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { cn } from '../../lib/cn';
import { ArrowDownUp, Check } from '../../lib/icons';
import { useThemeColors } from '../../theme/use-theme-color';
import type { TriggerRenderProps } from '../AdaptiveDropdown/adaptive-dropdown';
import { AdaptiveDropdown } from '../AdaptiveDropdown/adaptive-dropdown';
import { ThemedIcon } from '../Icon/themed-icon';
import { Text } from '../Text/text';
import type { FileSystemSortKey, FileSystemSortState, FileTypeFilterOption } from './file-system.types';
import { DATE_FILTER_PRESETS, FILE_TYPE_FILTER_GROUPS } from './file-system-filter';
import { FileTypeIcon } from './file-system-icons';
import type { FileSystemSortOption } from './file-system-sort';
import { SORT_OPTIONS } from './file-system-sort';
import type { HeaderLayout } from './file-system-toolbar-parts';

const NO_FILE_TYPES_LABEL = 'No file types found.';
const CUSTOM_RANGE_LABEL = 'Custom date range…';

export type MenuRowProps = {
  label: string;
  onPress: () => void;
  /** Leading node (an icon or the selected checkmark slot). */
  leading?: ReactNode;
  /** Trailing node (a submenu chevron). */
  trailing?: ReactNode;
  isSelected?: boolean;
};

/** One dropdown row: hover/press highlight, optional leading and trailing slots. */
export function MenuRow({ isSelected, label, leading, onPress, trailing }: MenuRowProps) {
  const [hovered, setHovered] = useState(false);
  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected: isSelected }}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPress={onPress}
      className={cn('h-9 flex-row items-center gap-2 rounded-md px-2', hovered && 'bg-surface-hover')}
    >
      {leading}
      <Text size="sm" className="flex-1">
        {label}
      </Text>
      {trailing}
    </Pressable>
  );
}

type CheckSlotProps = { isChecked: boolean };

/** Fixed-width checkmark slot, so labels line up whether or not they're checked. */
function CheckSlot({ isChecked }: CheckSlotProps) {
  return <View className="w-4 items-center">{isChecked ? <ThemedIcon icon={Check} variant="secondary" size={14} /> : null}</View>;
}

export type FileSystemSortSelectProps = {
  layout: HeaderLayout;
  onKeyChange: (key: FileSystemSortKey) => void;
  showLabel: boolean;
  sort: FileSystemSortState;
};

type SortMenuRowProps = { isSelected: boolean; onSelect: (key: FileSystemSortKey) => void; option: FileSystemSortOption };

function SortMenuRow({ isSelected, onSelect, option }: SortMenuRowProps) {
  const handlePress = useCallback(() => onSelect(option.key), [onSelect, option.key]);
  return (
    <MenuRow isSelected={isSelected} label={option.label} leading={<CheckSlot isChecked={isSelected} />} onPress={handlePress} />
  );
}

type SortTriggerProps = { label: string | null; toggle: () => void };

function SortTrigger({ label, toggle }: SortTriggerProps) {
  return (
    <Pressable
      accessibilityLabel="Sort by"
      accessibilityRole="button"
      onPress={toggle}
      className="h-7 shrink-0 flex-row items-center gap-1.5 rounded-md border border-border bg-surface-3 px-2"
    >
      <ThemedIcon icon={ArrowDownUp} variant="ghost" size={16} />
      {label ? (
        <Text size="sm" className="text-foreground">
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Toolbar "sort by" trigger. The full layout shows the active key's short label;
 * narrower widths collapse to the sort glyph alone.
 */
export function FileSystemSortSelect({ layout, onKeyChange, showLabel, sort }: FileSystemSortSelectProps) {
  const [open, setOpen] = useState(false);
  const activeOption = SORT_OPTIONS.find((option) => option.key === sort.key);
  const withLabel = layout === 'full' && showLabel;
  const triggerLabel = withLabel ? (activeOption?.triggerLabel ?? null) : null;

  const handleSelect = useCallback(
    (key: FileSystemSortKey) => {
      onKeyChange(key);
      setOpen(false);
    },
    [onKeyChange],
  );
  const renderTrigger = useCallback(
    ({ toggle }: TriggerRenderProps) => <SortTrigger label={triggerLabel} toggle={toggle} />,
    [triggerLabel],
  );

  return (
    <AdaptiveDropdown align="end" onOpenChange={setOpen} open={open} title="Sort by" trigger={renderTrigger} width={200}>
      {SORT_OPTIONS.map((option) => (
        <SortMenuRow isSelected={option.key === sort.key} key={option.key} onSelect={handleSelect} option={option} />
      ))}
    </AdaptiveDropdown>
  );
}

type DatePresetRowProps = { onSelectPreset: (preset: string) => void; preset: string };

function DatePresetRow({ onSelectPreset, preset }: DatePresetRowProps) {
  const handlePress = useCallback(() => onSelectPreset(preset), [onSelectPreset, preset]);
  return <MenuRow label={preset} onPress={handlePress} />;
}

export type DatePresetPanelProps = { onOpenCustomRange: () => void; onSelectPreset: (preset: string) => void };

/** The relative-preset list plus the custom-range escape hatch. */
export function DatePresetPanel({ onOpenCustomRange, onSelectPreset }: DatePresetPanelProps) {
  return (
    <ScrollView className="max-h-72" showsVerticalScrollIndicator={false}>
      {DATE_FILTER_PRESETS.map((preset) => (
        <DatePresetRow key={preset} onSelectPreset={onSelectPreset} preset={preset} />
      ))}
      <MenuRow label={CUSTOM_RANGE_LABEL} onPress={onOpenCustomRange} />
    </ScrollView>
  );
}

export type FileTypeChecklistProps = {
  checkedMimes: string[];
  onToggle: (mime: string, checked: boolean) => void;
  options: FileTypeFilterOption[];
};

type FileTypeRowProps = { isChecked: boolean; onToggle: (mime: string, checked: boolean) => void; option: FileTypeFilterOption };

function FileTypeRow({ isChecked, onToggle, option }: FileTypeRowProps) {
  const handlePress = useCallback(() => onToggle(option.mime, !isChecked), [isChecked, onToggle, option.mime]);
  return (
    <MenuRow
      isSelected={isChecked}
      label={option.label}
      leading={
        <View className="flex-row items-center gap-2">
          <CheckSlot isChecked={isChecked} />
          <FileTypeIcon fileName={option.iconFileName} size={16} />
        </View>
      }
      onPress={handlePress}
    />
  );
}

/**
 * The file-type checklist: a filterable list grouped by coarse type. Toggling
 * keeps the panel open so several types can be picked in one visit.
 */
export function FileTypeChecklist({ checkedMimes, onToggle, options }: FileTypeChecklistProps) {
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const groups = useMemo(() => {
    const matching = normalizedQuery
      ? options.filter(
          (option) => option.label.toLowerCase().includes(normalizedQuery) || option.mime.toLowerCase().includes(normalizedQuery),
        )
      : options;
    return FILE_TYPE_FILTER_GROUPS.map((group) => ({
      group,
      groupOptions: matching.filter((option) => option.group === group),
    })).filter((entry) => entry.groupOptions.length > 0);
  }, [normalizedQuery, options]);

  return (
    <View className="min-h-0 flex-1">
      <View className="mb-1 border-border border-b pb-1">
        <TextInput
          accessibilityLabel="Search file types"
          onChangeText={setQuery}
          placeholder="Search file types…"
          placeholderTextColor={colors['muted-foreground']}
          className="h-9 px-2 text-foreground text-sm outline-none"
          value={query}
        />
      </View>
      {groups.length === 0 ? (
        <Text size="sm" className="px-2 py-3 text-muted-foreground">
          {NO_FILE_TYPES_LABEL}
        </Text>
      ) : (
        <ScrollView className="max-h-64" showsVerticalScrollIndicator={false}>
          {groups.map(({ group, groupOptions }) => (
            <View key={group}>
              <Text size="xs" weight="medium" className="px-2 pt-2 pb-0.5 text-muted-foreground">
                {group}
              </Text>
              {groupOptions.map((option) => (
                <FileTypeRow
                  isChecked={checkedMimes.includes(option.mime)}
                  key={option.mime}
                  onToggle={onToggle}
                  option={option}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
