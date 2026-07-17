import { MotiView } from 'moti';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, Trash2 } from '../../lib/icons';
import { Checkbox } from '../Checkbox/checkbox';
import { styles } from './table-styles';
import type { TableColumn } from './table-types';
import { CHECKBOX_COL_WIDTH } from './table-types';
import { alignStyle, alignToJustify, readCellValue } from './table-utils';

// ─── Editable cell input ──────────────────────────────────────────────────────

function EditableCellInput({ value, onCommit, testID }: { value: string; onCommit: (next: string) => void; testID?: string }) {
  const [draft, setDraft] = useState(value);
  const commit = useCallback(() => onCommit(draft), [onCommit, draft]);

  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      placeholder="Empty"
      placeholderTextColor="rgba(0,0,0,0.25)"
      testID={testID}
      style={styles.editableInput}
      autoCapitalize="none"
      blurOnSubmit={true}
    />
  );
}

// ─── Skeleton cell pulse ──────────────────────────────────────────────────────

export type SkeletonCellPulseProps = { width: number; align: TableColumn<unknown>['align']; reduce: boolean };

export function SkeletonCellPulse({ width, align, reduce }: SkeletonCellPulseProps) {
  return (
    <View style={[styles.cell, { width, justifyContent: alignToJustify(align) }]}>
      <MotiView
        from={{ opacity: 0.5 }}
        animate={{ opacity: reduce ? 0.5 : 1 }}
        transition={{ type: 'timing', duration: reduce ? 0 : 800, loop: !reduce, repeatReverse: true }}
        style={{ height: 12, borderRadius: 6, backgroundColor: '#e5e7eb', width: align === 'right' ? 40 : '60%' }}
      />
    </View>
  );
}

// ─── Row cell ─────────────────────────────────────────────────────────────────
// One data cell. Owns the per-cell edit-commit callback so it stays stable and
// the parent row never binds an inline arrow per column.

export type RowCellProps<T> = {
  row: T;
  column: TableColumn<T>;
  id: string;
  colWidth: number;
  containerWidth: number;
  onCellEdit?: (rowId: string, key: string, value: string) => void;
  testID?: string;
};

export function RowCell<T>({ row, column, id, colWidth, containerWidth, onCellEdit, testID }: RowCellProps<T>) {
  const { textAlign } = alignStyle(column.align);
  const rawValue = readCellValue(row, column);
  const handleCommit = useCallback((v: string) => onCellEdit?.(id, column.key, v), [onCellEdit, id, column.key]);

  let cellContent: ReactNode;
  if (column.cell) cellContent = column.cell(row);
  else if (column.editable)
    cellContent = (
      <EditableCellInput
        value={rawValue === null ? '' : String(rawValue)}
        onCommit={handleCommit}
        testID={`${testID ?? 'table'}-cell-${id}-${column.key}`}
      />
    );
  else
    cellContent = (
      <Text style={[styles.cellText, { textAlign }]} numberOfLines={1}>
        {rawValue === null ? '' : String(rawValue)}
      </Text>
    );

  return (
    <View style={[styles.cell, { width: containerWidth > 0 ? colWidth : undefined, flex: containerWidth > 0 ? undefined : 1 }]}>
      {cellContent}
    </View>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────
// A single data row. All interactive callbacks are stable useCallbacks bound to
// this row's id/index so the JSX never binds inline arrows.

export type TableRowProps<T> = {
  row: T;
  id: string;
  index: number;
  isSelected: boolean;
  isRowPressed: boolean;
  selectable: boolean;
  orderedColumns: TableColumn<T>[];
  colWidths: Record<string, number>;
  containerWidth: number;
  rowHeight: number;
  reduce: boolean;
  hasRowMenu: boolean;
  setPressedRowId: (id: string | null) => void;
  toggleRow: (id: string) => void;
  onCellEdit?: (rowId: string, key: string, value: string) => void;
  onInsertRow?: (index: number, position: 'before' | 'after') => void;
  onDeleteRow?: (rowId: string) => void;
  testID?: string;
};

export function TableRow<T>({
  row,
  id,
  index,
  isSelected,
  isRowPressed,
  selectable,
  orderedColumns,
  colWidths,
  containerWidth,
  rowHeight,
  reduce,
  hasRowMenu,
  setPressedRowId,
  toggleRow,
  onCellEdit,
  onInsertRow,
  onDeleteRow,
  testID,
}: TableRowProps<T>) {
  const handleLongPress = useCallback(() => {
    if (hasRowMenu) setPressedRowId(isRowPressed ? null : id);
  }, [hasRowMenu, isRowPressed, id, setPressedRowId]);
  const handlePress = useCallback(() => {
    if (isRowPressed) setPressedRowId(null);
  }, [isRowPressed, setPressedRowId]);
  const handleToggleRow = useCallback(() => toggleRow(id), [toggleRow, id]);
  const handleInsertRow = useCallback(() => {
    onInsertRow?.(index, 'before');
    setPressedRowId(null);
  }, [onInsertRow, index, setPressedRowId]);
  const handleDeleteRow = useCallback(() => {
    onDeleteRow?.(id);
    setPressedRowId(null);
  }, [onDeleteRow, id, setPressedRowId]);

  return (
    <Pressable
      style={[styles.row, { height: rowHeight }]}
      onLongPress={handleLongPress}
      onPress={handlePress}
      testID={`${testID ?? 'table'}-row-${id}`}
    >
      {/* Selected row background — spring fade */}
      <MotiView
        animate={{ opacity: isSelected ? 1 : 0 }}
        transition={reduce ? { type: 'timing', duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.selectedBg]}
      />

      {selectable ? (
        <View style={[styles.cell, { width: CHECKBOX_COL_WIDTH, justifyContent: 'center', alignItems: 'center' }]}>
          <Checkbox checked={isSelected} onCheckedChange={handleToggleRow} accessibilityLabel={`Select row ${index + 1}`} />
        </View>
      ) : null}

      {orderedColumns.map((column) => (
        <RowCell
          key={column.key}
          row={row}
          column={column}
          id={id}
          colWidth={colWidths[column.key] ?? 0}
          containerWidth={containerWidth}
          onCellEdit={onCellEdit}
          testID={testID}
        />
      ))}

      {/* Row action buttons shown on long-press at right edge */}
      {isRowPressed && hasRowMenu ? (
        <View style={styles.rowActionBar}>
          {onInsertRow ? (
            <Pressable
              style={styles.actionBtn}
              onPress={handleInsertRow}
              hitSlop={8}
              accessibilityLabel={`Insert row before row ${index + 1}`}
            >
              <Plus size={10} color="#fff" />
            </Pressable>
          ) : null}
          {onDeleteRow ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnDestructive]}
              onPress={handleDeleteRow}
              hitSlop={8}
              accessibilityLabel={`Delete row ${index + 1}`}
            >
              <Trash2 size={10} color="#fff" />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
