/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The toolbar's filter menu. Submenus are panels within the same dropdown
// (rather than nested popovers) so the same markup works as a bottom sheet on
// phones.

import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, FileIcon, Funnel } from '../../lib/icons';
import { useThemeColors } from '../../theme/use-theme-color';
import type { TriggerRenderProps } from '../AdaptiveDropdown/adaptive-dropdown';
import { AdaptiveDropdown } from '../AdaptiveDropdown/adaptive-dropdown';
import { Text } from '../Text/text';
import type { FileSystemDateFilterType, FileSystemFilter, FileTypeFilterOption } from './file-system.types';
import { FILTER_TYPE_LABELS } from './file-system-filter';
import { DatePresetPanel, FileTypeChecklist, MenuRow } from './file-system-menus';
import { ToolbarIconButton } from './file-system-toolbar-parts';

const FILE_TYPE_LABEL = 'File type';
const DATE_PANELS: FileSystemDateFilterType[] = ['dateModified', 'dateCreated'];

/** Which panel the filter menu currently shows. */
type FilterMenuPanel = 'root' | 'fileType' | FileSystemDateFilterType;

export type FileSystemFilterMenuProps = {
  fileTypeOptions: FileTypeFilterOption[];
  filters: FileSystemFilter[];
  onOpenCustomRange: (type: FileSystemDateFilterType) => void;
  onSelectDatePreset: (type: FileSystemDateFilterType, preset: string) => void;
  onToggleFileType: (mime: string, checked: boolean) => void;
};

type SubmenuHeaderProps = { onBack: () => void; title: string };

/** Header shown above a submenu panel, with a back affordance to the root. */
function SubmenuHeader({ onBack, title }: SubmenuHeaderProps) {
  const colors = useThemeColors();
  return (
    <View className="mb-1 flex-row items-center gap-1 border-border border-b pb-1">
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        onPress={onBack}
        className="size-7 items-center justify-center rounded-md"
      >
        <ChevronLeft color={colors['muted-foreground']} size={16} />
      </Pressable>
      <Text size="sm" weight="medium">
        {title}
      </Text>
    </View>
  );
}

type DateFacetRowProps = { onOpenPanel: (type: FileSystemDateFilterType) => void; type: FileSystemDateFilterType };

function DateFacetRow({ onOpenPanel, type }: DateFacetRowProps) {
  const colors = useThemeColors();
  const handlePress = useCallback(() => onOpenPanel(type), [onOpenPanel, type]);
  return (
    <MenuRow
      label={FILTER_TYPE_LABELS[type]}
      leading={<Calendar color={colors['muted-foreground']} size={16} />}
      onPress={handlePress}
      trailing={<ChevronRight color={colors['muted-foreground']} size={14} />}
    />
  );
}

type FilterTriggerProps = { isMarked: boolean; toggle: () => void };

function FilterTrigger({ isMarked, toggle }: FilterTriggerProps) {
  const colors = useThemeColors();
  return (
    <ToolbarIconButton
      accessibilityLabel="Filter"
      marked={isMarked}
      onPress={toggle}
      className="border border-border bg-surface-3"
    >
      <Funnel color={colors['muted-foreground']} size={16} />
    </ToolbarIconButton>
  );
}

type FilterRootPanelProps = {
  onOpenDatePanel: (type: FileSystemDateFilterType) => void;
  onOpenFileTypePanel: () => void;
};

function FilterRootPanel({ onOpenDatePanel, onOpenFileTypePanel }: FilterRootPanelProps) {
  const colors = useThemeColors();
  return (
    <View>
      <MenuRow
        label={FILE_TYPE_LABEL}
        leading={<FileIcon color={colors['muted-foreground']} size={16} />}
        onPress={onOpenFileTypePanel}
        trailing={<ChevronRight color={colors['muted-foreground']} size={14} />}
      />
      {DATE_PANELS.map((type) => (
        <DateFacetRow key={type} onOpenPanel={onOpenDatePanel} type={type} />
      ))}
    </View>
  );
}

type FilterDatePanelProps = {
  onBack: () => void;
  onClose: () => void;
  onOpenCustomRange: (type: FileSystemDateFilterType) => void;
  onSelectDatePreset: (type: FileSystemDateFilterType, preset: string) => void;
  type: FileSystemDateFilterType;
};

/** A date facet's panel: presets close the menu, as does opening the range modal. */
function FilterDatePanel({ onBack, onClose, onOpenCustomRange, onSelectDatePreset, type }: FilterDatePanelProps) {
  const handleOpenCustomRange = useCallback(() => {
    onClose();
    onOpenCustomRange(type);
  }, [onClose, onOpenCustomRange, type]);
  const handleSelectPreset = useCallback(
    (preset: string) => {
      onSelectDatePreset(type, preset);
      onClose();
    },
    [onClose, onSelectDatePreset, type],
  );

  return (
    <View>
      <SubmenuHeader onBack={onBack} title={FILTER_TYPE_LABELS[type]} />
      <DatePresetPanel onOpenCustomRange={handleOpenCustomRange} onSelectPreset={handleSelectPreset} />
    </View>
  );
}

type FilterMenuBodyProps = FileSystemFilterMenuProps & {
  onBack: () => void;
  onClose: () => void;
  onOpenDatePanel: (type: FileSystemDateFilterType) => void;
  onOpenFileTypePanel: () => void;
  panel: FilterMenuPanel;
};

function FilterMenuBody({
  fileTypeOptions,
  filters,
  onBack,
  onClose,
  onOpenCustomRange,
  onOpenDatePanel,
  onOpenFileTypePanel,
  onSelectDatePreset,
  onToggleFileType,
  panel,
}: FilterMenuBodyProps) {
  if (panel === 'root') return <FilterRootPanel onOpenDatePanel={onOpenDatePanel} onOpenFileTypePanel={onOpenFileTypePanel} />;

  if (panel === 'fileType') {
    const checkedMimes = filters.find((filter) => filter.type === 'fileType')?.value ?? [];
    return (
      <View>
        <SubmenuHeader onBack={onBack} title={FILE_TYPE_LABEL} />
        <FileTypeChecklist checkedMimes={checkedMimes} onToggle={onToggleFileType} options={fileTypeOptions} />
      </View>
    );
  }

  return (
    <FilterDatePanel
      onBack={onBack}
      onClose={onClose}
      onOpenCustomRange={onOpenCustomRange}
      onSelectDatePreset={onSelectDatePreset}
      type={panel}
    />
  );
}

/**
 * Toolbar filter menu: file types as a searchable checklist, dates as
 * single-select relative presets plus a custom range.
 */
export function FileSystemFilterMenu(props: FileSystemFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<FilterMenuPanel>('root');

  const goToRoot = useCallback(() => setPanel('root'), []);
  const openFileTypePanel = useCallback(() => setPanel('fileType'), []);
  // Closing always rewinds to the root, so the next visit starts at the top.
  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setPanel('root');
  }, []);
  const close = useCallback(() => handleOpenChange(false), [handleOpenChange]);

  const isMarked = props.filters.length > 0;
  const renderTrigger = useCallback(
    ({ toggle }: TriggerRenderProps) => <FilterTrigger isMarked={isMarked} toggle={toggle} />,
    [isMarked],
  );

  return (
    <AdaptiveDropdown align="end" onOpenChange={handleOpenChange} open={open} title="Filter" trigger={renderTrigger} width={260}>
      <FilterMenuBody
        {...props}
        onBack={goToRoot}
        onClose={close}
        onOpenDatePanel={setPanel}
        onOpenFileTypePanel={openFileTypePanel}
        panel={panel}
      />
    </AdaptiveDropdown>
  );
}
