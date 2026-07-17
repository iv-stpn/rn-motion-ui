import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type TableColumn<T> = {
  key: string;
  header: string;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  editable?: boolean;
  /** pixels string like "120px" or fraction "1.4fr" */
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  minWidth?: number;
};

export type SortDirection = 'asc' | 'desc';
export type SortState = { key: string; direction: SortDirection };

export type TableProps<T> = {
  data: T[];
  columns: TableColumn<T>[];
  getRowId?: (row: T, index: number) => string;
  // selection
  selectable?: boolean;
  selectedRowIds?: string[];
  defaultSelectedRowIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  // sorting (controllable)
  sort?: SortState | null;
  defaultSort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  // resize: no-op on RN (touch-only, no mouse drag on a resize handle)
  resizable?: boolean;
  /** Allow dragging a header grip to reorder columns. */
  reorderable?: boolean;
  /** Fires with the new column key order after a reorder drag commits. */
  onColumnOrderChange?: (keys: string[]) => void;
  // editable
  onCellEdit?: (rowId: string, key: string, value: string) => void;
  onColumnRename?: (key: string, value: string) => void;
  onInsertRow?: (index: number, position: 'before' | 'after') => void;
  onDeleteRow?: (rowId: string) => void;
  onInsertColumn?: (index: number, position: 'before' | 'after') => void;
  onDeleteColumn?: (key: string) => void;
  // layout
  rowHeight?: number;
  height?: number;
  overscan?: number;
  // async
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  loading?: boolean;
  skeletonRows?: number;
  emptyState?: ReactNode;
  // misc
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export type RowEntry<T> = { row: T; id: string };

export type ParsedWidth = { type: 'px'; value: number } | { type: 'fr'; value: number };

export const CHECKBOX_COL_WIDTH = 44;
