import type { ReactNode } from 'react';
import { useCallback } from 'react';
import type { GestureResponderHandlers } from 'react-native';
import { Pressable, TextInput, View } from 'react-native';
import { cn } from '../../lib/cn';
import { ChevronUp, GripVertical, Plus, Trash2 } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { useThemeColor } from '../../theme/use-theme-color';
import { Text } from '../Text/text';
import type { SortDirection, TableColumn } from './table-types';
import { alignStyle, alignToJustify } from './table-utils';

export type HeaderCellProps<T> = {
  column: TableColumn<T>;
  colIndex: number;
  colWidth: number;
  containerWidth: number;
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
  containerWidth,
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
  const { textAlign } = alignStyle(column.align);
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
      className="flex-col justify-center px-4 overflow-hidden relative"
      style={{ width: containerWidth > 0 ? colWidth : undefined, flex: containerWidth > 0 ? undefined : 1 }}
      onLongPress={handleLongPress}
      onPress={sortEnabled ? handleSort : undefined}
      accessibilityRole={sortEnabled ? 'button' : undefined}
      accessibilityLabel={sortEnabled ? `Sort by ${column.header}` : undefined}
      testID={`${testID ?? 'table'}-header-${column.key}`}
    >
      {/* Header content lifts (scale + fade) while its column is being dragged. */}
      <MotiView
        className="flex-row items-center flex-1 gap-1"
        animate={reduce ? { opacity: isDragging ? 0.5 : 1 } : { scale: isDragging ? 1.04 : 1, opacity: isDragging ? 0.5 : 1 }}
        transition={{ type: 'timing', duration: reduce ? 0 : 180 }}
      >
        {/* Reorder grip — a PanResponder here claims the drag so it never sorts. */}
        {reorderable ? (
          <View
            {...gripHandlers(column.key)}
            className="justify-center items-center -ml-1 select-none"
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
            className="text-xs font-medium p-0 flex-1 text-muted-foreground"
            style={{ textAlign }}
            accessibilityLabel={`Rename ${column.key} column`}
          />
        ) : (
          <View className="flex-row items-center flex-1 gap-1" style={{ justifyContent: alignToJustify(column.align) }}>
            <Text
              selectable={false}
              className={cn('text-xs font-medium flex-1 text-muted-foreground', isActive && 'text-foreground')}
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

      {/* Column action overlay on long-press */}
      {isColPressed && hasColMenu ? (
        <View className="absolute top-0.5 right-0.5 flex-row gap-0.5 z-10">
          {onInsertColumn ? (
            <Pressable
              className="w-5 h-5 rounded-full items-center justify-center bg-primary"
              onPress={handleInsertColumn}
              hitSlop={8}
            >
              <Plus size={10} color={primaryForeground} />
            </Pressable>
          ) : null}
          {onDeleteColumn ? (
            <Pressable
              className="w-5 h-5 rounded-full items-center justify-center bg-destructive"
              onPress={handleDeleteColumn}
              hitSlop={8}
            >
              <Trash2 size={10} color={primaryForeground} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
