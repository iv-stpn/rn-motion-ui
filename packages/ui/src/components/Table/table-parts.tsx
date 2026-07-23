import type { ReactNode } from 'react';
import { useCallback } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';
import { cn } from '../../lib/cn';
import { ChevronRight } from '../../lib/icons';
import { useThemeColor } from '../../theme/use-theme-color';
import { Button } from '../Button/button';
import { Checkbox } from '../Checkbox/checkbox';
import { Loader } from '../Loader/loader';
import { Text } from '../Text/text';

// ── Card row (small-screen mode) ──────────────────────────────────────────────

export type TableCardProps<T> = {
  row: T;
  id: string;
  isSelected: boolean;
  selectable: boolean;
  cardStyle?: StyleProp<ViewStyle>;
  /** NativeWind classes merged onto the card (alongside `cardStyle`). */
  cardClassName?: string;
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
  cardClassName,
  toggleRow,
  renderSmallScreen,
  testID,
}: TableCardProps<T>) {
  const handlePress = useCallback(() => toggleRow(id), [toggleRow, id]);
  const handleCheckedChange = useCallback(() => toggleRow(id), [toggleRow, id]);
  return (
    <Pressable
      onPress={selectable ? handlePress : undefined}
      className={cn('px-4 py-3 border-b border-border', isSelected && 'bg-border', cardClassName)}
      style={cardStyle}
      testID={testID ? `${testID}-card-${id}` : undefined}
    >
      <View className="flex-row items-start gap-3">
        {selectable ? (
          <View className="pt-0.5">
            <Checkbox checked={isSelected} onCheckedChange={handleCheckedChange} />
          </View>
        ) : null}
        <View className="flex-1 min-w-0">{renderSmallScreen(row, isSelected)}</View>
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
  /** NativeWind classes merged onto the footer container. */
  footerClassName?: string;
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
  footerClassName,
  prevIcon,
  nextIcon,
}: PaginationFooterProps) {
  const label = paginationLabel?.(page, totalPages) ?? `${page} / ${totalPages}`;
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;
  const foreground = useThemeColor('foreground');
  return (
    <View className={cn('border-t border-border px-4 py-2.5 flex-row items-center justify-center gap-3', footerClassName)}>
      <Pressable
        onPress={prevDisabled ? undefined : goToPreviousPage}
        className={cn('w-8 h-8 rounded-md border border-border items-center justify-center', prevDisabled && 'opacity-35')}
        accessibilityLabel="Previous page"
        accessibilityRole="button"
        disabled={prevDisabled}
      >
        {/* Rotated ChevronRight stands in for missing ChevronLeft */}
        <View style={{ transform: [{ rotate: '180deg' }] }}>{prevIcon ?? <ChevronRight size={16} color={foreground} />}</View>
      </Pressable>
      <Text className="text-muted-foreground" style={{ fontSize: 13 }}>
        {label}
      </Text>
      <Pressable
        onPress={nextDisabled ? undefined : goToNextPage}
        className={cn('w-8 h-8 rounded-md border border-border items-center justify-center', nextDisabled && 'opacity-35')}
        accessibilityLabel="Next page"
        accessibilityRole="button"
        disabled={nextDisabled}
      >
        {nextIcon ?? <ChevronRight size={16} color={foreground} />}
      </Pressable>
    </View>
  );
}

// ── Load-more button footer ───────────────────────────────────────────────────

export type LoadMoreFooterProps = {
  onLoadMore?: () => void;
  loadMoreLabel: string;
  /** NativeWind classes merged onto the footer container. */
  footerClassName?: string;
};

export function LoadMoreFooter({ onLoadMore, loadMoreLabel, footerClassName }: LoadMoreFooterProps) {
  return (
    <View className={cn('border-t border-border px-4 py-2.5 items-stretch', footerClassName)}>
      <Button variant="outline" size="sm" onPress={onLoadMore} fitWidth={true} accessibilityLabel={loadMoreLabel}>
        {loadMoreLabel}
      </Button>
    </View>
  );
}

// ── Loading-more spinner footer ───────────────────────────────────────────────

export type LoadingMoreFooterProps = { footerClassName?: string };

/** Renders a centered Loader row while a follow-up page/batch is fetching. */
export function LoadingMoreFooter({ footerClassName }: LoadingMoreFooterProps) {
  const mutedForeground = useThemeColor('muted-foreground');
  return (
    <View className={cn('py-4 items-center justify-center border-t border-border', footerClassName)}>
      <Loader variant="spinner" size={20} color={mutedForeground} label="Loading more" />
    </View>
  );
}
