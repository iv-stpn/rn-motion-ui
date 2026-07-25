/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The collapsed view picker. The four-tab switcher needs ~150px, which a narrow
// toolbar can't spare next to back/forward, sort, filter and search — so below
// the tablet width the switcher becomes this icon-only dropdown, the same shape
// the web original's <Select> took.

import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { Check, ChevronDown } from '../../lib/icons';
import { useThemeColors } from '../../theme/use-theme-color';
import type { TriggerRenderProps } from '../AdaptiveDropdown/adaptive-dropdown';
import { AdaptiveDropdown } from '../AdaptiveDropdown/adaptive-dropdown';
import type { FileSystemView } from './file-system.types';
import { MenuRow } from './file-system-menus';
import type { ViewOption } from './file-system-toolbar-parts';
import { VIEW_OPTIONS } from './file-system-toolbar-parts';

const MENU_TITLE = 'View';
const MENU_WIDTH = 180;

type ViewSelectRowProps = { isSelected: boolean; onSelect: (view: FileSystemView) => void; option: ViewOption };

function ViewSelectRow({ isSelected, onSelect, option }: ViewSelectRowProps) {
  const colors = useThemeColors();
  const handlePress = useCallback(() => onSelect(option.value), [onSelect, option.value]);
  const Icon = option.icon;
  return (
    <MenuRow
      isSelected={isSelected}
      label={option.label}
      leading={<Icon color={colors['muted-foreground']} size={16} />}
      onPress={handlePress}
      trailing={isSelected ? <Check color={colors.foreground} size={14} /> : null}
    />
  );
}

type ViewSelectTriggerProps = { option: ViewOption | undefined; toggle: () => void };

function ViewSelectTrigger({ option, toggle }: ViewSelectTriggerProps) {
  const colors = useThemeColors();
  const Icon = option?.icon;
  return (
    <Pressable
      accessibilityLabel={MENU_TITLE}
      accessibilityRole="button"
      onPress={toggle}
      className="h-7 shrink-0 flex-row items-center gap-1 rounded-md border border-border bg-surface-3 px-2"
    >
      {Icon ? <Icon color={colors.foreground} size={16} /> : null}
      <ChevronDown color={colors['muted-foreground']} size={14} />
    </Pressable>
  );
}

export type FileSystemViewSelectProps = { onViewChange: (view: FileSystemView) => void; view: FileSystemView };

/** Icon-only view dropdown, the narrow-toolbar stand-in for the tab switcher. */
export function FileSystemViewSelect({ onViewChange, view }: FileSystemViewSelectProps) {
  const [open, setOpen] = useState(false);
  const activeOption = VIEW_OPTIONS.find((option) => option.value === view);

  const handleSelect = useCallback(
    (nextView: FileSystemView) => {
      onViewChange(nextView);
      setOpen(false);
    },
    [onViewChange],
  );
  const renderTrigger = useCallback(
    ({ toggle }: TriggerRenderProps) => <ViewSelectTrigger option={activeOption} toggle={toggle} />,
    [activeOption],
  );

  return (
    <AdaptiveDropdown onOpenChange={setOpen} open={open} title={MENU_TITLE} trigger={renderTrigger} width={MENU_WIDTH}>
      {VIEW_OPTIONS.map((option) => (
        <ViewSelectRow isSelected={option.value === view} key={option.value} onSelect={handleSelect} option={option} />
      ))}
    </AdaptiveDropdown>
  );
}
