import type { ReactNode } from 'react';
import { useCallback } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';
import { ChevronRight } from '../../lib/icons';
import { useThemeColor } from '../../theme/use-theme-color';
import { Button } from '../Button/button';
import { Checkbox } from '../Checkbox/checkbox';
import { Loader } from '../Loader/loader';
import { Text } from '../Text/text';
import { styles } from './table-styles';
import { useTableColors } from './table-theme';

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
  const tc = useTableColors();
  return (
    <Pressable
      onPress={selectable ? handlePress : undefined}
      style={[styles.card, tc.card, isSelected && tc.selectedBg, cardStyle]}
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
  /** Replace the previous-page icon. Default: rotated `<ChevronRight size={16} />`. */
  prevIcon?: ReactNode;
  /** Replace the next-page icon. Default: `<ChevronRight size={16} />`. */
  nextIcon?: ReactNode;
};

export function PaginationFooter({
  page,
  totalPages,
  paginationLabel,
  goToPreviousPage,
  goToNextPage,
  prevIcon,
  nextIcon,
}: PaginationFooterProps) {
  const label = paginationLabel?.(page, totalPages) ?? `${page} / ${totalPages}`;
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;
  const tc = useTableColors();
  const fgColor = useThemeColor('foreground');
  return (
    <View style={[styles.footer, tc.footer, styles.footerPagination]}>
      <Pressable
        onPress={prevDisabled ? undefined : goToPreviousPage}
        style={[styles.paginationBtn, tc.paginationBtn, prevDisabled && styles.paginationBtnDisabled]}
        accessibilityLabel="Previous page"
        accessibilityRole="button"
        disabled={prevDisabled}
      >
        {/* Rotated ChevronRight stands in for missing ChevronLeft */}
        <View style={{ transform: [{ rotate: '180deg' }] }}>{prevIcon ?? <ChevronRight size={16} color={fgColor} />}</View>
      </Pressable>
      <Text style={[styles.paginationText, tc.paginationText]}>{label}</Text>
      <Pressable
        onPress={nextDisabled ? undefined : goToNextPage}
        style={[styles.paginationBtn, tc.paginationBtn, nextDisabled && styles.paginationBtnDisabled]}
        accessibilityLabel="Next page"
        accessibilityRole="button"
        disabled={nextDisabled}
      >
        {nextIcon ?? <ChevronRight size={16} color={fgColor} />}
      </Pressable>
    </View>
  );
}

// ── Load-more button footer ───────────────────────────────────────────────────

export type LoadMoreFooterProps = { onLoadMore?: () => void; loadMoreLabel: string };

export function LoadMoreFooter({ onLoadMore, loadMoreLabel }: LoadMoreFooterProps) {
  return (
    <View style={[styles.footer, styles.footerLoadMore]}>
      <Button variant="outline" size="sm" onPress={onLoadMore} fitWidth={true} accessibilityLabel={loadMoreLabel}>
        {loadMoreLabel}
      </Button>
    </View>
  );
}

// ── Loading-more spinner footer ───────────────────────────────────────────────

/** Renders a centered Loader row while a follow-up page/batch is fetching. */
export function LoadingMoreFooter() {
  const tc = useTableColors();
  const mutedFg = useThemeColor('muted-foreground');
  return (
    <View style={[styles.loadingMoreContainer, tc.loadingMoreContainer]}>
      <Loader variant="spinner" size={20} color={mutedFg} label="Loading more" />
    </View>
  );
}
