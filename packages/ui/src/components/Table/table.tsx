import type { ReactElement, ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import type { ListRenderItemInfo, StyleProp, ViewStyle } from 'react-native';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Checkbox } from '../Checkbox/checkbox';
import { HeaderCell } from './table-header';
import { SkeletonCellPulse, TableRow } from './table-row';
import { styles } from './table-styles';
import type { RowEntry, TableProps } from './table-types';
import { CHECKBOX_COL_WIDTH } from './table-types';
import { useTable } from './use-table';

// ── Card row (small-screen mode) ──────────────────────────────────────────────

type TableCardProps<T> = {
  row: T;
  id: string;
  isSelected: boolean;
  selectable: boolean;
  cardStyle?: StyleProp<ViewStyle>;
  toggleRow: (id: string) => void;
  renderSmallScreen: (row: T, selected: boolean) => ReactNode;
  testID?: string;
};

function TableCard<T>({ row, id, isSelected, selectable, cardStyle, toggleRow, renderSmallScreen, testID }: TableCardProps<T>) {
  const handlePress = useCallback(() => toggleRow(id), [toggleRow, id]);
  const handleCheckedChange = useCallback(() => toggleRow(id), [toggleRow, id]);
  return (
    <Pressable
      onPress={selectable ? handlePress : undefined}
      style={[styles.card, isSelected && styles.selectedBg, cardStyle]}
      testID={testID ? `${testID}-card-${id}` : undefined}
    >
      <View style={styles.cardRow}>
        {selectable ? (
          <View style={styles.cardCheckbox}>
            <Checkbox checked={isSelected} onCheckedChange={handleCheckedChange} />
          </View>
        ) : null}
        <View style={styles.cardContent}>{renderSmallScreen(row, isSelected)}</View>
      </View>
    </Pressable>
  );
}

type FooterSkeletonOptions = {
  loading: boolean;
  hasRows: boolean;
  isCardMode: boolean;
  renderSkeletonCards: (rows: number) => ReactElement;
  renderSkeletonRows: (rows: number) => ReactElement;
  skeletonRows: number;
};

function resolveFooterSkeleton(opts: FooterSkeletonOptions): ReactElement | null {
  const { loading, hasRows, isCardMode, renderSkeletonCards, renderSkeletonRows, skeletonRows } = opts;
  if (loading && hasRows) return isCardMode ? renderSkeletonCards(skeletonRows) : renderSkeletonRows(skeletonRows);
  return null;
}

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
  const { renderSmallScreen, useSmallScreen = false, cardStyle } = props;

  // Card mode: hide the table header and render each row as a card via renderSmallScreen.
  const isCardMode = useSmallScreen && Boolean(renderSmallScreen);

  // ── Render callbacks ───────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<RowEntry<T>>) => {
      if (isCardMode && renderSmallScreen)
        return (
          <TableCard
            row={item.row}
            id={item.id}
            isSelected={selected.has(item.id)}
            selectable={selectable}
            cardStyle={cardStyle}
            toggleRow={toggleRow}
            renderSmallScreen={renderSmallScreen}
            testID={testID}
          />
        );
      return (
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
      );
    },
    [
      isCardMode,
      renderSmallScreen,
      cardStyle,
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

  const renderSkeletonCards = useCallback(
    (count: number) => (
      <View>
        {Array.from({ length: count }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cards, fixed length, never reordered
          <View key={i} style={[styles.card, cardStyle]}>
            <View style={styles.cardRow}>
              {selectable ? (
                <View
                  style={[styles.cardCheckbox, { width: 20, height: 20, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.08)' }]}
                />
              ) : null}
              <View style={[styles.cardContent, { gap: 8 }]}>
                <View style={{ height: 14, width: '80%', borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.08)' }} />
                <View style={{ height: 12, width: '60%', borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.06)' }} />
                <View style={{ height: 12, width: '40%', borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.06)' }} />
              </View>
            </View>
          </View>
        ))}
      </View>
    ),
    [selectable, cardStyle],
  );

  const ListEmptyComponent = useMemo(() => {
    if (loading) return isCardMode ? renderSkeletonCards(skeletonRows) : renderSkeletonRows(skeletonRows);
    return (
      <View style={styles.emptyContainer}>
        {typeof emptyState === 'string' ? <Text style={styles.emptyText}>{emptyState}</Text> : (emptyState ?? null)}
      </View>
    );
  }, [loading, isCardMode, skeletonRows, emptyState, renderSkeletonRows, renderSkeletonCards]);

  const ListFooterComponent = useMemo(
    () =>
      resolveFooterSkeleton({
        loading,
        hasRows: sortedRows.length > 0,
        isCardMode,
        renderSkeletonCards,
        renderSkeletonRows,
        skeletonRows,
      }),
    [loading, isCardMode, sortedRows.length, skeletonRows, renderSkeletonRows, renderSkeletonCards],
  );

  return (
    <View ref={containerRef} style={[styles.container, { height }, style]} onLayout={onContainerLayout} testID={testID}>
      {/* ── Sticky header — hidden in card mode ── */}
      {isCardMode ? null : (
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
      )}

      {/* ── Body ── */}
      <FlatList
        data={sortedRows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // Card heights are set by renderSmallScreen content — skip getItemLayout to avoid
        // incorrect scroll offsets. Table rows are fixed-height so the optimisation holds.
        getItemLayout={isCardMode ? undefined : getItemLayout}
        style={{ height: isCardMode ? height : flatListHeight }}
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
