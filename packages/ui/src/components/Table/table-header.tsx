import { useCallback } from 'react';
import type { GestureResponderHandlers } from 'react-native';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ChevronUp, GripVertical, Plus, Trash2 } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { styles } from './table-styles';
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
}: HeaderCellProps<T>) {
  const { textAlign } = alignStyle(column.align);

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
      style={[styles.headerCell, { width: containerWidth > 0 ? colWidth : undefined, flex: containerWidth > 0 ? undefined : 1 }]}
      onLongPress={handleLongPress}
      onPress={sortEnabled ? handleSort : undefined}
      accessibilityRole={sortEnabled ? 'button' : undefined}
      accessibilityLabel={sortEnabled ? `Sort by ${column.header}` : undefined}
      testID={`${testID ?? 'table'}-header-${column.key}`}
    >
      {/* Header content lifts (scale + fade) while its column is being dragged. */}
      <MotiView
        style={styles.headerInner}
        animate={reduce ? { opacity: isDragging ? 0.5 : 1 } : { scale: isDragging ? 1.04 : 1, opacity: isDragging ? 0.5 : 1 }}
        transition={{ type: 'timing', duration: reduce ? 0 : 180 }}
      >
        {/* Reorder grip — a PanResponder here claims the drag so it never sorts. */}
        {reorderable ? (
          <View
            {...gripHandlers(column.key)}
            style={styles.grip}
            hitSlop={8}
            accessibilityLabel={`Reorder ${column.key} column`}
            testID={`${testID ?? 'table'}-grip-${column.key}`}
          >
            <GripVertical size={14} color="#9ca3af" />
          </View>
        ) : null}

        {onColumnRename && !sortEnabled ? (
          <TextInput
            value={column.header}
            onChangeText={handleRename}
            style={[styles.headerRenameInput, { textAlign }]}
            accessibilityLabel={`Rename ${column.key} column`}
          />
        ) : (
          <View style={[styles.headerLabelRow, { justifyContent: alignToJustify(column.align) }]}>
            <Text
              selectable={false}
              style={[styles.headerText, isActive && styles.headerTextActive, { textAlign }]}
              numberOfLines={1}
            >
              {column.header}
            </Text>
            {sortEnabled ? (
              <MotiView
                animate={{ rotate: isActive && activeDirection === 'desc' ? '180deg' : '0deg', opacity: isActive ? 1 : 0.35 }}
                transition={{ type: 'timing', duration: reduce ? 0 : 180 }}
              >
                <ChevronUp size={12} color={isActive ? '#111' : '#888'} />
              </MotiView>
            ) : null}
          </View>
        )}
      </MotiView>

      {/* Column action overlay on long-press */}
      {isColPressed && hasColMenu ? (
        <View style={styles.colActionBar}>
          {onInsertColumn ? (
            <Pressable style={styles.actionBtn} onPress={handleInsertColumn} hitSlop={8}>
              <Plus size={10} color="#fff" />
            </Pressable>
          ) : null}
          {onDeleteColumn ? (
            <Pressable style={[styles.actionBtn, styles.actionBtnDestructive]} onPress={handleDeleteColumn} hitSlop={8}>
              <Trash2 size={10} color="#fff" />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
