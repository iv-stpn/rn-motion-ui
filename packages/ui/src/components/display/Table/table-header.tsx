import type { ReactNode } from 'react';
import { useCallback } from 'react';
import type { GestureResponderHandlers } from 'react-native';
import { Pressable, TextInput, View } from 'react-native';
import { AddLine as Plus } from 'rn-motion-ui-icons/icons/add-line';
import { Delete2Line as Trash2 } from 'rn-motion-ui-icons/icons/delete-2-line';
import { DotsVerticalLine as GripVertical } from 'rn-motion-ui-icons/icons/dots-vertical-line';
import { UpLine as ChevronUp } from 'rn-motion-ui-icons/icons/up-line';
import { useIsRTL } from '../../../hooks/use-direction';
import { cn } from '../../../lib/cn';
import { MotiView } from '../../../moti/components/view';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Text } from '../../typography/Text/text';
import type { SortDirection, TableColumn } from './table-types';
import { alignStyle, alignToJustify, columnLayoutStyle } from './table-utils';

export type HeaderCellProps<T> = {
  column: TableColumn<T>;
  colIndex: number;
  /** Resolved pixel width for this column (from `computeColumnWidths`). */
  colWidth?: number;
  isActive: boolean;
  activeDirection: SortDirection | undefined;
  isColPressed: boolean;
  isDragging: boolean;
  reorderable: boolean;
  hasColMenu: boolean;
  reduce: boolean;
  /**
   * Effective sortability for this column — `table-level sortable && column.sortable`.
   * When false the header renders as non-interactive even if `column.sortable` is true.
   */
  sortEnabled: boolean;
  gripHandlers: (key: string) => GestureResponderHandlers;
  toggleSort: (key: string) => void;
  setPressedColKey: (key: string | null) => void;
  onColumnRename?: (key: string, value: string) => void;
  onInsertColumn?: (index: number, position: 'before' | 'after') => void;
  onDeleteColumn?: (key: string) => void;
  testID?: string;
  /** Replace the sort-direction chevron. Default: `<ChevronUp size={12} color={...} />`. */
  sortIcon?: ReactNode;
};

// One column header. Sort/menu/rename callbacks are stable useCallbacks bound to
// this column so the header JSX never binds inline arrows.
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sort direction, column menu, inline-rename, and drag-resize compose many branches
export function HeaderCell<T>({
  column,
  colIndex,
  colWidth,
  isActive,
  activeDirection,
  isColPressed,
  isDragging,
  reorderable,
  hasColMenu,
  reduce,
  sortEnabled,
  gripHandlers,
  toggleSort,
  setPressedColKey,
  onColumnRename,
  onInsertColumn,
  onDeleteColumn,
  testID,
  sortIcon,
}: HeaderCellProps<T>) {
  const isRTL = useIsRTL();
  const { textAlign } = alignStyle(column.align, isRTL);
  const mutedForeground = useThemeColor('muted-foreground');
  const foregroundForeground = useThemeColor('foreground');
  const primaryForeground = useThemeColor('primary-foreground');

  const handleLongPress = useCallback(() => {
    if (hasColMenu) setPressedColKey(isColPressed ? null : column.key);
  }, [hasColMenu, isColPressed, column.key, setPressedColKey]);
  const handleSort = useCallback(() => toggleSort(column.key), [toggleSort, column.key]);
  const handleRename = useCallback((v: string) => onColumnRename?.(column.key, v), [onColumnRename, column.key]);
  const handleInsertColumn = useCallback(() => {
    onInsertColumn?.(colIndex, 'before');
    setPressedColKey(null);
  }, [onInsertColumn, colIndex, setPressedColKey]);
  const handleDeleteColumn = useCallback(() => {
    onDeleteColumn?.(column.key);
    setPressedColKey(null);
  }, [onDeleteColumn, column.key, setPressedColKey]);

  return (
    <Pressable
      key={column.key}
      className="relative flex-col justify-center overflow-hidden px-4"
      style={columnLayoutStyle(column.width, colWidth)}
      onLongPress={handleLongPress}
      onPress={sortEnabled ? handleSort : undefined}
      accessibilityRole={sortEnabled ? 'button' : undefined}
      accessibilityLabel={sortEnabled ? `Sort by ${column.header}` : undefined}
      testID={`${testID ?? 'table'}-header-${column.key}`}
    >
      {/* Header content lifts (scale + fade) while its column is being dragged. */}
      <MotiView
        className="flex-1 flex-row items-center gap-1"
        animate={reduce ? { opacity: isDragging ? 0.5 : 1 } : { scale: isDragging ? 1.04 : 1, opacity: isDragging ? 0.5 : 1 }}
        transition={{ type: 'timing', duration: reduce ? 0 : 180 }}
      >
        {/* Reorder grip — a PanResponder here claims the drag so it never sorts. */}
        {reorderable ? (
          <View
            {...gripHandlers(column.key)}
            // Negative margin pulls the grip into the cell padding on the side it
            // sits, which the row direction decides — so it mirrors with the row.
            className={cn('select-none items-center justify-center', isRTL ? '-mr-1' : '-ml-1')}
            hitSlop={8}
            accessibilityLabel={`Reorder ${column.key} column`}
            testID={`${testID ?? 'table'}-grip-${column.key}`}
          >
            <GripVertical size={14} color={mutedForeground} />
          </View>
        ) : null}

        {onColumnRename && !sortEnabled ? (
          <TextInput
            value={column.header}
            onChangeText={handleRename}
            className="flex-1 p-0 font-medium text-muted-foreground text-xs"
            style={{ textAlign }}
            accessibilityLabel={`Rename ${column.key} column`}
          />
        ) : (
          <View className="flex-1 flex-row items-center gap-1" style={{ justifyContent: alignToJustify(column.align) }}>
            <Text
              selectable={false}
              className={cn('flex-1 font-medium text-muted-foreground text-xs', isActive && 'text-foreground')}
              style={{ textAlign }}
              numberOfLines={1}
            >
              {column.header}
            </Text>
            {sortEnabled ? (
              <MotiView
                animate={{ rotate: isActive && activeDirection === 'desc' ? '180deg' : '0deg', opacity: isActive ? 1 : 0.35 }}
                transition={{ type: 'timing', duration: reduce ? 0 : 180 }}
              >
                {sortIcon ?? <ChevronUp size={12} color={isActive ? foregroundForeground : mutedForeground} />}
              </MotiView>
            ) : null}
          </View>
        )}
      </MotiView>

      {/* Column action overlay on long-press, pinned to the trailing edge — the
          left one under RTL, since `right` stays physical in both directions. */}
      {isColPressed && hasColMenu ? (
        <View className={cn('absolute top-0.5 z-10 flex-row gap-0.5', isRTL ? 'left-0.5' : 'right-0.5')}>
          {onInsertColumn ? (
            <Pressable
              className="h-5 w-5 items-center justify-center rounded-full bg-primary"
              onPress={handleInsertColumn}
              hitSlop={8}
              accessibilityLabel={`Insert column before ${column.header}`}
            >
              <Plus size={10} color={primaryForeground} />
            </Pressable>
          ) : null}
          {onDeleteColumn ? (
            <Pressable
              className="h-5 w-5 items-center justify-center rounded-full bg-danger"
              onPress={handleDeleteColumn}
              hitSlop={8}
              accessibilityLabel={`Delete column ${column.header}`}
            >
              <Trash2 size={10} color={primaryForeground} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
