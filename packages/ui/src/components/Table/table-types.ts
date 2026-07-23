import type { ReactNode } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

export type TableColumn<T> = {
  key: string;
  header: string;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  /**
   * Value used for client-side sorting when `cell` renders a custom node.
   * Falls back to reading `row[key]` directly when omitted.
   */
  getSortValue?: (row: T) => string | number;
  editable?: boolean;
  /** pixels string like "120px" or fraction "1.4fr" */
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  minWidth?: number;
  /** Width of the skeleton bar shown for this cell during initial load. Defaults to `'60%'`. */
  skeletonWidth?: DimensionValue;
};

export type SortDirection = 'asc' | 'desc';
export type SortState = { key: string; direction: SortDirection };

/**
 * Controls the footer behaviour for data-fetching patterns.
 * - `'loadMore'`       — shows a "Load more" button when `hasMore` is true.
 * - `'pagination'`     — shows prev/next page controls using `page`/`pageSize`/`total`.
 * - `'infiniteScroll'` — auto-triggers `onEndReached` as the user scrolls near the bottom.
 *   Omit to render all rows with no footer.
 */
export type TableMode = 'loadMore' | 'pagination' | 'infiniteScroll';

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
  /**
   * Master switch for sorting. Defaults to `true`. When `false`, no column is sortable
   * regardless of per-column `sortable` flags.
   */
  sortable?: boolean;
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
  // async / loading
  loading?: boolean;
  /** True while a follow-up page/batch is fetching. Shows a spinner in the footer. */
  loadingMore?: boolean;
  skeletonRows?: number;
  // fetch-mode footer
  /** Controls the footer pattern. See `TableMode` for details. */
  mode?: TableMode;
  /** Whether more data is available (used by `loadMore` and `infiniteScroll` modes). */
  hasMore?: boolean;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  onLoadMore?: () => void;
  /** Label for the "Load more" button. Defaults to `'Load more'`. */
  loadMoreLabel?: string;
  // pagination (mode === 'pagination')
  /** Current 1-based page number. */
  page?: number;
  /** Rows per page used to compute total pages. Defaults to `10`. */
  pageSize?: number;
  /** Total number of rows across all pages. */
  total?: number;
  onPageChange?: (page: number) => void;
  /** Custom label rendered between the prev/next buttons. */
  paginationLabel?: (page: number, totalPages: number) => string;
  // empty state
  emptyState?: ReactNode;
  /** Icon shown in the empty state (rendered above the title). */
  emptyIcon?: ReactNode;
  /** Title shown when there is no data and `emptyState` is not provided. */
  emptyTitle?: string;
  /** Description shown below `emptyTitle`. */
  emptyDescription?: string;
  // striped rows
  /** When true, alternating rows get a subtle background tint. */
  striped?: boolean;
  /** Style applied to every odd row when `striped` is true. */
  stripedStyle?: StyleProp<ViewStyle>;
  /**
   * Small screen card view. When provided, enables rendering each row as a card instead of table columns.
   * Useful for responsive layouts on mobile or narrow viewports.
   */
  renderSmallScreen?: (row: T, selected: boolean) => ReactNode;
  /**
   * When true, uses the card view (renderSmallScreen) instead of the table layout.
   * Requires `renderSmallScreen` to be provided.
   */
  useSmallScreen?: boolean;
  /** Style applied to each card container in small screen mode. */
  cardStyle?: StyleProp<ViewStyle>;
  // misc
  /** NativeWind classes merged onto the outer container (last-wins over defaults). */
  className?: string;
  /** NativeWind classes merged onto the sticky header row. */
  headerClassName?: string;
  /** NativeWind classes merged onto every data row. */
  rowClassName?: string;
  /** NativeWind classes merged onto every body cell. */
  cellClassName?: string;
  /** NativeWind classes merged onto each small-screen card (alongside `cardStyle`). */
  cardClassName?: string;
  /** NativeWind classes merged onto the footer (pagination / load-more / loading-more). */
  footerClassName?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export type RowEntry<T> = { row: T; id: string };

export type ParsedWidth = { type: 'px'; value: number } | { type: 'fr'; value: number };

export const CHECKBOX_COL_WIDTH = 44;
