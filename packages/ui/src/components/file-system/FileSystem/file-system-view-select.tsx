/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The collapsed view picker. The four-tab switcher needs ~150px, which a narrow
// toolbar can't spare next to back/forward, sort, filter and search — so below
// the tablet width the switcher becomes this icon-only dropdown, the same shape
// the web original's <Select> took.

import { useCallback, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { CheckLine as Check } from 'rn-motion-ui-icons/icons/check-line';
import { DownLine as ChevronDown } from 'rn-motion-ui-icons/icons/down-line';
import { useThemeColors } from '../../../theme/use-theme-color';
import { AdaptiveDropdown, type TriggerRenderProps } from '../../menus/AdaptiveDropdown/adaptive-dropdown';
import { Menu, type MenuEntry } from '../../menus/Menu/menu';
import type { FileSystemView } from './file-system.types';
import type { ViewOption } from './file-system-toolbar-parts';
import { VIEW_OPTIONS } from './file-system-toolbar-parts';

const MENU_TITLE = 'View';
const MENU_WIDTH = 180;

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
  const colors = useThemeColors();
  const activeOption = VIEW_OPTIONS.find((option) => option.value === view);

  const entries = useMemo<MenuEntry[]>(
    () =>
      VIEW_OPTIONS.map((option) => ({
        id: option.value,
        label: option.label,
        icon: option.icon,
        active: option.value === view,
        onSelect: () => onViewChange(option.value),
        trailing: option.value === view ? <Check color={colors.foreground} size={14} /> : undefined,
      })),
    [view, colors.foreground, onViewChange],
  );

  const renderTrigger = useCallback(
    ({ toggle }: TriggerRenderProps) => <ViewSelectTrigger option={activeOption} toggle={toggle} />,
    [activeOption],
  );

  return (
    <AdaptiveDropdown onOpenChange={setOpen} open={open} title={MENU_TITLE} trigger={renderTrigger} width={MENU_WIDTH}>
      {({ close }) => <Menu entries={entries} onClose={close} />}
    </AdaptiveDropdown>
  );
}
