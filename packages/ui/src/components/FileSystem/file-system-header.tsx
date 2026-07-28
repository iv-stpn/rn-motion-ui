/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The toolbar row: back/forward plus the folder name, the view picker, and the
// sort/filter/search cluster. What collapses is driven by the measured root
// width rather than a media query, so the header adapts inside a narrow
// container as well as on a narrow screen.

import type { RefObject } from 'react';
import type { TextInput } from 'react-native';
import { View } from 'react-native';
import { cn } from '../../lib/cn';
import { ArrowLeft, ArrowRight } from '../../lib/icons';
import { ThemedIcon } from '../Icon/themed-icon';
import { Text } from '../Text/text';
import type {
  FileSystemDateFilterType,
  FileSystemFilter,
  FileSystemSortKey,
  FileSystemSortState,
  FileSystemView,
  FileTypeFilterOption,
} from './file-system.types';
import { FileSystemFilterMenu } from './file-system-filter-menu';
import { FileSystemSortSelect } from './file-system-menus';
import type { HeaderLayout } from './file-system-toolbar-parts';
import { FileSystemSearchField, FileSystemViewSwitcher, ToolbarIconButton } from './file-system-toolbar-parts';
import { FileSystemViewSelect } from './file-system-view-select';

const BACK_LABEL = 'Back';
const FORWARD_LABEL = 'Forward';
const NAV_ICON_SIZE = 18;

export type FileSystemHeaderProps = {
  canGoBack: boolean;
  canGoForward: boolean;
  fileTypeOptions: FileTypeFilterOption[];
  filters: FileSystemFilter[];
  folderName: string;
  /** Below the tablet width the tab switcher gives way to the view dropdown. */
  isCompact: boolean;
  isSearchExpanded: boolean;
  layout: HeaderLayout;
  onGoBack: () => void;
  onGoForward: () => void;
  onOpenCustomRange: (type: FileSystemDateFilterType) => void;
  onSearchChange: (value: string) => void;
  onSearchExpandedChange: (isExpanded: boolean) => void;
  onSelectDatePreset: (type: FileSystemDateFilterType, preset: string) => void;
  onSortKeyChange: (key: FileSystemSortKey) => void;
  onToggleFileType: (mime: string, checked: boolean) => void;
  onViewChange: (view: FileSystemView) => void;
  searchInputRef?: RefObject<TextInput | null>;
  searchValue: string;
  sort: FileSystemSortState;
  view: FileSystemView;
  /** Extra NativeWind classes merged onto the header's root view. */
  className?: string;
  testID?: string;
};

type NavProps = Pick<FileSystemHeaderProps, 'canGoBack' | 'canGoForward' | 'folderName' | 'layout' | 'onGoBack' | 'onGoForward'>;

/** Back/forward pair plus the current folder's name. */
function HeaderNav({ canGoBack, canGoForward, folderName, layout, onGoBack, onGoForward }: NavProps) {
  return (
    <View className="min-w-0 flex-1 flex-row items-center gap-0.5">
      <ToolbarIconButton accessibilityLabel={BACK_LABEL} disabled={!canGoBack} onPress={onGoBack}>
        <ThemedIcon icon={ArrowLeft} variant="ghost" size={NAV_ICON_SIZE} />
      </ToolbarIconButton>
      <ToolbarIconButton accessibilityLabel={FORWARD_LABEL} disabled={!canGoForward} onPress={onGoForward}>
        <ThemedIcon icon={ArrowRight} variant="ghost" size={NAV_ICON_SIZE} />
      </ToolbarIconButton>
      {layout === 'minimal' ? null : (
        <Text className="ml-1.5 shrink" numberOfLines={1} size="sm" weight="semibold">
          {folderName}
        </Text>
      )}
    </View>
  );
}

type NavOnlyKeys = Exclude<keyof NavProps, 'layout'>;

type ToolsProps = Omit<FileSystemHeaderProps, NavOnlyKeys | 'isCompact' | 'view' | 'onViewChange'>;

/** The right-hand cluster: sort, filter, search. */
function HeaderTools({
  fileTypeOptions,
  filters,
  isSearchExpanded,
  layout,
  onOpenCustomRange,
  onSearchChange,
  onSearchExpandedChange,
  onSelectDatePreset,
  onSortKeyChange,
  onToggleFileType,
  searchInputRef,
  searchValue,
  sort,
}: ToolsProps) {
  return (
    <View className="min-w-0 flex-1 flex-row items-center justify-end gap-1">
      <FileSystemSortSelect layout={layout} onKeyChange={onSortKeyChange} showLabel={layout === 'full'} sort={sort} />
      <FileSystemFilterMenu
        fileTypeOptions={fileTypeOptions}
        filters={filters}
        onOpenCustomRange={onOpenCustomRange}
        onSelectDatePreset={onSelectDatePreset}
        onToggleFileType={onToggleFileType}
      />
      <FileSystemSearchField
        inputRef={searchInputRef}
        isExpanded={isSearchExpanded}
        layout={layout}
        onExpandedChange={onSearchExpandedChange}
        onValueChange={onSearchChange}
        value={searchValue}
      />
    </View>
  );
}

export function FileSystemHeader({ className, isCompact, onViewChange, view, testID, ...props }: FileSystemHeaderProps) {
  const { canGoBack, canGoForward, folderName, layout, onGoBack, onGoForward, ...toolProps } = props;
  return (
    <View
      className={cn('h-12 shrink-0 flex-row items-center gap-2 border-border border-b bg-surface-2 px-2', className)}
      testID={testID}
    >
      <HeaderNav
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        folderName={folderName}
        layout={layout}
        onGoBack={onGoBack}
        onGoForward={onGoForward}
      />
      {isCompact ? (
        <FileSystemViewSelect onViewChange={onViewChange} view={view} />
      ) : (
        <FileSystemViewSwitcher onViewChange={onViewChange} view={view} />
      )}
      <HeaderTools layout={layout} {...toolProps} />
    </View>
  );
}
