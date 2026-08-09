import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { Pressable, TextInput, View } from 'react-native';
import { AddLine as Plus } from 'rn-motion-ui-icons/icons/add-line';
import { Delete2Line as Trash2 } from 'rn-motion-ui-icons/icons/delete-2-line';
import { useIsRTL } from '../../../hooks/use-direction';
import { cn } from '../../../lib/cn';
import { MotiView } from '../../../moti/components/view';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Checkbox } from '../../form/Checkbox/checkbox';
import { Text } from '../../typography/Text/text';
import type { TableColumn } from './table-types';
import { alignToItemsClass, alignToTextClass, CHECKBOX_COLUMN_WIDTH, columnLayoutStyle, readCellValue } from './table-utils';

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
      className="flex-1 rounded p-1 text-[13px]"
      autoCapitalize="none"
      blurOnSubmit={true}
    />
  );
}

// ─── Skeleton cell pulse ──────────────────────────────────────────────────────

// ─── Skeleton cell pulse ──────────────────────────────────────────────────────

export type SkeletonCellPulseProps = {
  /** Column width spec — passed directly to `columnLayoutClass` for flex/px resolution. */
  columnWidth: number | string | undefined;
  /** Resolved pixel width for this column (from `computeColumnWidths`). */
  colWidth?: number;
  align: TableColumn<unknown>['align'];
  /** Override skeleton bar width. Defaults to `'60%'` (or `40` for right-aligned). */
  skeletonWidth?: DimensionValue;
  reduce: boolean;
  /** UniWind classes merged onto the skeleton pulse bar. */
  skeletonClassName?: string;
};

export function SkeletonCellPulse({
  columnWidth,
  colWidth,
  align,
  skeletonWidth,
  reduce,
  skeletonClassName,
}: SkeletonCellPulseProps) {
  const barWidth: DimensionValue = skeletonWidth ?? (align === 'right' ? 40 : '60%');
  return (
    <View
      className={cn('justify-center overflow-hidden px-4', alignToItemsClass(align))}
      style={columnLayoutStyle(columnWidth, colWidth)}
    >
      <MotiView
        from={{ opacity: 0.5 }}
        animate={{ opacity: reduce ? 0.5 : 1 }}
        transition={{ type: 'timing', duration: reduce ? 0 : 800, loop: !reduce, repeatReverse: true }}
        className={cn('h-3 rounded-md', skeletonClassName)}
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
  /** Resolved pixel width for this column (from `computeColumnWidths`). */
  colWidth?: number;
  onCellEdit?: (rowId: string, key: string, value: string) => void;
  /** UniWind classes merged onto this cell. */
  cellClassName?: string;
  testID?: string;
};

export function RowCell<T>({ row, column, id, colWidth, onCellEdit, cellClassName, testID }: RowCellProps<T>) {
  const isRTL = useIsRTL();
  const textClass = alignToTextClass(column.align, isRTL);
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
      <Text className={cn('text-[13px]', textClass)} numberOfLines={1}>
        {rawValue === null ? '' : String(rawValue)}
      </Text>
    );

  return (
    <View className={cn('justify-center overflow-hidden px-4', cellClassName)} style={columnLayoutStyle(column.width, colWidth)}>
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
  /** Resolved pixel widths per column key (from `computeColumnWidths`). */
  colWidths: Record<string, number>;
  rowHeight: number;
  reduce: boolean;
  hasRowMenu: boolean;
  /** When true this row gets the `stripedStyle` background tint. */
  isStriped?: boolean;
  /** Style applied when `isStriped` is true. Falls back to a subtle grey tint. */
  stripedStyle?: StyleProp<ViewStyle>;
  /** UniWind classes merged onto the row. */
  rowClassName?: string;
  /** UniWind classes merged onto each cell in this row. */
  cellClassName?: string;
  /** UniWind classes merged onto the selected-row background overlay. */
  selectedClassName?: string;
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
  rowHeight,
  reduce,
  hasRowMenu,
  isStriped = false,
  stripedStyle,
  rowClassName,
  cellClassName,
  selectedClassName,
  setPressedRowId,
  toggleRow,
  onCellEdit,
  onInsertRow,
  onDeleteRow,
  testID,
}: TableRowProps<T>) {
  const isRTL = useIsRTL();
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
      className={cn('relative flex-row overflow-hidden', rowClassName)}
      style={[{ height: rowHeight }, isStriped && (stripedStyle ?? STRIPED_FALLBACK)]}
      onLongPress={handleLongPress}
      onPress={handlePress}
      testID={`${testID ?? 'table'}-row-${id}`}
    >
      {/* Selected row background — spring fade */}
      <MotiView
        animate={{ opacity: isSelected ? 1 : 0 }}
        transition={reduce ? { type: 'timing', duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
        className={cn('pointer-events-none absolute inset-0', selectedClassName)}
      />

      {selectable ? (
        <View className="items-center justify-center overflow-hidden px-4" style={{ width: CHECKBOX_COLUMN_WIDTH }}>
          <Checkbox checked={isSelected} onCheckedChange={handleToggleRow} accessibilityLabel={`Select row ${index + 1}`} />
        </View>
      ) : null}

      {orderedColumns.map((column) => (
        <RowCell
          key={column.key}
          row={row}
          column={column}
          id={id}
          colWidth={colWidths[column.key]}
          onCellEdit={onCellEdit}
          cellClassName={cellClassName}
          testID={testID}
        />
      ))}

      {/* Row action buttons shown on long-press, pinned to the trailing edge —
          which is the left one under RTL, since `right` stays physical. */}
      {isRowPressed && hasRowMenu ? (
        <View className={cn('absolute top-0 bottom-0 flex-row items-center gap-1', isRTL ? 'left-2' : 'right-2')}>
          {onInsertRow ? (
            <Pressable
              className="h-5 w-5 items-center justify-center rounded-full"
              onPress={handleInsertRow}
              hitSlop={8}
              accessibilityLabel={`Insert row before row ${index + 1}`}
            >
              <Plus size={10} color={primaryForeground} />
            </Pressable>
          ) : null}
          {onDeleteRow ? (
            <Pressable
              className="h-5 w-5 items-center justify-center rounded-full"
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
