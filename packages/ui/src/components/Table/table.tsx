/** biome-ignore-all lint/style/noExcessiveLinesPerFile: complex component */
import { useCallback, useMemo } from 'react';
import type { ListRenderItemInfo } from 'react-native';
import { FlatList, View } from 'react-native';
import { cn } from '../../lib/cn';
import { Checkbox } from '../Checkbox/checkbox';
import { Text } from '../Text/text';
import { HeaderCell } from './table-header';
import { LoadingMoreFooter, LoadMoreFooter, PaginationFooter, SkeletonFooter, TableCard } from './table-parts';
import { SkeletonCellPulse, TableRow } from './table-row';
import type { RowEntry, TableProps } from './table-types';
import { CHECKBOX_COL_WIDTH } from './table-types';
import { useTable } from './use-table';

const PAGINATION_FOOTER_HEIGHT = 52; // footer paddingVertical (10×2) + button height (32)

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
    sortable,
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
    loadingMore,
    skeletonRows,
    mode,
    hasMore,
    onEndReached,
    onEndReachedThreshold,
    onLoadMore,
    loadMoreLabel,
    page,
    totalPages,
    paginationLabel,
    goToPreviousPage,
    goToNextPage,
    emptyState,
    emptyIcon,
    emptyTitle,
    emptyDescription,
    striped,
    stripedStyle,
    flatListHeight,
    rowHeight,
    selectable,
    onCellEdit,
    onInsertRow,
    onDeleteRow,
    testID,
  } = useTable(props);

  const {
    reorderable = false,
    height = 440,
    onColumnRename,
    onInsertColumn,
    onDeleteColumn,
    style,
    className,
    headerClassName,
    rowClassName,
    cellClassName,
    cardClassName,
    footerClassName,
  } = props;
  const { renderSmallScreen, useSmallScreen = false, cardStyle } = props;
  // Card mode: hide the table header and render each row as a card via renderSmallScreen.
  const isCardMode = useSmallScreen && Boolean(renderSmallScreen);
  // Reduce FlatList height when pagination footer is pinned below it.
  const effectiveFlatListHeight = mode === 'pagination' ? flatListHeight - PAGINATION_FOOTER_HEIGHT : flatListHeight;

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
            cardClassName={cardClassName}
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
          isStriped={striped && index % 2 === 1}
          stripedStyle={stripedStyle}
          rowClassName={rowClassName}
          cellClassName={cellClassName}
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
      cardClassName,
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
      striped,
      stripedStyle,
      rowClassName,
      cellClassName,
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
          <View key={i} className="relative flex-row overflow-hidden border-border border-b" style={{ height: rowHeight }}>
            {selectable ? <View className="justify-center overflow-hidden px-4" style={{ width: CHECKBOX_COL_WIDTH }} /> : null}
            {orderedColumns.map((col) => (
              <SkeletonCellPulse
                key={col.key}
                width={containerWidth > 0 ? (colWidths[col.key] ?? 0) : 80}
                align={col.align}
                skeletonWidth={col.skeletonWidth}
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
          <View key={i} className={cn('border-border border-b px-4 py-3', cardClassName)} style={cardStyle}>
            <View className="flex-row items-start gap-3">
              {selectable ? <View className="h-5 w-5 rounded bg-border pt-0.5" /> : null}
              <View className="min-w-0 flex-1 gap-2">
                <View className="h-3.5 w-4/5 rounded-md bg-border" />
                <View className="h-3 w-3/5 rounded-md bg-border" />
                <View className="h-3 w-2/5 rounded-md bg-border" />
              </View>
            </View>
          </View>
        ))}
      </View>
    ),
    [selectable, cardStyle, cardClassName],
  );

  const ListEmptyComponent = useMemo(() => {
    if (loading) return isCardMode ? renderSkeletonCards(skeletonRows) : renderSkeletonRows(skeletonRows);
    // Rich empty state: render icon + title + description when text props are provided.
    if (!emptyState && (emptyTitle || emptyIcon || emptyDescription))
      return (
        <View className="items-center justify-center p-10">
          {emptyIcon ? <View className="mb-2.5 items-center">{emptyIcon}</View> : null}
          {emptyTitle ? <Text className="mb-1 text-center font-semibold text-foreground text-sm">{emptyTitle}</Text> : null}
          {emptyDescription ? (
            <Text className="text-center text-muted-foreground" style={{ fontSize: 13 }}>
              {emptyDescription}
            </Text>
          ) : null}
        </View>
      );
    return (
      <View className="items-center justify-center p-10">
        {typeof emptyState === 'string' ? (
          <Text className="text-center text-muted-foreground text-sm">{emptyState}</Text>
        ) : (
          (emptyState ?? null)
        )}
      </View>
    );
  }, [
    loading,
    isCardMode,
    skeletonRows,
    emptyState,
    emptyIcon,
    emptyTitle,
    emptyDescription,
    renderSkeletonRows,
    renderSkeletonCards,
  ]);

  // loadingMore spinner + loadMore button — rendered inside FlatList footer so they scroll with content.
  const ListFooterComponent = useMemo(() => {
    const skeletonProps = {
      loading,
      hasRows: sortedRows.length > 0,
      isCardMode,
      renderSkeletonCards,
      renderSkeletonRows,
      skeletonRows,
    };
    if (loadingMore)
      return (
        <>
          <SkeletonFooter {...skeletonProps} />
          <LoadingMoreFooter footerClassName={footerClassName} />
        </>
      );
    if (mode === 'loadMore' && hasMore)
      return (
        <>
          <SkeletonFooter {...skeletonProps} />
          <LoadMoreFooter onLoadMore={onLoadMore} loadMoreLabel={loadMoreLabel} footerClassName={footerClassName} />
        </>
      );
    return <SkeletonFooter {...skeletonProps} />;
  }, [
    loading,
    loadingMore,
    mode,
    hasMore,
    onLoadMore,
    loadMoreLabel,
    isCardMode,
    sortedRows.length,
    skeletonRows,
    renderSkeletonRows,
    renderSkeletonCards,
    footerClassName,
  ]);

  const paginationFooter =
    mode === 'pagination' ? (
      <PaginationFooter
        page={page}
        totalPages={totalPages}
        paginationLabel={paginationLabel}
        goToPreviousPage={goToPreviousPage}
        goToNextPage={goToNextPage}
        footerClassName={footerClassName}
      />
    ) : null;

  return (
    <View
      ref={containerRef}
      className={cn('overflow-hidden border border-border bg-surface', className)}
      style={[{ height }, style]}
      onLayout={onContainerLayout}
      testID={testID}
    >
      {/* ── Sticky header — hidden in card mode ── */}
      {isCardMode ? null : (
        <View
          className={cn('select-none flex-row border-border border-b bg-muted', headerClassName)}
          style={{ height: rowHeight }}
        >
          {selectable ? (
            <View
              className="relative flex-col items-center justify-center overflow-hidden px-4"
              style={{ width: CHECKBOX_COL_WIDTH }}
            >
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
              sortEnabled={sortable && (col.sortable ?? false)}
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
              className="absolute top-0 bottom-0 z-20 w-0.5 bg-primary"
              style={{ pointerEvents: 'none', left: Math.min(boundaries[dropIndex] ?? 0, containerWidth - 2) }}
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
        style={{ height: isCardMode ? height : effectiveFlatListHeight }}
        showsVerticalScrollIndicator={false}
        onEndReached={mode === 'infiniteScroll' ? onEndReached : undefined}
        onEndReachedThreshold={onEndReachedThreshold}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        removeClippedSubviews={true}
        testID={`${testID ?? 'table'}-list`}
      />

      {/* ── Pagination footer (fixed, outside FlatList) ── */}
      {paginationFooter}
    </View>
  );
}

export type { SortDirection, SortState, TableColumn, TableMode, TableProps } from './table-types';
