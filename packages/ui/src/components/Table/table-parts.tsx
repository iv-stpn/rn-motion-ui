/**
 * Internal sub-components used by <Table>. Not exported from the package.
 */
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from '../../lib/icons';
import { Checkbox } from '../Checkbox/checkbox';
import { styles } from './table-styles';

// ── Card row (small-screen mode) ──────────────────────────────────────────────

export type TableCardProps<T> = {
  row: T;
  id: string;
  isSelected: boolean;
  selectable: boolean;
  cardStyle?: StyleProp<ViewStyle>;
  toggleRow: (id: string) => void;
  renderSmallScreen: (row: T, selected: boolean) => ReactNode;
  testID?: string;
};

export function TableCard<T>({
  row,
  id,
  isSelected,
  selectable,
  cardStyle,
  toggleRow,
  renderSmallScreen,
  testID,
}: TableCardProps<T>) {
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

// ── Skeleton footer (appended while loading more rows) ────────────────────────

export type SkeletonFooterProps = {
  loading: boolean;
  hasRows: boolean;
  isCardMode: boolean;
  renderSkeletonCards: (rows: number) => ReactNode;
  renderSkeletonRows: (rows: number) => ReactNode;
  skeletonRows: number;
};

/** Renders skeleton rows/cards appended after existing data during a follow-up load. */
export function SkeletonFooter({
  loading,
  hasRows,
  isCardMode,
  renderSkeletonCards,
  renderSkeletonRows,
  skeletonRows,
}: SkeletonFooterProps) {
  if (!(loading && hasRows)) return null;
  return isCardMode ? renderSkeletonCards(skeletonRows) : renderSkeletonRows(skeletonRows);
}

// ── Pagination footer ─────────────────────────────────────────────────────────

export type PaginationFooterProps = {
  page: number;
  totalPages: number;
  paginationLabel?: (page: number, totalPages: number) => string;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
};

export function PaginationFooter({ page, totalPages, paginationLabel, goToPreviousPage, goToNextPage }: PaginationFooterProps) {
  const label = paginationLabel?.(page, totalPages) ?? `${page} / ${totalPages}`;
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;
  return (
    <View style={[styles.footer, styles.footerPagination]}>
      <Pressable
        onPress={prevDisabled ? undefined : goToPreviousPage}
        style={[styles.paginationBtn, prevDisabled && styles.paginationBtnDisabled]}
        accessibilityLabel="Previous page"
        accessibilityRole="button"
        disabled={prevDisabled}
      >
        {/* Rotated ChevronRight stands in for missing ChevronLeft */}
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <ChevronRight size={16} color="#374151" />
        </View>
      </Pressable>
      <Text style={styles.paginationText}>{label}</Text>
      <Pressable
        onPress={nextDisabled ? undefined : goToNextPage}
        style={[styles.paginationBtn, nextDisabled && styles.paginationBtnDisabled]}
        accessibilityLabel="Next page"
        accessibilityRole="button"
        disabled={nextDisabled}
      >
        <ChevronRight size={16} color="#374151" />
      </Pressable>
    </View>
  );
}

// ── Load-more button footer ───────────────────────────────────────────────────

export type LoadMoreFooterProps = { onLoadMore?: () => void; loadMoreLabel: string };

export function LoadMoreFooter({ onLoadMore, loadMoreLabel }: LoadMoreFooterProps) {
  return (
    <View style={[styles.footer, styles.footerLoadMore]}>
      <Pressable onPress={onLoadMore} style={styles.loadMoreBtn} accessibilityRole="button">
        <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>{loadMoreLabel}</Text>
      </Pressable>
    </View>
  );
}
