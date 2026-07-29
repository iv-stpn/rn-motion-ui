// The toolbar row: back/forward plus the folder name, the view picker, and the
// sort/filter/search cluster. What collapses is driven by the measured root
// width rather than a media query, so the header adapts inside a narrow
// container as well as on a narrow screen.
//
// Nothing is drilled in: the root pools its state on FileSystemContext and each
// cluster reads the slice it needs, so adding a control here doesn't ripple
// back through the root's JSX.

import { View } from 'react-native';
import { cn } from '../../lib/cn';
import { ArrowLeft, ArrowRight } from '../../lib/icons';
import { ThemedIcon } from '../Icon/themed-icon';
import { Text } from '../Text/text';
import { useFileSystemContext } from './file-system-context';
import { FileSystemFilterMenu } from './file-system-filter-menu';
import { FileSystemSortSelect } from './file-system-menus';
import { FileSystemSearchField, FileSystemViewSwitcher, ToolbarIconButton } from './file-system-toolbar-parts';
import { FileSystemViewSelect } from './file-system-view-select';

const BACK_LABEL = 'Back';
const FORWARD_LABEL = 'Forward';
const NAV_ICON_SIZE = 18;

/** Back/forward pair plus the current folder's name. */
function HeaderNav() {
  const { canGoBack, canGoForward, currentFolderName, goBack, goForward, layout } = useFileSystemContext();
  return (
    <View className="min-w-0 flex-1 flex-row items-center gap-0.5">
      <ToolbarIconButton accessibilityLabel={BACK_LABEL} disabled={!canGoBack} onPress={goBack}>
        <ThemedIcon icon={ArrowLeft} variant="ghost" size={NAV_ICON_SIZE} />
      </ToolbarIconButton>
      <ToolbarIconButton accessibilityLabel={FORWARD_LABEL} disabled={!canGoForward} onPress={goForward}>
        <ThemedIcon icon={ArrowRight} variant="ghost" size={NAV_ICON_SIZE} />
      </ToolbarIconButton>
      {layout === 'minimal' ? null : (
        <Text className="ml-1.5 shrink" numberOfLines={1} size="sm" weight="semibold">
          {currentFolderName}
        </Text>
      )}
    </View>
  );
}

/** The right-hand cluster: sort, filter, search. */
function HeaderTools() {
  const {
    applySortKey,
    fileTypeOptions,
    filters,
    isSearchExpanded,
    layout,
    openDateRangeRequest,
    searchInput,
    searchInputRef,
    setDatePresetFilter,
    setIsSearchExpanded,
    setSearchInput,
    sort,
    toggleFileTypeFilterValue,
  } = useFileSystemContext();
  return (
    <View className="min-w-0 flex-1 flex-row items-center justify-end gap-1">
      <FileSystemSortSelect layout={layout} onKeyChange={applySortKey} showLabel={layout === 'full'} sort={sort} />
      <FileSystemFilterMenu
        fileTypeOptions={fileTypeOptions}
        filters={filters}
        onOpenCustomRange={openDateRangeRequest}
        onSelectDatePreset={setDatePresetFilter}
        onToggleFileType={toggleFileTypeFilterValue}
      />
      <FileSystemSearchField
        inputRef={searchInputRef}
        isExpanded={isSearchExpanded}
        layout={layout}
        onExpandedChange={setIsSearchExpanded}
        onValueChange={setSearchInput}
        value={searchInput}
      />
    </View>
  );
}

export function FileSystemHeader() {
  const { headerClassName, isCompact, setView, testID, view } = useFileSystemContext();
  const headerTestID = testID ? `${testID}-header` : undefined;
  return (
    <View
      className={cn('h-12 shrink-0 flex-row items-center gap-2 border-border border-b bg-surface-2 px-2', headerClassName)}
      testID={headerTestID}
    >
      <HeaderNav />
      {isCompact ? (
        <FileSystemViewSelect onViewChange={setView} view={view} />
      ) : (
        <FileSystemViewSwitcher onViewChange={setView} view={view} />
      )}
      <HeaderTools />
    </View>
  );
}
