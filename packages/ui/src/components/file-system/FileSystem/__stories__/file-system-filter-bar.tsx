import { useCallback } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { CloseLine as X } from 'rn-motion-ui-icons/icons/close-line';
import { SearchLine as SearchIcon } from 'rn-motion-ui-icons/icons/search-line';
import { cn } from '../../../../lib/cn';
import { useThemeColors } from '../../../../theme/use-theme-color';
import { Text } from '../../../typography/Text/text';
import { FileSystem } from '../file-system';
import type { FileSystemFilterOperator, FileSystemFiltersState, FileSystemProps } from '../types/file-system.types';

// ─── Headless filters + search ────────────────────────────────────────────────
// renderFilters drives the full search/filter/sort pipeline from any UI the
// consumer provides. This bar wires up a text field for search, pressable chips
// for file-type filtering, and date-preset buttons — all without importing any
// FileSystem-internal component; the slot's state object is the only contract.
//
// Since the component ships no filter UI of its own any more, this bar is also
// what the filter stories below drive. It renders each active filter back as
// `type operator value` text so those stories can assert on the filter state the
// slot reports.

/** The two presets the stories exercise; `selectDatePreset`'s docs list the full set. */
const DATE_PRESETS = ['3 days ago', '1 month ago'];

// A fixed range for the custom-range chip. The component ships no picker, so the
// bar supplies both ends itself; hard-coding them keeps the story deterministic
// where a calendar would not be. Q1 covers part of the manifest, so applying it
// visibly drops the later files rather than matching everything.
const CUSTOM_RANGE_FROM = new Date('2026-01-01T00:00:00.000Z');
const CUSTOM_RANGE_TO = new Date('2026-03-31T23:59:59.999Z');

/** The opposite of each operator, for the readback row's negate affordance. */
const NEGATED_OPERATOR: Record<FileSystemFilterOperator, FileSystemFilterOperator> = {
  after: 'before',
  before: 'after',
  'in-range': 'not-in-range',
  is: 'is-not',
  'is-any-of': 'is-not',
  'is-not': 'is',
  'not-in-range': 'in-range',
};

type ScopeChipsProps = Pick<FileSystemFiltersState, 'folderName' | 'isAtRoot' | 'rootLabel' | 'searchScope' | 'setSearchScope'>;

/**
 * The scope control: `Search:` followed by one chip per scope, the active one
 * filled. At the root the two scopes are the same tree, so only the root chip is
 * offered — `isAtRoot` is what the slot hands over to say so.
 */
function ScopeChips({ folderName, isAtRoot, rootLabel, searchScope, setSearchScope }: ScopeChipsProps) {
  const scopeToRoot = useCallback(() => setSearchScope('root'), [setSearchScope]);
  const scopeToFolder = useCallback(() => setSearchScope('folder'), [setSearchScope]);
  // At the root the folder chip would repeat the root one, so the scope reads as
  // root there whatever it is set to.
  const rootActive = isAtRoot || searchScope === 'root';

  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="text-muted-foreground" size="xs">
        Search:
      </Text>
      <Pressable
        accessibilityLabel={`Search all of ${rootLabel}`}
        accessibilityRole="radio"
        accessibilityState={{ checked: rootActive }}
        aria-checked={rootActive}
        className={cn(
          'hairline rounded-md px-2 py-0.5',
          rootActive ? 'border-primary bg-primary/10' : 'border-border bg-surface-1',
        )}
        onPress={scopeToRoot}
      >
        <Text className={rootActive ? 'text-primary' : undefined} size="xs">
          {rootLabel}
        </Text>
      </Pressable>
      {isAtRoot ? null : (
        <Pressable
          accessibilityLabel={`Search only ${folderName}`}
          accessibilityRole="radio"
          accessibilityState={{ checked: !rootActive }}
          aria-checked={!rootActive}
          className={cn(
            'hairline rounded-md px-2 py-0.5',
            rootActive ? 'border-border bg-surface-1' : 'border-primary bg-primary/10',
          )}
          onPress={scopeToFolder}
        >
          <Text className={rootActive ? undefined : 'text-primary'} size="xs">
            {folderName}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

type FilterBarProps = FileSystemFiltersState & { testID?: string };

function FilterBar({
  applyCustomRange,
  clearFilters,
  count,
  fileTypeOptions,
  filters,
  folderName,
  hasActiveFilters,
  isAtRoot,
  isSearching,
  removeFilter,
  rootLabel,
  searchScope,
  searchValue,
  selectDatePreset,
  setFilterOperator,
  setSearchScope,
  setSearchValue,
  toggleFileType,
}: FilterBarProps) {
  const colors = useThemeColors();
  const checkedMimes = new Set(filters.find((f) => f.type === 'fileType')?.value ?? []);
  const showClear = hasActiveFilters || searchValue.length > 0;

  const resetSearch = useCallback(() => setSearchValue(''), [setSearchValue]);

  const handleClearAll = useCallback(() => {
    clearFilters();
    setSearchValue('');
  }, [clearFilters, setSearchValue]);

  // The component ships no picker any more, so the bar owns the two ends and
  // hands them over. A real bar would raise a calendar here; a fixed range keeps
  // the story deterministic.
  const handleApplyCustomRange = useCallback(
    () => applyCustomRange('dateModified', CUSTOM_RANGE_FROM, CUSTOM_RANGE_TO),
    [applyCustomRange],
  );

  return (
    <View className="hairline-b flex-row flex-wrap items-center gap-2 border-border bg-surface-2 px-3 py-2">
      {/* Search field */}
      <View className="hairline min-w-[140px] flex-1 flex-row items-center gap-1.5 rounded-md border-border bg-surface-1 px-2.5 py-1.5">
        <SearchIcon color={colors['muted-foreground']} size={13} />
        <TextInput
          accessibilityLabel="Search files"
          onChangeText={setSearchValue}
          placeholder="Search…"
          placeholderTextColor={colors['muted-foreground']}
          // @ts-expect-error outline is web-only
          style={{ color: colors.foreground, flex: 1, fontSize: 13, outline: 'none' }}
          value={searchValue}
        />
        {searchValue.length > 0 && (
          <Pressable accessibilityLabel="Clear search" onPress={resetSearch}>
            <X color={colors['muted-foreground']} size={13} />
          </Pressable>
        )}
      </View>

      {/* File-type chips — one per MIME group in the manifest */}
      {fileTypeOptions.map((option) => {
        const active = checkedMimes.has(option.mime);
        const toggleType = () => toggleFileType(option.mime, !active);

        return (
          <Pressable
            accessibilityLabel={`Filter by ${option.label}`}
            accessibilityRole="checkbox"
            // `aria-checked` as well as `accessibilityState`: react-native-web
            // only reads the aria form, native only the other. Same pairing as
            // Radio and Checkbox.
            accessibilityState={{ checked: active }}
            aria-checked={active}
            className={cn(
              'hairline rounded-md px-2.5 py-1',
              active ? 'border-primary bg-primary/10' : 'border-border bg-surface-1',
            )}
            key={option.mime}
            onPress={toggleType}
          >
            <Text className={active ? 'text-primary' : undefined} size="xs">
              {option.label}
            </Text>
          </Pressable>
        );
      })}

      {/* Date presets + the custom-range modal, driven by the same slot state */}
      {DATE_PRESETS.map((preset) => (
        <Pressable
          accessibilityLabel={`Modified after ${preset}`}
          accessibilityRole="button"
          className="hairline rounded-md border-border bg-surface-1 px-2.5 py-1"
          key={preset}
          onPress={() => selectDatePreset('dateModified', preset)}
        >
          <Text size="xs">{preset}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityLabel="Modified in Q1 2026"
        accessibilityRole="button"
        className="hairline rounded-md border-border bg-surface-1 px-2.5 py-1"
        onPress={handleApplyCustomRange}
      >
        <Text size="xs">Q1 2026</Text>
      </Pressable>

      {/* Clear-all + result count */}
      {showClear ? (
        <Pressable accessibilityRole="button" onPress={handleClearAll}>
          <Text className="text-muted-foreground" size="xs">
            Clear
          </Text>
        </Pressable>
      ) : null}
      {/* Scope control, then the count. Both sit on the same line: the count is
          what the scope changes, so reading one right after the other is how you
          tell a widened search from a narrowed one. */}
      <ScopeChips
        folderName={folderName}
        isAtRoot={isAtRoot}
        rootLabel={rootLabel}
        searchScope={searchScope}
        setSearchScope={setSearchScope}
      />
      {/* "Showing …" rather than the bare count the built-in status bar renders,
          so a story asserting on one of them is never ambiguous. */}
      <Text className="ml-auto text-muted-foreground" size="xs">
        {`Showing ${count} ${isSearching ? 'result' : 'item'}${count === 1 ? '' : 's'}`}
      </Text>

      {/* Each active filter read back as `type operator value`, with the two
          row-addressed actions beside it. Both take the filter's `id`, so they
          reach one row without disturbing the others. */}
      {filters.map((filter) => (
        <View className="flex-row items-center gap-1" key={filter.id}>
          <Text className="text-muted-foreground" size="xs">
            {`${filter.type} ${filter.operator} ${filter.value.join(', ')}`}
          </Text>
          <Pressable
            accessibilityLabel={`Negate ${filter.type} filter`}
            accessibilityRole="button"
            onPress={() => setFilterOperator(filter.id, NEGATED_OPERATOR[filter.operator])}
          >
            <Text className="text-muted-foreground" size="xs">
              ¬
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`Remove ${filter.type} filter`}
            accessibilityRole="button"
            onPress={() => removeFilter(filter.id)}
          >
            <X color={colors['muted-foreground']} size={11} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/** Renders the slot's state through the story `FilterBar`. */
function renderFilterBar(state: FileSystemFiltersState & { testID?: string }) {
  return <FilterBar {...state} />;
}

/**
 * Shared `render` for every story that needs filter or search controls. Hoisted
 * out of the story objects so the slot callback is a stable reference.
 */
function renderWithFilterBar(args: FileSystemProps) {
  return <FileSystem {...args} renderFilters={renderFilterBar} />;
}

export { FilterBar, renderWithFilterBar };
