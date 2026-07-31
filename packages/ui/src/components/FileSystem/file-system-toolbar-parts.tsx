/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// Small toolbar primitives shared by the header and the filter pill row: the
// ghost icon button, the icon-only view switcher, and the collapsible search
// field.

import { type ReactNode, useCallback, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { cn } from '../../lib/cn';
import { Columns3, Images, LayoutGrid, Search, Table, X } from '../../lib/icons';
import { useThemeColors } from '../../theme/use-theme-color';
import { ThemedIcon } from '../Icon/themed-icon';
import { Text } from '../Text/text';
import type { FileSystemView } from './file-system.types';
import {
  useFileSystemConsumer,
  useFileSystemEntries,
  useFileSystemLayout,
  useFileSystemSearch,
  useFileSystemSearchActions,
  useFileSystemSelection,
  useFileSystemSelectionActions,
} from './file-system-context';

/** Width band the header lays itself out for. */
export type HeaderLayout = 'full' | 'compact' | 'minimal';

export type ToolbarIconButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** Draws the primary dot marker in the top-right (an active filter/query). */
  marked?: boolean;
  className?: string;
};

/** 28px ghost square used by every toolbar affordance. */
export function ToolbarIconButton({
  accessibilityLabel,
  children,
  className,
  disabled,
  marked,
  onPress,
}: ToolbarIconButtonProps) {
  const [hovered, setHovered] = useState(false);
  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPress={onPress}
      className={cn(
        'relative size-7 shrink-0 items-center justify-center rounded-md',
        hovered && !disabled && 'bg-surface-hover',
        disabled && 'opacity-40',
        className,
      )}
    >
      {children}
      {marked ? <View className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" /> : null}
    </Pressable>
  );
}

export type ViewOption = { icon: typeof LayoutGrid; label: string; value: FileSystemView };

/** The four views, in switcher order. */
// biome-ignore lint/style/useComponentExportOnlyModules: the switcher's option table belongs with the switcher
export const VIEW_OPTIONS: ViewOption[] = [
  { icon: LayoutGrid, label: 'Grid', value: 'icons' },
  { icon: Table, label: 'List', value: 'list' },
  { icon: Columns3, label: 'Columns', value: 'columns' },
  { icon: Images, label: 'Gallery', value: 'gallery' },
];

export type ViewSwitcherProps = { view: FileSystemView; onViewChange: (view: FileSystemView) => void };

type ViewSwitcherTabProps = { isActive: boolean; onViewChange: (view: FileSystemView) => void; option: ViewOption };

function ViewSwitcherTab({ isActive, onViewChange, option }: ViewSwitcherTabProps) {
  const handlePress = useCallback(() => onViewChange(option.value), [onViewChange, option.value]);
  const Icon = option.icon;
  return (
    <Pressable
      accessibilityLabel={`${option.label} view`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      onPress={handlePress}
      className={cn('h-7 items-center justify-center rounded-md px-2.5', isActive && 'bg-surface-5')}
    >
      <ThemedIcon icon={Icon} token={isActive ? 'foreground' : 'muted-foreground'} size={16} />
    </Pressable>
  );
}

/**
 * Icon-only segmented control. Hand-rolled rather than <Tabs> because Tabs
 * wraps its triggers' children in <Text>, which an SVG glyph can't live inside.
 */
export function FileSystemViewSwitcher({ onViewChange, view }: ViewSwitcherProps) {
  return (
    <View accessibilityRole="tablist" className="h-8 flex-row items-center gap-0.5 rounded-lg bg-surface-2 p-0.5">
      {VIEW_OPTIONS.map((option) => (
        <ViewSwitcherTab isActive={option.value === view} key={option.value} onViewChange={onViewChange} option={option} />
      ))}
    </View>
  );
}

export type SearchFieldProps = {
  value: string;
  onValueChange: (value: string) => void;
  /** `full` keeps the field inline; narrower layouts collapse it to a button. */
  layout: HeaderLayout;
  isExpanded: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
  inputRef?: React.RefObject<TextInput | null>;
};

type SearchInputProps = Pick<SearchFieldProps, 'inputRef' | 'onValueChange' | 'value'> & { autoFocus?: boolean };

/** The bare input, shared by the inline and popover presentations. */
function SearchInput({ autoFocus, inputRef, onValueChange, value }: SearchInputProps) {
  const colors = useThemeColors();
  const handleClear = useCallback(() => onValueChange(''), [onValueChange]);
  return (
    <View className="h-7 min-w-0 flex-1 flex-row items-center rounded-lg border border-border bg-surface-3 px-2">
      <ThemedIcon icon={Search} variant="ghost" size={14} />
      <TextInput
        accessibilityLabel="Search files"
        autoFocus={autoFocus}
        onChangeText={onValueChange}
        placeholder="Search"
        placeholderTextColor={colors['muted-foreground']}
        ref={inputRef}
        // `outline-none` only exists on web; RN ignores the class either way.
        className="ml-1.5 h-full min-w-0 flex-1 text-foreground text-sm outline-none"
        value={value}
      />
      {value ? (
        <Pressable
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          onPress={handleClear}
          className="size-5 items-center justify-center rounded-sm"
        >
          <ThemedIcon icon={X} variant="ghost" size={12} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Finder-style toolbar search: inline at the full layout, and a ghost icon
 * button that reveals the field beneath the header at narrower widths (a dot
 * marks the button while a query keeps filtering).
 */
export function FileSystemSearchField({
  inputRef,
  isExpanded,
  layout,
  onExpandedChange,
  onValueChange,
  value,
}: SearchFieldProps) {
  const handleToggle = useCallback(() => onExpandedChange(!isExpanded), [isExpanded, onExpandedChange]);

  if (layout === 'full') {
    // A fixed basis keeps the toolbar cluster packed against the right edge;
    // the input shrinks first when the header tightens.
    return (
      <View className="w-56 min-w-32 flex-row items-center">
        <SearchInput inputRef={inputRef} onValueChange={onValueChange} value={value} />
      </View>
    );
  }

  return (
    <ToolbarIconButton accessibilityLabel="Search" marked={value.length > 0} onPress={handleToggle}>
      <SearchGlyph />
    </ToolbarIconButton>
  );
}

/** Muted search glyph for the collapsed trigger. */
function SearchGlyph() {
  const colors = useThemeColors();
  return <Search color={colors['muted-foreground']} size={16} />;
}

/**
 * The revealed search row under the header at compact widths. Rendered by the
 * component root (not the popover-less trigger) so it participates in layout
 * instead of floating — Finder's own behaviour on a narrow window.
 */
export function FileSystemCollapsedSearchRow() {
  const { isSearchExpanded, searchInput, searchInputRef } = useFileSystemSearch();
  const { layout } = useFileSystemLayout();
  const { setSearchInput } = useFileSystemSearchActions();
  if (layout === 'full' || !isSearchExpanded) return null;
  return (
    <View className="shrink-0 flex-row items-center border-border border-b bg-surface-2 px-2 py-1.5">
      <SearchInput
        autoFocus={Platform.OS === 'web'}
        inputRef={searchInputRef}
        onValueChange={setSearchInput}
        value={searchInput}
      />
    </View>
  );
}

const COUNT_NOUNS = { result: { one: 'result', other: 'results' }, row: { one: 'item', other: 'items' } };
const CLEAR_SELECTION_LABEL = 'Clear selection';
const CLEAR_SELECTION_TEXT = 'Clear';

/**
 * What the status bar says about the selection: the name while it is one entry,
 * a count once it is more. A name per entry would not fit, and the count is what
 * a multi-selection is actually about.
 */
function selectionLabel(selectedCount: number, selectedName: string | undefined): string | null {
  if (selectedCount > 1) return `· ${selectedCount} selected`;
  return selectedName ? `· “${selectedName}” selected` : null;
}

type FileSystemStatusBarProps = { className?: string };

/** Status-bar text: item/result count plus the current selection. */
export function FileSystemStatusBar({ className }: FileSystemStatusBarProps) {
  const { entries } = useFileSystemEntries();
  const { isSearching } = useFileSystemSearch();
  const { selectedEntry, selectedPaths } = useFileSystemSelection();
  const { clearSelection } = useFileSystemSelectionActions();
  const { testID } = useFileSystemConsumer();
  const count = entries.length;
  const selectedCount = selectedPaths.size;
  const footerTestID = testID ? `${testID}-footer` : undefined;
  const nouns = isSearching ? COUNT_NOUNS.result : COUNT_NOUNS.row;
  const noun = count === 1 ? nouns.one : nouns.other;
  const selection = selectionLabel(selectedCount, selectedEntry?.name);
  return (
    <View
      accessibilityLiveRegion="polite"
      className={cn(
        'h-7 shrink-0 flex-row items-center justify-center gap-1 border-border border-t bg-surface-2 px-3',
        className,
      )}
      testID={footerTestID}
    >
      <Text size="xs" className="text-muted-foreground">
        {`${count} ${noun}`}
      </Text>
      {selection ? (
        <Text size="xs" numberOfLines={1} className="text-muted-foreground">
          {selection}
        </Text>
      ) : null}
      {/* The way out of a multi-selection on touch, where there may be no
          background left to tap: the columns and gallery views fill their area,
          so tapping "nothing" is not always available. */}
      {selectedCount > 1 ? (
        <Pressable
          accessibilityLabel={CLEAR_SELECTION_LABEL}
          accessibilityRole="button"
          className="ml-1 rounded-sm px-1 py-0.5"
          onPress={clearSelection}
        >
          <Text size="xs" className="text-muted-foreground underline">
            {CLEAR_SELECTION_TEXT}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
