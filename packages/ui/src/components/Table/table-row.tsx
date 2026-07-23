import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { Pressable, TextInput, View } from 'react-native';
import { cn } from '../../lib/cn';
import { Plus, Trash2 } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { useThemeColor } from '../../theme/use-theme-color';
import { Checkbox } from '../Checkbox/checkbox';
import { Text } from '../Text/text';
import type { TableColumn } from './table-types';
import { CHECKBOX_COL_WIDTH } from './table-types';
import { alignStyle, alignToJustify, readCellValue } from './table-utils';

// ─── Editable cell input ──────────────────────────────────────────────────────

// biome-ignore lint/style/useExportsLast: props type before EditableCellInput — collocated for readability
export type EditableCellInputProps = { value: string; onCommit: (next: string) => void; testID?: string };

function EditableCellInput({ value, onCommit, testID }: EditableCellInputProps) {
  const [draft, setDraft] = useState(value);
  const commit = useCallback(() => onCommit(draft), [onCommit, draft]);
  const mutedForeground = useThemeColor('muted-foreground');

  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      placeholder="Empty"
      placeholderTextColor={mutedForeground}
      testID={testID}
      className="flex-1 rounded p-1 text-foreground"
      style={{ fontSize: 13 }}
      autoCapitalize="none"
      blurOnSubmit={true}
    />
  );
}

// ─── Skeleton cell pulse ──────────────────────────────────────────────────────

export type SkeletonCellPulseProps = {
  width: number;
  align: TableColumn<unknown>['align'];
  /** Override skeleton bar width. Defaults to `'60%'` (or `40` for right-aligned). */
  skeletonWidth?: DimensionValue;
  reduce: boolean;
};

export function SkeletonCellPulse({ width, align, skeletonWidth, reduce }: SkeletonCellPulseProps) {
  const barWidth: DimensionValue = skeletonWidth ?? (align === 'right' ? 40 : '60%');
  return (
    <View className="justify-center overflow-hidden px-4" style={{ width, alignItems: alignToJustify(align) }}>
      <MotiView
        from={{ opacity: 0.5 }}
        animate={{ opacity: reduce ? 0.5 : 1 }}
        transition={{ type: 'timing', duration: reduce ? 0 : 800, loop: !reduce, repeatReverse: true }}
        className="h-3 rounded-md bg-border"
        style={{ width: barWidth }}
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
  /** NativeWind classes merged onto this cell. */
  cellClassName?: string;
  testID?: string;
};

export function RowCell<T>({ row, column, id, colWidth, containerWidth, onCellEdit, cellClassName, testID }: RowCellProps<T>) {
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
      <Text className="text-foreground" style={{ fontSize: 13, textAlign }} numberOfLines={1}>
        {rawValue === null ? '' : String(rawValue)}
      </Text>
    );

  return (
    <View
      className={cn('justify-center overflow-hidden px-4', cellClassName)}
      style={{ width: containerWidth > 0 ? colWidth : undefined, flex: containerWidth > 0 ? undefined : 1 }}
    >
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
  /** When true this row gets the `stripedStyle` background tint. */
  isStriped?: boolean;
  /** Style applied when `isStriped` is true. Falls back to a subtle grey tint. */
  stripedStyle?: StyleProp<ViewStyle>;
  /** NativeWind classes merged onto the row. */
  rowClassName?: string;
  /** NativeWind classes merged onto each cell in this row. */
  cellClassName?: string;
  setPressedRowId: (id: string | null) => void;
  toggleRow: (id: string) => void;
  onCellEdit?: (rowId: string, key: string, value: string) => void;
  onInsertRow?: (index: number, position: 'before' | 'after') => void;
  onDeleteRow?: (rowId: string) => void;
  testID?: string;
};

// Subtle alternating-row tint — exempt from theming (too faint to need a token).
const STRIPED_FALLBACK: ViewStyle = { backgroundColor: 'rgba(0,0,0,0.02)' };

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
  isStriped = false,
  stripedStyle,
  rowClassName,
  cellClassName,
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

  const primaryForeground = useThemeColor('primary-foreground');

  return (
    <Pressable
      className={cn('relative flex-row overflow-hidden border-border border-b', rowClassName)}
      style={[{ height: rowHeight }, isStriped && (stripedStyle ?? STRIPED_FALLBACK)]}
      onLongPress={handleLongPress}
      onPress={handlePress}
      testID={`${testID ?? 'table'}-row-${id}`}
    >
      {/* Selected row background — spring fade */}
      <MotiView
        animate={{ opacity: isSelected ? 1 : 0 }}
        transition={reduce ? { type: 'timing', duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
        className="absolute inset-0 bg-surface-selected"
        style={{ pointerEvents: 'none' }}
      />

      {selectable ? (
        <View className="items-center justify-center overflow-hidden px-4" style={{ width: CHECKBOX_COL_WIDTH }}>
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
          cellClassName={cellClassName}
          testID={testID}
        />
      ))}

      {/* Row action buttons shown on long-press at right edge */}
      {isRowPressed && hasRowMenu ? (
        <View className="absolute top-0 right-2 bottom-0 flex-row items-center gap-1">
          {onInsertRow ? (
            <Pressable
              className="h-5 w-5 items-center justify-center rounded-full bg-primary"
              onPress={handleInsertRow}
              hitSlop={8}
              accessibilityLabel={`Insert row before row ${index + 1}`}
            >
              <Plus size={10} color={primaryForeground} />
            </Pressable>
          ) : null}
          {onDeleteRow ? (
            <Pressable
              className="h-5 w-5 items-center justify-center rounded-full bg-danger"
              onPress={handleDeleteRow}
              hitSlop={8}
              accessibilityLabel={`Delete row ${index + 1}`}
            >
              <Trash2 size={10} color={primaryForeground} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
