import { useCallback, useMemo } from 'react';
import type { ListRenderItemInfo } from 'react-native';
import { FlatList, Text, View } from 'react-native';
import { Checkbox } from '../Checkbox/checkbox';
import { HeaderCell } from './table-header';
import { SkeletonCellPulse, TableRow } from './table-row';
import { styles } from './table-styles';
import type { RowEntry, TableProps } from './table-types';
import { CHECKBOX_COL_WIDTH } from './table-types';
import { useTable } from './use-table';

export type { SortDirection, SortState, TableColumn, TableProps } from './table-types';

/** biome-ignore lint/complexity/noExcessiveLinesPerFunction: the table has too many props and features to be simplified more */
export function Table<T>(props: TableProps<T>) {
  const {
    containerRef,
    containerWidth,
    onContainerLayout,
    colWidths,
    orderedColumns,
    boundaries,
    dragKey,
    dropIndex,
    gripHandlers,
    activeSort,
    toggleSort,
    sortedRows,
    selected,
    allSelected,
    someSelected,
    toggleAll,
    toggleRow,
    pressedRowId,
    setPressedRowId,
    pressedColKey,
    setPressedColKey,
    hasRowMenu,
    hasColMenu,
    reduce,
    keyExtractor,
    getItemLayout,
    loading,
    skeletonRows,
    emptyState,
    onEndReached,
    onEndReachedThreshold,
    flatListHeight,
    rowHeight,
    selectable,
    onCellEdit,
    onInsertRow,
    onDeleteRow,
  } = useTable(props);

  const { reorderable = false, height = 440, onColumnRename, onInsertColumn, onDeleteColumn, style, testID } = props;

  // ── Render callbacks ───────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<RowEntry<T>>) => (
      <TableRow
        row={item.row}
        id={item.id}
        index={index}
        isSelected={selected.has(item.id)}
        isRowPressed={pressedRowId === item.id}
        selectable={selectable}
        orderedColumns={orderedColumns}
        colWidths={colWidths}
        containerWidth={containerWidth}
        rowHeight={rowHeight}
        reduce={reduce}
        hasRowMenu={hasRowMenu}
        setPressedRowId={setPressedRowId}
        toggleRow={toggleRow}
        onCellEdit={onCellEdit}
        onInsertRow={onInsertRow}
        onDeleteRow={onDeleteRow}
        testID={testID}
      />
    ),
    [
      orderedColumns,
      colWidths,
      containerWidth,
      selectable,
      selected,
      toggleRow,
      pressedRowId,
      hasRowMenu,
      onInsertRow,
      onDeleteRow,
      onCellEdit,
      rowHeight,
      reduce,
      setPressedRowId,
      testID,
    ],
  );

  const renderSkeletonRows = useCallback(
    (count: number) => (
      <View>
        {Array.from({ length: count }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows, fixed length, never reordered
          <View key={i} style={[styles.row, { height: rowHeight }]}>
            {selectable ? <View style={[styles.cell, { width: CHECKBOX_COL_WIDTH }]} /> : null}
            {orderedColumns.map((col) => (
              <SkeletonCellPulse
                key={col.key}
                width={containerWidth > 0 ? (colWidths[col.key] ?? 0) : 80}
                align={col.align}
                reduce={reduce}
              />
            ))}
          </View>
        ))}
      </View>
    ),
    [orderedColumns, colWidths, containerWidth, selectable, rowHeight, reduce],
  );

  const ListEmptyComponent = useMemo(() => {
    if (loading) return renderSkeletonRows(skeletonRows);
    return (
      <View style={styles.emptyContainer}>
        {typeof emptyState === 'string' ? <Text style={styles.emptyText}>{emptyState}</Text> : (emptyState ?? null)}
      </View>
    );
  }, [loading, skeletonRows, emptyState, renderSkeletonRows]);

  const ListFooterComponent = useMemo(
    () => (loading && sortedRows.length > 0 ? renderSkeletonRows(skeletonRows) : null),
    [loading, sortedRows.length, skeletonRows, renderSkeletonRows],
  );

  return (
    <View ref={containerRef} style={[styles.container, { height }, style]} onLayout={onContainerLayout} testID={testID}>
      {/* ── Sticky header ── */}
      <View style={[styles.headerRow, { height: rowHeight }]}>
        {selectable ? (
          <View style={[styles.headerCell, { width: CHECKBOX_COL_WIDTH, justifyContent: 'center', alignItems: 'center' }]}>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={toggleAll}
              accessibilityLabel="Select all rows"
              testID={`${testID ?? 'table'}-select-all`}
            />
          </View>
        ) : null}
        {orderedColumns.map((col, colIndex) => (
          <HeaderCell
            key={col.key}
            column={col}
            colIndex={colIndex}
            colWidth={colWidths[col.key] ?? 0}
            containerWidth={containerWidth}
            isActive={activeSort?.key === col.key}
            activeDirection={activeSort?.direction}
            isColPressed={pressedColKey === col.key}
            isDragging={dragKey === col.key}
            reorderable={reorderable}
            hasColMenu={hasColMenu}
            reduce={reduce}
            gripHandlers={gripHandlers}
            toggleSort={toggleSort}
            setPressedColKey={setPressedColKey}
            onColumnRename={onColumnRename}
            onInsertColumn={onInsertColumn}
            onDeleteColumn={onDeleteColumn}
            testID={testID}
          />
        ))}
        {/* Drop indicator: a line at the insertion boundary while dragging */}
        {dragKey && dropIndex !== null && containerWidth > 0 ? (
          <View
            style={[
              styles.dropIndicator,
              { pointerEvents: 'none', left: Math.min(boundaries[dropIndex] ?? 0, containerWidth - 2) },
            ]}
          />
        ) : null}
      </View>

      {/* ── Body ── */}
      <FlatList
        data={sortedRows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        style={{ height: flatListHeight }}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        removeClippedSubviews={true}
        testID={`${testID ?? 'table'}-list`}
      />
    </View>
  );
}
